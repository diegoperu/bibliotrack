import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import FilterBar, { EMPTY_FILTERS } from '../components/ui/FilterBar'
import SortGroupBar from '../components/ui/SortGroupBar'
import BookGrid from '../components/books/BookGrid'
import BookListItem from '../components/books/BookList'
import { filterBooks, sortBooks, groupBooks } from '../lib/bookUtils'

export default function Library() {
  const [allBooks, setAllBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sortBy, setSortBy] = useState('added_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [groupBy, setGroupBy] = useState('')
  const [view, setView] = useState(() => localStorage.getItem('bt-view') || 'grid')

  useEffect(() => {
    client
      .get('/books/', { params: { limit: 200, sort_by: 'added_at', order: 'desc' } })
      .then(({ data }) => setAllBooks(data))
      .catch((e) => setError(e.response?.data?.detail || 'Errore nel caricamento'))
      .finally(() => setLoading(false))
  }, [])

  const handleView = (v) => {
    setView(v)
    localStorage.setItem('bt-view', v)
  }

  const filtered = useMemo(() => filterBooks(allBooks, filters), [allBooks, filters])
  const sorted   = useMemo(() => sortBooks(filtered, sortBy, sortOrder), [filtered, sortBy, sortOrder])
  const grouped  = useMemo(() => groupBooks(sorted, groupBy), [sorted, groupBy])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" style={{ color: 'var(--text-muted)' }}>
          <div className="text-3xl mb-2 animate-pulse">📚</div>
          <p>Caricamento libreria…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" style={{ color: 'var(--danger)' }}>
          <div className="text-3xl mb-2">⚠️</div>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (allBooks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center" style={{ color: 'var(--text-muted)' }}>
          <div className="text-6xl mb-4">📚</div>
          <p className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Libreria vuota
          </p>
          <p className="text-sm mb-5">Aggiungi il tuo primo libro per iniziare</p>
          <Link to="/add-book" className="btn-primary">
            ➕ Aggiungi libro
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* FAB mobile — pulsante aggiungi libro visibile senza aprire la sidebar */}
      <Link
        to="/add-book"
        className="md:hidden fixed bottom-6 right-6 z-10 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-2xl"
        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        aria-label="Aggiungi libro"
      >
        ＋
      </Link>

      <SortGroupBar
        sortBy={sortBy}
        sortOrder={sortOrder}
        groupBy={groupBy}
        view={view}
        onSortBy={setSortBy}
        onSortOrder={setSortOrder}
        onGroupBy={setGroupBy}
        onView={handleView}
        total={allBooks.length}
        filtered={sorted.length}
      />

      <FilterBar filters={filters} onChange={setFilters} allBooks={allBooks} />

      {sorted.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
          <p>Nessun libro corrisponde ai filtri attivi.</p>
        </div>
      )}

      {Object.entries(grouped).map(([groupName, books]) => (
        <div key={groupName}>
          {groupBy && (
            <h3
              className="text-xs font-semibold uppercase tracking-widest mt-5 mb-3 pb-2 border-b"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            >
              {groupName || '—'}
              <span className="ml-2 font-normal normal-case">({books.length})</span>
            </h3>
          )}

          {view === 'grid' ? (
            <BookGrid books={books} />
          ) : (
            <div className="space-y-2">
              {books.map((book) => (
                <BookListItem key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
