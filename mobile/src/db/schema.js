export const DB_NAME = 'bibliotrack'
export const DB_VERSION = 1

// Loan/Borrower tables are created from MOBILE-1 even though the loan UI
// itself ships in a later step — avoids a schema migration when it lands.
export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS books (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  isbn        TEXT,
  title       TEXT NOT NULL,
  author      TEXT NOT NULL,
  authors     TEXT,
  publisher   TEXT,
  edition     TEXT,
  year        INTEGER,
  language    TEXT,
  genre       TEXT,
  description TEXT,
  cover_path  TEXT,
  pages       INTEGER,
  rating      INTEGER,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'to_read',
  added_at    TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);

CREATE TABLE IF NOT EXISTS borrowers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  borrower_id INTEGER NOT NULL REFERENCES borrowers(id) ON DELETE RESTRICT,
  loaned_at   TEXT NOT NULL,
  returned_at TEXT,
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_loans_book ON loans(book_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id);
`
