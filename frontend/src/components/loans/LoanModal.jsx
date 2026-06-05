import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import client from '../../api/client'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function LoanModal({ bookId, bookTitle, onClose, onSuccess }) {
  const [borrowerInput, setBorrowerInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const debouncedInput = useDebounce(borrowerInput, 300)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!debouncedInput.trim()) {
      setSuggestions([])
      return
    }
    client
      .get('/loans/borrowers', { params: { q: debouncedInput } })
      .then(({ data }) => setSuggestions(data))
      .catch(() => setSuggestions([]))
  }, [debouncedInput])

  const selectSuggestion = (s) => {
    setBorrowerInput(s.display_name)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleSubmit = async () => {
    if (!borrowerInput.trim()) return
    setSaving(true)
    setError(null)
    try {
      await client.post('/loans', {
        book_id: bookId,
        borrower_name: borrowerInput.trim(),
        notes: notes.trim() || null,
      })
      onSuccess()
    } catch (e) {
      setError(e.response?.data?.detail || 'Errore durante il prestito')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl p-5"
        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
          Presta libro
        </h2>
        <p className="text-sm mb-4 truncate" style={{ color: 'var(--text-muted)' }}>
          {bookTitle}
        </p>

        <div className="mb-3 relative">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Presta a *
          </label>
          <input
            ref={inputRef}
            className="input-base"
            placeholder="Nome persona…"
            value={borrowerInput}
            onChange={(e) => { setBorrowerInput(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={handleKeyDown}
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul
              className="absolute z-10 w-full mt-1 rounded-md shadow-lg overflow-hidden"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              {suggestions.map((s) => (
                <li
                  key={s.id}
                  className="px-3 py-2 text-sm cursor-pointer"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseDown={() => selectSuggestion(s)}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                >
                  {s.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Note (opzionale)
          </label>
          <textarea
            className="input-base resize-none"
            style={{ minHeight: '72px', fontSize: '0.875rem' }}
            placeholder="Es. da restituire entro…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-sm mb-3" style={{ color: 'var(--danger)' }}>{error}</p>
        )}

        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            onClick={handleSubmit}
            disabled={saving || !borrowerInput.trim()}
          >
            {saving ? 'Prestando…' : '📤 Presta'}
          </button>
          <button className="btn-secondary" onClick={onClose}>Annulla</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
