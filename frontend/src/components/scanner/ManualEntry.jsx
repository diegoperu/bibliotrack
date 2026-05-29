import { useState } from 'react'

const ISBN_RE = /^\d{10}$|^\d{13}$/

export default function ManualEntry({ onDetect }) {
  const [isbn, setIsbn] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    const clean = isbn.replace(/[-\s]/g, '')
    if (!ISBN_RE.test(clean)) {
      setError('ISBN non valido — deve avere 10 o 13 cifre')
      return
    }
    setError('')
    onDetect(clean)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          className="input-base flex-1"
          placeholder="ISBN (es. 9788807885452)"
          value={isbn}
          onChange={(e) => { setIsbn(e.target.value); setError('') }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
          inputMode="numeric"
        />
        <button className="btn-primary shrink-0 px-4" onClick={submit} disabled={!isbn}>
          🔍 Cerca
        </button>
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Puoi inserire con o senza trattini (es. 978-88-07-88545-2)
      </p>
    </div>
  )
}
