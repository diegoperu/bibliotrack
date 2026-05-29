import { useMemo } from 'react'
import { BOOK_STATUS } from '../../lib/bookUtils'

export const EMPTY_FILTERS = { search: '', genre: '', status: '', publisher: '', language: '' }

export default function FilterBar({ filters, onChange, allBooks }) {
  const genres = useMemo(
    () => [...new Set(allBooks.map((b) => b.genre).filter(Boolean))].sort(),
    [allBooks]
  )
  const publishers = useMemo(
    () => [...new Set(allBooks.map((b) => b.publisher).filter(Boolean))].sort(),
    [allBooks]
  )
  const languages = useMemo(
    () => [...new Set(allBooks.map((b) => b.language).filter(Boolean))].sort(),
    [allBooks]
  )

  const hasActive = Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        type="search"
        className="input-base"
        style={{ width: '210px', minWidth: '150px' }}
        placeholder="Cerca titolo, autore…"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />

      <select
        className="input-base"
        style={{ width: 'auto', minWidth: '140px' }}
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
      >
        <option value="">Tutti gli stati</option>
        {Object.entries(BOOK_STATUS).map(([v, { label }]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>

      {genres.length > 0 && (
        <select
          className="input-base"
          style={{ width: 'auto', minWidth: '130px' }}
          value={filters.genre}
          onChange={(e) => onChange({ ...filters, genre: e.target.value })}
        >
          <option value="">Tutti i generi</option>
          {genres.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      )}

      {publishers.length > 0 && (
        <select
          className="input-base"
          style={{ width: 'auto', minWidth: '130px' }}
          value={filters.publisher}
          onChange={(e) => onChange({ ...filters, publisher: e.target.value })}
        >
          <option value="">Tutti gli editori</option>
          {publishers.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      )}

      {languages.length > 0 && (
        <select
          className="input-base"
          style={{ width: 'auto', minWidth: '90px' }}
          value={filters.language}
          onChange={(e) => onChange({ ...filters, language: e.target.value })}
        >
          <option value="">Lingua</option>
          {languages.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      )}

      {hasActive && (
        <button className="btn-secondary text-sm" onClick={() => onChange(EMPTY_FILTERS)}>
          ✕ Reset
        </button>
      )}
    </div>
  )
}
