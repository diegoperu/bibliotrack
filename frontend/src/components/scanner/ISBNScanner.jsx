import { useEffect, useRef, useState, useCallback } from 'react'

const IS_NATIVE = typeof window !== 'undefined' && 'BarcodeDetector' in window

function isSecureContext() {
  return (
    window.isSecureContext ||
    location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1'
  )
}

export default function ISBNScanner({ onDetect }) {
  const videoRef     = useRef(null)
  const canvasRef    = useRef(null)   // off-screen canvas for BarcodeDetector (more reliable than video on Android)
  const containerRef = useRef(null)
  const streamRef    = useRef(null)
  const rafRef       = useRef(null)
  const quaggaRef    = useRef(null)
  const detectorRef  = useRef(null)
  const scanActiveRef = useRef(false) // prevents overlapping detect() calls

  const [status, setStatus]     = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  // status: 'idle' | 'requesting' | 'active' | 'denied' | 'error' | 'found'

  const cleanup = useCallback(() => {
    scanActiveRef.current = false
    if (rafRef.current)    { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    if (quaggaRef.current) { try { quaggaRef.current.stop() } catch {} quaggaRef.current = null }
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const handleFound = useCallback((rawIsbn) => {
    cleanup()
    setStatus('found')
    setTimeout(() => onDetect(rawIsbn.replace(/[-\s]/g, '')), 350)
  }, [cleanup, onDetect])

  /* ── BarcodeDetector loop ─────────────────────────────────────── */
  const startNativeLoop = useCallback(async () => {
    if (!detectorRef.current) {
      detectorRef.current = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
      })
    }

    // Request continuous autofocus on Android — essential for barcode scanning.
    // Without this, many Android cameras stay at fixed focus and barcodes stay blurry.
    const track = streamRef.current?.getVideoTracks()[0]
    if (track) {
      try {
        const caps = track.getCapabilities?.()
        if (caps?.focusMode?.includes('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
        }
      } catch { /* not supported on this device — continue anyway */ }
    }

    let lastScanTime = 0

    const scan = (timestamp) => {
      if (!scanActiveRef.current) return

      const video = videoRef.current
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(scan)
        return
      }

      // Throttle: attempt decode at most ~4x/second so the camera has time to
      // autofocus between attempts. 60fps detect() floods the API and prevents focus.
      if (timestamp - lastScanTime < 250) {
        rafRef.current = requestAnimationFrame(scan)
        return
      }
      lastScanTime = timestamp

      // Draw current video frame to canvas, then detect from the canvas.
      // BarcodeDetector on Android Chrome is significantly more reliable on a
      // canvas ImageData than on a live <video> element.
      const canvas = canvasRef.current
      if (!canvas) { rafRef.current = requestAnimationFrame(scan); return }
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)

      detectorRef.current.detect(canvas).then((results) => {
        if (!scanActiveRef.current) return
        if (results.length > 0) {
          handleFound(results[0].rawValue)
        } else {
          rafRef.current = requestAnimationFrame(scan)
        }
      }).catch(() => {
        if (scanActiveRef.current) rafRef.current = requestAnimationFrame(scan)
      })
    }

    scanActiveRef.current = true
    rafRef.current = requestAnimationFrame(scan)
  }, [handleFound])

  /* ── QuaggaJS (Firefox + iOS fallback) ───────────────────────── */
  const startQuagga = useCallback(async () => {
    try {
      const { default: Quagga } = await import('@ericblade/quagga2')
      quaggaRef.current = Quagga

      await new Promise((resolve, reject) => {
        Quagga.init(
          {
            inputStream: {
              name: 'Live',
              type: 'LiveStream',
              target: containerRef.current, // NOTE: must be visible (not display:none) — see JSX
              constraints: { facingMode: { ideal: 'environment' } },
            },
            locator: { patchSize: 'medium', halfSample: true },
            numOfWorkers: 0,
            decoder: { readers: ['ean_reader', 'ean_8_reader'] },
            locate: true,
          },
          (err) => {
            if (err) {
              const msg = (err?.message ?? err?.toString() ?? '').toLowerCase()
              if (msg.includes('permission') || msg.includes('denied') || msg.includes('allowed') || msg.includes('notallowed')) {
                setStatus('denied')
              } else {
                setErrorMsg('Errore avvio scanner: ' + (err?.message ?? String(err)))
                setStatus('error')
              }
              reject(err)
            } else {
              setStatus('active')
              resolve()
            }
          }
        )
      })

      Quagga.start()
      Quagga.onDetected((result) => {
        Quagga.stop()
        handleFound(result.codeResult.code)
      })
    } catch (e) {
      // Outer catch: import failure or unexpected error not caught in init callback
      setErrorMsg('Impossibile avviare Quagga: ' + (e?.message ?? String(e)))
      setStatus((prev) => (prev === 'requesting' || prev === 'active') ? 'error' : prev)
    }
  }, [handleFound])

  /* ── Start ────────────────────────────────────────────────────── */
  const startScanner = useCallback(async () => {
    setErrorMsg('')

    // 1. Check HTTPS — getUserMedia requires secure context (HTTPS or localhost)
    if (!isSecureContext()) {
      setErrorMsg(
        'La fotocamera richiede HTTPS.\n' +
        'Accedi tramite https:// oppure usa localhost per il test locale.'
      )
      setStatus('error')
      return
    }

    // 2. Check browser support
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Il browser non supporta getUserMedia. Usa Chrome, Firefox o Safari recenti.')
      setStatus('error')
      return
    }

    setStatus('requesting')

    if (IS_NATIVE) {
      try {
        // Use ideal for facingMode — hard 'environment' can fail on devices where
        // the back camera isn't immediately enumerated. Also skip explicit resolution
        // constraints: letting the browser pick avoids incompatible camera modes on
        // some Android devices that cause the stream to never produce frames.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          // Wait for metadata so videoWidth/videoHeight are available before scanning
          await new Promise((resolve) => {
            if (video.readyState >= 1) { resolve(); return }
            video.onloadedmetadata = resolve
          })
          await video.play()
        }
        setStatus('active')
        startNativeLoop()
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setStatus('denied')
        } else {
          setErrorMsg(err.message || 'Errore accesso fotocamera')
          setStatus('error')
        }
      }
    } else {
      // QuaggaJS — container must be in DOM before init (visibility:hidden, not display:none)
      startQuagga()
    }
  }, [startNativeLoop, startQuagga])

  const stopScanner = useCallback(() => {
    cleanup()
    setStatus('idle')
    setErrorMsg('')
  }, [cleanup])

  /* ── UI ───────────────────────────────────────────────────────── */
  const isActive  = status === 'active'
  const isFound   = status === 'found'
  const borderClr = isFound ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--border)'

  return (
    <div className="space-y-3">
      <div
        className="relative rounded-lg overflow-hidden"
        style={{
          aspectRatio: '4/3',
          maxHeight: '320px',
          backgroundColor: 'var(--bg-tertiary)',
          border: `2px solid ${borderClr}`,
          transition: 'border-color 0.2s ease',
        }}
      >
        {/* BarcodeDetector: native video element + off-screen canvas for detection */}
        {IS_NATIVE && (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              style={{ display: isActive ? 'block' : 'none' }}
            />
            {/* Canvas is never shown — used only to snapshot video frames for BarcodeDetector,
                which is more reliable than detecting directly on the live <video> on Android */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </>
        )}

        {/* QuaggaJS container — MUST use visibility:hidden (not display:none) so the
            element has layout dimensions before Quagga.init() is called. display:none
            gives 0×0 dimensions and Quagga fails silently. */}
        {!IS_NATIVE && (
          <div
            ref={containerRef}
            className="absolute inset-0 w-full h-full"
            style={{ visibility: (status === 'requesting' || isActive) ? 'visible' : 'hidden' }}
          />
        )}

        {/* Viewfinder */}
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="rounded"
              style={{
                width: '200px',
                height: '110px',
                border: '2px solid rgba(255,255,255,0.7)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)',
              }}
            />
          </div>
        )}

        {/* Found flash */}
        {isFound && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--success) 30%, transparent)' }}
          >
            <span className="text-5xl">✅</span>
          </div>
        )}

        {/* Status overlays */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-5xl" style={{ opacity: 0.25 }}>📷</span>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Avvia lo scanner</p>
          </div>
        )}

        {status === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
            <p className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>
              Accesso fotocamera…
            </p>
          </div>
        )}

        {status === 'denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="text-3xl">🚫</span>
            <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
              Accesso fotocamera negato
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Abilita nelle impostazioni del browser, poi riprova
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="text-sm font-medium" style={{ color: 'var(--danger)' }}>
              Fotocamera non disponibile
            </p>
            {errorMsg && (
              <p className="text-xs whitespace-pre-line" style={{ color: 'var(--text-muted)' }}>
                {errorMsg}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {(status === 'idle' || status === 'error') && (
          <button className="btn-primary flex-1" onClick={startScanner}>
            📷 Avvia scanner
          </button>
        )}
        {status === 'denied' && (
          <button className="btn-secondary flex-1" onClick={startScanner}>
            🔄 Riprova
          </button>
        )}
        {isActive && (
          <button className="btn-secondary flex-1" onClick={stopScanner}>
            ✕ Interrompi
          </button>
        )}
      </div>

      {!IS_NATIVE && status === 'idle' && (
        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          Browser senza BarcodeDetector — modalità compatibilità (QuaggaJS)
        </p>
      )}
    </div>
  )
}
