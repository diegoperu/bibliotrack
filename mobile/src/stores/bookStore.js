import { create } from 'zustand'
import { getDB, initDatabase } from '../db/database'

function rowToBook(row) {
  return { ...row, authors: row.authors ? JSON.parse(row.authors) : null }
}

function nowIso() {
  return new Date().toISOString()
}

const UPDATABLE_COLUMNS = new Set([
  'isbn', 'title', 'author', 'authors', 'publisher', 'edition', 'year', 'language',
  'genre', 'description', 'cover_path', 'pages', 'rating', 'notes', 'status', 'updated_at',
])

const useBookStore = create((set, get) => ({
  books: [],
  loading: true,
  error: null,

  init: async () => {
    set({ loading: true, error: null })
    try {
      await initDatabase()
      const db = getDB()
      const res = await db.query('SELECT * FROM books ORDER BY added_at DESC')
      set({ books: (res.values || []).map(rowToBook), loading: false })
    } catch (e) {
      set({ error: e.message || 'Errore caricamento libreria', loading: false })
    }
  },

  getById: (id) => get().books.find((b) => String(b.id) === String(id)) || null,

  addBook: async (fields) => {
    const db = getDB()
    const now = nowIso()
    const book = {
      isbn: null, authors: null, publisher: null, edition: null, year: null,
      language: null, genre: null, description: null, cover_path: null,
      pages: null, rating: null, notes: null, status: 'to_read',
      ...fields,
      added_at: now, updated_at: now,
    }
    const authorsJson = book.authors ? JSON.stringify(book.authors) : null
    const res = await db.run(
      `INSERT INTO books (isbn, title, author, authors, publisher, edition, year, language,
         genre, description, cover_path, pages, rating, notes, status, added_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        book.isbn, book.title, book.author, authorsJson, book.publisher, book.edition, book.year,
        book.language, book.genre, book.description, book.cover_path, book.pages, book.rating,
        book.notes, book.status, book.added_at, book.updated_at,
      ]
    )
    const id = res.changes?.lastId
    const created = { ...book, id }
    set((s) => ({ books: [created, ...s.books] }))
    return created
  },

  updateBook: async (id, fields) => {
    const db = getDB()
    const updated_at = nowIso()
    const entries = Object.entries({ ...fields, updated_at }).filter(([k]) => UPDATABLE_COLUMNS.has(k))
    const assignments = entries.map(([k]) => `${k} = ?`).join(', ')
    const values = entries.map(([k, v]) => (k === 'authors' && v ? JSON.stringify(v) : v))
    await db.run(`UPDATE books SET ${assignments} WHERE id = ?`, [...values, id])
    set((s) => ({
      books: s.books.map((b) => (b.id === id ? { ...b, ...fields, updated_at } : b)),
    }))
  },

  deleteBook: async (id) => {
    const db = getDB()
    await db.run('DELETE FROM books WHERE id = ?', [id])
    set((s) => ({ books: s.books.filter((b) => b.id !== id) }))
  },
}))

export default useBookStore
