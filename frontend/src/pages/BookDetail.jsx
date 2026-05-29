import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { getCoverUrl, BOOK_STATUS } from '../lib/bookUtils'
import StarRating from '../components/ui/StarRating'

/* ── Edit form ──────────────────────────────────────── */
function EditForm({ form, setForm, onSave, onCancel, saving }) {
  const f = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <div className="card p-6">
      <h2 className="font-bold text-lg mb-5" style={{ color: 'var(--text-primary)' }}>
        Modifica libro
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Titolo *</label>
          <input className="input-base" value={form.title || ''} onChange={(e) => f('title', e.target.value)} />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Autore *</label>
          <input className="input-base" value={form.author || ''} onChange={(e) => f('author', e.target.value)} />
        </div>

        {[
          ['publisher', 'Editore'],
          ['genre', 'Genere'],
          ['edition', 'Edizione'],
          ['language', 'Lingua (it, en…)'],
          ['isbn', 'ISBN'],
          ['cover_path', 'URL copertina'],
        ].map(([field, label]) => (
          <div key={field}>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
            <input className="input-base" value={form[field] || ''} onChange={(e) => f(field, e.target.value)} />
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Anno</label>
          <input type="number" className="input-base" min="1000" max="2099" value={form.year || ''} onChange={(e) => f('year', e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Pagine</label>
          <input type="number" className="input-base" min="1" value={form.pages || ''} onChange={(e) => f('pages', e.target.value)} />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Descrizione</label>
          <textarea
            className="input-base resize-none"
            style={{ minHeight: '80px' }}
            value={form.description || ''}
            onChange={(e) => f('description', e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 mt-5">
        <button className="btn-primary" onClick={onSave} disabled={saving || !form.title || !form.author}>
          {saving ? 'Salvando…' : '✓ Salva'}
        </button>
        <button className="btn-secondary" onClick={onCancel}>Annulla</button>
      </div>
    </div>
  )
}

/* ── BookDetail page ────────────────────────────────── */
export default function BookDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [book, setBook]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [editing, setEditing]       = useState(false)
  const [editForm, setEditForm]     = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [notes, setNotes]           = useState('')
  const [notesDirty, setNotesDirty] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [toast, setToast]           = useState('')

  useEffect(() => {
    client
      .get(`/books/${id}`)
      .then(({ data }) => { setBook(data); setNotes(data.notes || '') })
      .catch((e) => setError(e.response?.data?.detail || 'Libro non trovato'))
      .finally(() => setLoading(false))
  }, [id])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const patchField = async (field, value) => {
    try {
      const { data } = await client.patch(`/books/${id}`, { [field]: value })
      setBook(data)
    } catch {
      showToast('Salvataggio fallito')
    }
  }

  const saveNotes = async () => {
    setSavingNotes(true)
    try {
      const { data } = await client.patch(`/books/${id}`, { notes })
      setBook(data)
      setNotesDirty(false)
    } catch {
      showToast('Salvataggio note fallito')
    } finally {
      setSavingNotes(false)
    }
  }

  const startEdit = () => {
    setEditForm({
      title: book.title, author: book.author,
      publisher: book.publisher || '', genre: book.genre || '',
      edition: book.edition || '', language: book.language || '',
      isbn: book.isbn || '', cover_path: book.cover_path || '',
      year: book.year || '', pages: book.pages || '',
      description: book.description || '',
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    setSavingEdit(true)
    try {
      const payload = {}
      for (const [k, v] of Object.entries(editForm)) {
        if (v === '') payload[k] = null
        else if (k === 'year' || k === 'pages') payload[k] = v ? parseInt(v, 10) : null
        else payload[k] = v
      }
      const { data } = await client.patch(`/books/${id}`, payload)
      setBook(data)
      setNotes(data.notes || '')
      setEditing(false)
    } catch {
      showToast('Salvataggio fallito')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    try {
      await client.delete(`/books/${id}`)
      navigate('/library')
    } catch {
      showToast('Eliminazione fallita')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center animate-pulse" style={{ color: 'var(--text-muted)' }}>
          <div className="text-3xl mb-2">📖</div>
          <p>Caricamento…</p>
        </div>
      </div>
    )
  }

  if (error || !book) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" style={{ color: 'var(--danger)' }}>
          <div className="text-3xl mb-2">⚠️</div>
          <p>{error || 'Libro non trovato'}</p>
          <button className="btn-secondary mt-4 text-sm" onClick={() => navigate('/library')}>
            ← Torna alla libreria
          </button>
        </div>
      </div>
    )
  }

  const coverUrl = getCoverUrl(book.cover_path)
  const status = BOOK_STATUS[book.status]

  return (
    <div className="max-w-3xl">
      <button
        className="flex items-center gap-1 text-sm mb-5"
        style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        onClick={() => navigate(-1)}
      >
        ← Libreria
      </button>

      {editing ? (
        <EditForm
          form={editForm}
          setForm={setEditForm}
          onSave={saveEdit}
          onCancel={() => setEditing(false)}
          saving={savingEdit}
        />
      ) : (
        <>
          {/* ── Hero card ── */}
          <div className="card p-5 mb-5">
            <div className="flex gap-5">
              {/* Cover */}
              <div
                className="shrink-0 rounded-md overflow-hidden shadow-md"
                style={{ width: '110px', aspectRatio: '2/3', backgroundColor: 'var(--bg-tertiary)' }}
              >
                {coverUrl ? (
                  <img src={coverUrl} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ opacity: 0.2 }}>
                    <span className="text-5xl">📖</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold leading-snug mb-1" style={{ color: 'var(--text-primary)' }}>
                  {book.title}
                </h1>
                <p className="text-base mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {book.author}
                </p>

                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                  {book.publisher && <span>{book.publisher}</span>}
                  {book.year && <span>{book.year}</span>}
                  {book.pages && <span>{book.pages} pag.</span>}
                  {book.language && <span>{book.language.toUpperCase()}</span>}
                </div>

                {/* Status + rating (always editable) */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <select
                    className="input-base"
                    style={{ width: 'auto', minWidth: '140px', fontSize: '0.875rem' }}
                    value={book.status}
                    onChange={(e) => patchField('status', e.target.value)}
                  >
                    {Object.entries(BOOK_STATUS).map(([v, { label }]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>

                  <StarRating value={book.rating} onChange={(r) => patchField('rating', r)} />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary text-sm" onClick={startEdit}>✏️ Modifica</button>
                  {!deleteConfirm ? (
                    <button
                      className="btn-secondary text-sm"
                      onClick={() => setDeleteConfirm(true)}
                      style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}
                    >
                      🗑️ Elimina
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-sm mr-1" style={{ color: 'var(--danger)' }}>Sicuro?</span>
                      <button className="btn-danger text-sm px-3 py-1.5" onClick={handleDelete}>Elimina</button>
                      <button className="btn-secondary text-sm" onClick={() => setDeleteConfirm(false)}>Annulla</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Details grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Metadata */}
            <div className="card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Informazioni
              </h2>
              <dl className="space-y-2">
                {[
                  ['ISBN',     book.isbn],
                  ['Genere',   book.genre],
                  ['Editore',  book.publisher],
                  ['Edizione', book.edition],
                  ['Anno',     book.year],
                  ['Lingua',   book.language],
                  ['Pagine',   book.pages],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="text-sm w-20 shrink-0" style={{ color: 'var(--text-muted)' }}>{k}</dt>
                      <dd className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{v}</dd>
                    </div>
                  ))}
              </dl>
            </div>

            {/* Notes */}
            <div className="card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Note personali
              </h2>
              <textarea
                className="input-base resize-none"
                style={{ minHeight: '96px', fontSize: '0.875rem' }}
                placeholder="Aggiungi note personali…"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  setNotesDirty(e.target.value !== (book.notes || ''))
                }}
              />
              {notesDirty && (
                <button className="btn-primary text-sm mt-2" onClick={saveNotes} disabled={savingNotes}>
                  {savingNotes ? 'Salvando…' : 'Salva note'}
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          {book.description && (
            <div className="card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Descrizione
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {book.description}
              </p>
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-4 right-4 px-4 py-2 rounded-md text-sm shadow-lg"
          style={{ backgroundColor: 'var(--danger)', color: '#fff', zIndex: 50 }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
