export const BOOK_STATUS = {
  read:      { label: 'Letto',       color: 'var(--success)' },
  reading:   { label: 'In lettura',  color: 'var(--accent)' },
  to_read:   { label: 'Da leggere',  color: 'var(--warning)' },
  abandoned: { label: 'Abbandonato', color: 'var(--danger)' },
}

export const SORT_OPTIONS = [
  { value: 'added_at',  label: 'Data aggiunta' },
  { value: 'title',     label: 'Titolo' },
  { value: 'author',    label: 'Autore' },
  { value: 'year',      label: 'Anno' },
  { value: 'genre',     label: 'Genere' },
  { value: 'publisher', label: 'Editore' },
  { value: 'rating',    label: 'Valutazione' },
]

export const GROUP_OPTIONS = [
  { value: '',          label: 'Nessuno' },
  { value: 'genre',     label: 'Genere' },
  { value: 'author',    label: 'Autore' },
  { value: 'status',    label: 'Stato' },
  { value: 'publisher', label: 'Editore' },
]

export function getCoverUrl(coverPath) {
  if (!coverPath) return null
  if (coverPath.startsWith('http://') || coverPath.startsWith('https://')) return coverPath
  return `/static/${coverPath}`
}

export function filterBooks(books, filters) {
  return books.filter((book) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!book.title?.toLowerCase().includes(q) && !book.author?.toLowerCase().includes(q)) return false
    }
    if (filters.genre    && book.genre     !== filters.genre)     return false
    if (filters.status   && book.status    !== filters.status)    return false
    if (filters.publisher && book.publisher !== filters.publisher) return false
    if (filters.language && book.language  !== filters.language)  return false
    return true
  })
}

export function sortBooks(books, sortBy, order) {
  return [...books].sort((a, b) => {
    const va = a[sortBy] ?? ''
    const vb = b[sortBy] ?? ''
    const cmp =
      typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'it', { sensitivity: 'base' })
    return order === 'asc' ? cmp : -cmp
  })
}

export function groupBooks(books, groupBy) {
  if (!groupBy) return { '': books }
  const groups = {}
  for (const book of books) {
    let key = book[groupBy]
    if (groupBy === 'status') key = BOOK_STATUS[key]?.label ?? key
    key = key || '—'
    if (!groups[key]) groups[key] = []
    groups[key].push(book)
  }
  return groups
}
