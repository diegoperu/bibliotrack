import { useState } from 'react'
import { createPortal } from 'react-dom'
import client from '../../api/client'
import { BOOK_STATUS } from '../../lib/bookUtils'
import StarRating from '../ui/StarRating'
import ISBNScanner from '../scanner/ISBNScanner'
import ManualEntry from '../scanner/ManualEntry'

const EMPTY_OPTIONS = { status: 'to_read', genre: '', notes: '', rating: null }

const EMPTY_MANUAL = {
  title: '', author: '', isbn: '', publisher: '', edition: '', year: '',
  language: '', genre: '', description: '', pages: '', cover_path: '',
  status: 'to_read', rating: null, notes: '',
}

/* ── Preview card (after ISBN lookup) ────────────────── */
function PreviewCard({ data, options, setOptions, onBack, onConfirm, saving, error }) {
  const o = (k, v) => setOptions((p) => ({ ...p, [k]: v }))
  const cover = data.cover_url

  return (
    <div className="space-y-5">
      {/* Book summary */}
      <div className="flex gap-4">
        <div
          className="shrink-0 rounded overflow-hidden shadow"
          style={{ width: '80px', aspectRatio: '2/3', backgroundColor: 'var(--bg-tertiary)' }}
        >
          {cover ? (
            <img src={cover} alt={data.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl" style={{ opacity: 0.25 }}>
              📖
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base leading-snug mb-0.5" style={{ color: 'var(--text-primary)' }}>
            {data.title}
          </h3>
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{data.author}</p>
          <div className="flex flex-wrap gap-x-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {data.publisher && <span>{data.publisher}</span>}
            {data.year && <span>{data.year}</span>}
            {data.pages && <span>{data.pages} pag.</span>}
            {data.language && <span>{data.language.toUpperCase()}</span>}
          </div>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: 'var(--border)' }} />

      {/* Personal options */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Genere
          </label>
          <input
            className="input-base"
            placeholder="Genere (es. Fantasy, Narrativa…)"
            value={options.genre}
            onChange={(e) => o('genre', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Stato
          </label>
          <select
            className="input-base"
            value={options.status}
            onChange={(e) => o('status', e.target.value)}
          >
            {Object.entries(BOOK_STATUS).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Valutazione
          </label>
          <StarRating value={options.rating} onChange={(r) => o('rating', r)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Note personali
          </label>
          <textarea
            className="input-base resize-none"
            style={{ minHeight: '72px', fontSize: '0.875rem' }}
            placeholder="Note personali sul libro…"
            value={options.notes}
            onChange={(e) => o('notes', e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      <div className="flex gap-2">
        <button className="btn-secondary" onClick={onBack} disabled={saving}>
          ← Indietro
        </button>
        <button className="btn-primary flex-1" onClick={onConfirm} disabled={saving}>
          {saving ? 'Aggiungendo…' : '➕ Aggiungi alla libreria'}
        </button>
      </div>
    </div>
  )
}

/* ── Manual form (no ISBN) ────────────────────────────── */
function ManualForm({ form, setForm, onBack, onSave, saving, error }) {
  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Titolo *
          </label>
          <input className="input-base" value={form.title} onChange={(e) => f('title', e.target.value)} autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Autore *
          </label>
          <input className="input-base" value={form.author} onChange={(e) => f('author', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ['publisher', 'Editore'],
            ['genre', 'Genere'],
            ['year', 'Anno'],
            ['pages', 'Pagine'],
            ['language', 'Lingua'],
            ['isbn', 'ISBN'],
          ].map(([field, label]) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                {label}
              </label>
              <input
                className="input-base"
                type={field === 'year' || field === 'pages' ? 'number' : 'text'}
                value={form[field] || ''}
                onChange={(e) => f(field, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            URL copertina
          </label>
          <input
            className="input-base"
            placeholder="https://…"
            value={form.cover_path}
            onChange={(e) => f('cover_path', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Stato
          </label>
          <select
            className="input-base"
            value={form.status}
            onChange={(e) => f('status', e.target.value)}
          >
            {Object.entries(BOOK_STATUS).map(([v, { label }]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Valutazione
          </label>
          <StarRating value={form.rating} onChange={(r) => f('rating', r)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Note
          </label>
          <textarea
            className="input-base resize-none"
            style={{ minHeight: '68px' }}
            value={form.notes}
            onChange={(e) => f('notes', e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="flex gap-2">
        <button className="btn-secondary" onClick={onBack} disabled={saving}>
          ← Indietro
        </button>
        <button
          className="btn-primary flex-1"
          onClick={onSave}
          disabled={saving || !form.title || !form.author}
        >
          {saving ? 'Salvando…' : '➕ Aggiungi libro'}
        </button>
      </div>
    </div>
  )
}

/* ── AddBookModal (main) ──────────────────────────────── */
export default function AddBookModal({ onClose, onSaved }) {
  const [step, setStep] = useState('choose')
  // 'choose' | 'scan' | 'isbn-search' | 'lookup' | 'preview' | 'manual'

  const [prevStep, setPrevStep] = useState('choose')
  const [lookupIsbn, setLookupIsbn] = useState('')
  const [lookupData, setLookupData] = useState(null)
  const [lookupError, setLookupError] = useState('')
  const [options, setOptions] = useState(EMPTY_OPTIONS)
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  /* ── ISBN detected (from scan or manual input) ── */
  const handleIsbnDetected = async (isbn, fromStep) => {
    setPrevStep(fromStep)
    setStep('lookup')
    setLookupIsbn(isbn)
    setLookupError('')
    try {
      const { data } = await client.get(`/isbn/${isbn}`)
      setLookupData(data)
      setOptions({ ...EMPTY_OPTIONS, genre: data.genre || '' })
      setStep('preview')
    } catch (e) {
      let msg
      if (!e.response) {
        msg = 'Impossibile raggiungere il server. Verifica che il backend sia raggiungibile.'
      } else if (e.response.status === 404) {
        msg = 'ISBN non trovato in Open Library né in Google Books. Inserisci il libro manualmente.'
      } else if (e.response.status === 400) {
        msg = e.response.data?.detail || 'Formato ISBN non valido'
      } else {
        msg = e.response.data?.detail || `Errore server (${e.response.status})`
      }
      setLookupError(msg)
      setStep(fromStep)
    }
  }

  /* ── Confirm import ── */
  const handleImport = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const { data } = await client.post(`/isbn/${lookupIsbn}/import`, {
        genre: options.genre || null,
        notes: options.notes || null,
        status: options.status,
        rating: options.rating,
      })
      onSaved(data)
    } catch (e) {
      setSaveError(e.response?.data?.detail || 'Errore durante il salvataggio')
      setSaving(false)
    }
  }

  /* ── Manual save ── */
  const handleManualSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const payload = {}
      for (const [k, v] of Object.entries(manualForm)) {
        if (v === '' || v === null) { payload[k] = null; continue }
        if (k === 'year' || k === 'pages') { payload[k] = parseInt(v, 10) || null; continue }
        payload[k] = v
      }
      payload.title  = manualForm.title
      payload.author = manualForm.author
      const { data } = await client.post('/books/', payload)
      onSaved(data)
    } catch (e) {
      setSaveError(e.response?.data?.detail || 'Errore durante il salvataggio')
      setSaving(false)
    }
  }

  /* ── Step titles ── */
  const TITLES = {
    choose:       'Aggiungi libro',
    scan:         'Scansiona barcode',
    'isbn-search': 'Cerca per ISBN',
    lookup:       'Ricerca in corso…',
    preview:      'Conferma libro',
    manual:       'Inserimento manuale',
  }

  /* ── Render content by step ── */
  const renderContent = () => {
    switch (step) {
      case 'choose':
        return (
          <div className="space-y-3">
            {[
              { icon: '📷', label: 'Scansiona barcode', sub: 'Usa la fotocamera', action: () => setStep('scan') },
              { icon: '🔍', label: 'Cerca per ISBN', sub: 'Inserisci il codice manualmente', action: () => setStep('isbn-search') },
              { icon: '✏️', label: 'Inserimento manuale', sub: 'Compila tutti i campi', action: () => setStep('manual') },
            ].map(({ icon, label, sub, action }) => (
              <button
                key={label}
                className="card card-hover w-full flex items-center gap-4 p-4 text-left"
                onClick={action}
              >
                <span className="text-2xl">{icon}</span>
                <div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{label}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</div>
                </div>
                <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>›</span>
              </button>
            ))}
          </div>
        )

      case 'scan':
        return (
          <div className="space-y-3">
            {lookupError && (
              <div
                className="p-3 rounded-md text-sm"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                  color: 'var(--danger)',
                  border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                }}
              >
                {lookupError}
              </div>
            )}
            <ISBNScanner onDetect={(isbn) => handleIsbnDetected(isbn, 'scan')} />
          </div>
        )

      case 'isbn-search':
        return (
          <div className="space-y-3">
            {lookupError && (
              <div
                className="p-3 rounded-md text-sm"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                  color: 'var(--danger)',
                }}
              >
                {lookupError}
              </div>
            )}
            <ManualEntry onDetect={(isbn) => handleIsbnDetected(isbn, 'isbn-search')} />
          </div>
        )

      case 'lookup':
        return (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="text-4xl animate-spin">🔍</div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Ricerca ISBN {lookupIsbn}…
            </p>
          </div>
        )

      case 'preview':
        return (
          <PreviewCard
            data={lookupData}
            options={options}
            setOptions={setOptions}
            onBack={() => setStep(prevStep)}
            onConfirm={handleImport}
            saving={saving}
            error={saveError}
          />
        )

      case 'manual':
        return (
          <ManualForm
            form={manualForm}
            setForm={setManualForm}
            onBack={() => setStep('choose')}
            onSave={handleManualSave}
            saving={saving}
            error={saveError}
          />
        )

      default:
        return null
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div
        className="card w-full sm:max-w-md max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: '1rem 1rem 0 0', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', zIndex: 1 }}
        >
          <div className="flex items-center gap-2">
            {step !== 'choose' && (
              <button
                onClick={() => {
                  if (step === 'scan' || step === 'isbn-search' || step === 'manual') setStep('choose')
                  else if (step === 'preview') setStep(prevStep)
                }}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px 0 0' }}
                disabled={saving || step === 'lookup'}
              >
                ←
              </button>
            )}
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              {TITLES[step] ?? 'Aggiungi libro'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              color: 'var(--text-muted)', background: 'none', border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer', fontSize: '1.1rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5">{renderContent()}</div>
      </div>
    </div>,
    document.body
  )
}
