import { useState } from 'react'
import { createPortal } from 'react-dom'
import useBookStore from '../../stores/bookStore'
import { BOOK_STATUS } from '../../lib/bookUtils'
import StarRating from '../ui/StarRating'

// Manual entry only — barcode scan + ISBN cascade lookup land in MOBILE-2.
const EMPTY_FORM = {
  title: '', author: '', isbn: '', publisher: '', edition: '', year: '',
  language: '', genre: '', description: '', pages: '', cover_path: '',
  status: 'to_read', rating: null, notes: '',
}

export default function AddBookModal({ onClose, onSaved }) {
  const addBook = useBookStore((s) => s.addBook)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {}
      for (const [k, v] of Object.entries(form)) {
        if (v === '' || v === null) { payload[k] = null; continue }
        if (k === 'year' || k === 'pages') { payload[k] = parseInt(v, 10) || null; continue }
        payload[k] = v
      }
      payload.title = form.title
      payload.author = form.author
      const created = await addBook(payload)
      onSaved(created)
    } catch (e) {
      setError(e.message || 'Errore durante il salvataggio')
      setSaving(false)
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
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', zIndex: 1 }}
        >
          <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Aggiungi libro</h2>
          <button
            onClick={onClose}
            disabled={saving}
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '1.1rem' }}
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Titolo *</label>
              <input className="input-base" value={form.title} onChange={(e) => f('title', e.target.value)} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Autore *</label>
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
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
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
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>URL copertina</label>
              <input
                className="input-base"
                placeholder="https://…"
                value={form.cover_path}
                onChange={(e) => f('cover_path', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Stato</label>
              <select className="input-base" value={form.status} onChange={(e) => f('status', e.target.value)}>
                {Object.entries(BOOK_STATUS).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Valutazione</label>
              <StarRating value={form.rating} onChange={(r) => f('rating', r)} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Note</label>
              <textarea
                className="input-base resize-none"
                style={{ minHeight: '68px' }}
                value={form.notes}
                onChange={(e) => f('notes', e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

          <button
            className="btn-primary w-full"
            onClick={handleSave}
            disabled={saving || !form.title || !form.author}
          >
            {saving ? 'Salvando…' : '➕ Aggiungi libro'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
