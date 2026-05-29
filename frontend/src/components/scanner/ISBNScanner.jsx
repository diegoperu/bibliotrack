import { useEffect, useRef, useState, useCallback } from 'react'

const IS_NATIVE = typeof window !== 'undefined' && 'BarcodeDetector' in window

export default function ISBNScanner({ onDetect }) {
  const videoRef    = useRef(null)
  const containerRef = useRef(null)
  const streamRef   = useRef(null)
  const rafRef      = useRef(null)
  const quaggaRef   = useRef(null)
  const detectorRef = useRef(null)

  const [status, setStatus] = useState('idle')
  // 'idle' | 'requesting' | 'active' | 'denied' | 'error' | 'found'

  const cleanup = useCallback(() => {
    if (rafRef.current)   { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current){ streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    if (quaggaRef.current){ try { quaggaRef.current.stop() } catch {} quaggaRef.current = null }
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const handleFound = useCallback((rawIsbn) => {
    cleanup()
    setStatus('found')
    setTimeout(() => onDetect(rawIsbn.replace(/[-\s]/g, '')), 350)
  }, [cleanup, onDetect])

  /* ── BarcodeDetector loop ── */
  const startNativeLoop = useCallback(() => {
    if (!detectorRef.current) {
      detectorRef.current = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
      })
    }
    const scan = async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(scan); return }
      try {
        const results = await detectorRef.current.detect(video)
        if (results.length > 0) { handleFound(results[0].rawValue); return }
      } catch { /* ignore frame error */ }
      rafRef.current = requestAnimationFrame(scan)
    }
    scan()
  }, [handleFound])

  /* ── QuaggaJS (iOS fallback) ── */
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
              target: containerRef.current,
              constraints: { facingMode: 'environment' },
            },
            locator: { patchSize: 'medium', halfSample: true },
            numOfWorkers: 0,
            decoder: { readers: ['ean_reader', 'ean_8_reader'] },
            locate: true,
          },
          (err) => {
            if (err) {
              const msg = err?.toString() ?? ''
              setStatus(msg.includes('ermission') || msg.includes('llowed') ? 'denied' : 'error')
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
    } catch {
      /* already handled in init callback */
    }
  }, [handleFound])

  /* ── Start ── */
  const startScanner = useCallback(async () => {
    setStatus('requesting')
    if (IS_NATIVE) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('active')
        startNativeLoop()
      } catch (err) {
        setStatus(err.name === 'NotAllowedError' ? 'denied' : 'error')
      }
    } else {
      startQuagga()
    }
  }, [startNativeLoop, startQuagga])

  const stopScanner = useCallback(() => {
    cleanup()
    setStatus('idle')
  }, [cleanup])

  /* ── UI ── */
  const isActive  = status === 'active'
  const isFound   = status === 'found'
  const borderClr = isFound ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--border)'

  return (
    <div className="space-y-3">
      <div
        ref={IS_NATIVE ? null : undefined}
        className="relative rounded-lg overflow-hidden"
        style={{
          aspectRatio: '4/3',
          maxHeight: '320px',
          backgroundColor: 'var(--bg-tertiary)',
          border: `2px solid ${borderClr}`,
          transition: 'border-color 0.2s ease',
        }}
      >
        {/* BarcodeDetector video */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          style={{ display: isActive && IS_NATIVE ? 'block' : 'none' }}
        />

        {/* QuaggaJS container (creates its own video+canvas) */}
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ display: isActive && !IS_NATIVE ? 'block' : 'none' }}
        />

        {/* Viewfinder overlay */}
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="rounded"
              style={{
                width: '200px',
                height: '110px',
                border: `2px solid rgba(255,255,255,0.7)`,
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
          <div className="absolute inset-0 flex items-center justify-center">
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
              Abilita nelle impostazioni del browser
            </p>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="text-sm" style={{ color: 'var(--danger)' }}>Errore fotocamera</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {(status === 'idle' || status === 'denied' || status === 'error') && (
          <button
            className="btn-primary flex-1"
            onClick={startScanner}
            disabled={status === 'denied'}
          >
            📷 Avvia scanner
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
          Modalità compatibilità iOS attiva
        </p>
      )}
    </div>
  )
}
