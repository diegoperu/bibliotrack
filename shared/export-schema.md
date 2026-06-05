# BiblioTrack — Export Schema

Formato JSON per export/import dati tra versioni (selfhosted ↔ mobile)
e per backup su cloud storage (Drive/iCloud).

---

## Versioning

Il campo `schema_version` permette retrocompatibilità futura.
Quando si aggiungono campi al modello Book, incrementare `schema_version`
e documentare la migrazione qui sotto.

Regola: **la versione corrente deve saper leggere tutte le versioni precedenti.**

---

## Versione 1 (attuale)

### Struttura

```json
{
  "schema_version": 1,
  "exported_at": "2025-01-15T10:30:00Z",
  "source": "bibliotrack-web",
  "source_version": "1.0.0",
  "books": [ /* array di BookExport */ ]
}
```

### Campi header

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| `schema_version` | integer | ✅ | Sempre 1 per questa versione |
| `exported_at` | string ISO 8601 | ✅ | UTC, con timezone |
| `source` | string | ✅ | `"bibliotrack-web"` o `"bibliotrack-mobile"` |
| `source_version` | string | ❌ | Versione app che ha generato l'export |
| `books` | array | ✅ | Può essere array vuoto `[]` |

### Struttura BookExport

```json
{
  "isbn": "9788845292682",
  "isbn10": null,
  "title": "Il nome della rosa",
  "author": "Eco, Umberto",
  "authors": [
    { "name": "Eco, Umberto", "role": "author" }
  ],
  "publisher": "Bompiani",
  "edition": null,
  "year": 1980,
  "language": "ita",
  "genre": "Romanzo storico",
  "description": "Un monaco medievale indaga...",
  "pages": 502,
  "cover_url": "https://covers.openlibrary.org/b/isbn/9788845292682-L.jpg",
  "rating": 5,
  "notes": "Riletto per la terza volta.",
  "status": "read",
  "added_at": "2024-11-01T09:00:00Z",
  "updated_at": "2024-11-15T14:30:00Z"
}
```

### Campi BookExport

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| `isbn` | string \| null | ❌ | ISBN-13, solo cifre |
| `isbn10` | string \| null | ❌ | ISBN-10, solo cifre |
| `title` | string | ✅ | |
| `author` | string \| null | ❌ | Display string "Cognome, Nome" |
| `authors` | array \| null | ❌ | Lista strutturata `[{name, role}]` |
| `publisher` | string \| null | ❌ | |
| `edition` | string \| null | ❌ | Es. "2a edizione" |
| `year` | integer \| null | ❌ | Anno pubblicazione |
| `language` | string \| null | ❌ | Codice ISO 639-2 es. `"ita"`, `"eng"` |
| `genre` | string \| null | ❌ | |
| `description` | string \| null | ❌ | |
| `pages` | integer \| null | ❌ | |
| `cover_url` | string \| null | ❌ | URL esterno — non path locale |
| `rating` | integer \| null | ❌ | 1-5 |
| `notes` | string \| null | ❌ | Note private utente |
| `status` | string | ✅ | Enum: `"to_read"`, `"reading"`, `"read"`, `"abandoned"` |
| `added_at` | string ISO 8601 | ✅ | UTC |
| `updated_at` | string ISO 8601 \| null | ❌ | UTC |

### Campi ESCLUSI dall'export (intenzionalmente)

| Campo | Motivo |
|-------|--------|
| `id` | Auto-generato dal DB locale — non trasportabile |
| `owner_id` | Multi-user selfhosted — non esiste su mobile |
| `cover_path` | Path locale server — inutile su altro sistema |

Le copertine vengono ri-scaricate dall'`isbn` al momento dell'import,
usando `cover_url` come fallback se il download ISBN fallisce.

---

## Regole di import

### Deduplicazione

All'import, un libro è considerato duplicato se:
1. `isbn` non null e coincide con un libro esistente, **oppure**
2. `isbn` è null e `title` + `author` coincidono esattamente (case-insensitive)

In caso di duplicato: **skip silenzioso** (non sovrascrivere, non errore).
L'utente viene informato del numero di libri saltati a fine import.

### Campi mancanti

Se un campo opzionale è assente dal JSON, viene importato come `null`.
Mai errore per campi opzionali mancanti.

### `status` non valido

Se `status` contiene un valore non riconosciuto, importa come `"to_read"`.

### Versioni future (schema_version > 1)

Se il file importato ha `schema_version` superiore alla versione supportata
dall'app, mostrare avviso: "Il file è stato creato con una versione più recente
di BiblioTrack. Alcuni campi potrebbero non essere importati correttamente."
Procedere comunque con i campi noti.

---

## Changelog versioni schema

| Versione | Data | Modifiche |
|----------|------|-----------|
| 1 | 2025-01 | Versione iniziale |
| 2 | 2026-06 | Aggiunto array `loans` per BookExport; aggiunto array `borrowers` a livello root |

---

## Versione 2 (con prestiti)

### Modifiche rispetto a v1

**Header:** aggiunto campo opzionale `borrowers` (array di nomi distinti).

**BookExport:** aggiunto campo opzionale `loans` (array di LoanExport).

### Struttura LoanExport

```json
{
  "borrower_name": "Mario Rossi",
  "loaned_at": "2025-03-01T00:00:00Z",
  "returned_at": "2025-04-15T00:00:00Z",
  "notes": null
}
```

I Borrower non vengono esportati come entità separate — sono derivabili
aggregando i `borrower_name` dai loan di tutti i libri.

All'import, per ogni `borrower_name` unico trovato nei loan,
creare il Borrower corrispondente se non esiste (normalizzando il nome).

### Campi LoanExport

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| `borrower_name` | string | ✅ | display_name al momento del prestito |
| `loaned_at` | string ISO 8601 | ✅ | UTC |
| `returned_at` | string ISO 8601 \| null | ❌ | null = prestito ancora attivo |
| `notes` | string \| null | ❌ | |

---

## Implementazione selfhosted (STEP futuro)

Aggiungere a `backend/routers/books.py`:

```
GET  /books/export        → scarica JSON export di tutti i propri libri
POST /books/import        → importa JSON, ritorna {imported, skipped, errors}
```

Nessuna modifica al modello DB — l'export è una proiezione dei dati esistenti.

## Implementazione mobile (STEP MOBILE-3)

Aggiungere a `mobile/src/export/`:
- `exportLibrary.js` → genera JSON, salva su filesystem device
- `importLibrary.js` → legge JSON, inserisce in SQLite locale
- `cloudBackup.js`   → upload/download da Drive o iCloud
