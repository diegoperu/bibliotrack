# BiblioTrack — Claude Code Master File

> Aggiorna questo file al termine di ogni step completato.
> Questo è il punto di ingresso per ogni nuova sessione Claude Code.
> Dopo ogni step esegui un check di sicurezza per verificare se ci sono criticità riconosciute e correggile prima di passare allo step successivo.

---

## Progetto

**BiblioTrack** — Web app per catalogare libri personali.
- Scansione ISBN da fotocamera (mobile-first, funziona anche su desktop)
- Lookup automatico metadati + copertina via Open Library API (+ fallback)
- Gestione utenti: `admin` (gestisce tutto) / `user` (gestisce solo i propri libri)
- UI ispirata a Calibre-web
- 4 temi: light / dark / catppuccin-light / catppuccin-dark
- Filtra, raggruppa, ordina per: autore, genere, editore, edizione, data inserimento

---

## Stack Tecnologico

| Layer | Tecnologia |
|---|---|
| Backend | Python 3.11+ / FastAPI |
| ORM | SQLAlchemy 2.x |
| Database | SQLite (WAL mode) |
| Auth | JWT (python-jose) + bcrypt (diretto, passlib rimosso) |
| Frontend | React 18 + Vite + TailwindCSS 3 |
| Camera/ISBN | BarcodeDetector API + QuaggaJS (fallback iOS) |
| Metadata ISBN | OPAC SBN via isbnlib-sbn (primario IT) + Open Library API + Google Books API + IBS.it Algolia (fallback IT) |
| Copertine | Open Library Covers API + scraping fallback |
| Server | Nginx reverse proxy + systemd |
| Python deps | `uv` (package manager consigliato) |

---

## Struttura Directory

```
bibliotrack/
├── CLAUDE.md                  ← questo file (aggiorna ogni step)
├── README.md                  ← istruzioni installazione/uso
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── book.py
│   │   └── loan.py            ← Borrower + Loan
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── books.py
│   │   ├── users.py
│   │   ├── isbn.py
│   │   └── loans.py           ← GET/POST /loans, GET/PUT /loans/*, GET /loans/borrowers/*
│   ├── services/
│   │   ├── __init__.py
│   │   ├── isbn_lookup.py     ← Open Library + fallback
│   │   ├── cover_download.py
│   │   └── auth_service.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── book.py
│   │   └── loan.py            ← BorrowerOut, BorrowerSuggestion, LoanOut, LoanCreate, LoanReturn, BorrowerDetail, loan_to_out()
│   ├── middleware/
│   │   └── auth.py
│   ├── static/
│   │   └── covers/            ← copertine scaricate
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_books.py
│   │   ├── test_isbn.py
│   │   └── test_loans.py      ← 18 test prestiti
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   ├── public/
│   │   ├── favicon.ico            ← 32×32 browser tab
│   │   ├── apple-touch-icon.png   ← 180×180 iOS home screen
│   │   ├── icon-192.png           ← 192×192 PWA Android
│   │   ├── icon-512.png           ← 512×512 PWA splash + sorgente icone
│   │   └── manifest.webmanifest   ← PWA manifest
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── client.js      ← axios instance + interceptors
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.jsx
│       │   │   ├── Header.jsx
│       │   │   └── Layout.jsx
│       │   ├── books/
│       │   │   ├── BookCard.jsx
│       │   │   ├── BookGrid.jsx
│       │   │   ├── BookList.jsx
│       │   │   ├── BookDetail.jsx
│       │   │   └── AddBookModal.jsx
│       │   ├── loans/
│       │   │   └── LoanModal.jsx      ← modal presta libro + autocomplete borrower
│       │   ├── scanner/
│       │   │   ├── ISBNScanner.jsx   ← camera component
│       │   │   └── ManualEntry.jsx
│       │   └── ui/
│       │       ├── ThemeSwitcher.jsx
│       │       ├── FilterBar.jsx
│       │       └── SortGroupBar.jsx
│       ├── pages/
│       │   ├── Library.jsx
│       │   ├── Login.jsx
│       │   ├── BookDetail.jsx
│       │   ├── AddBook.jsx
│       │   ├── Loans.jsx              ← tab Attivi + tab Per persona
│       │   └── Admin.jsx
│       ├── stores/
│       │   ├── authStore.js   ← Zustand
│       │   └── themeStore.js
│       └── styles/
│           ├── themes.css     ← CSS variables per 4 temi
│           └── index.css
├── deploy/
│   ├── bibliotrack.service    ← systemd unit (con hardening)
│   ├── nginx.conf             ← nginx reverse proxy + CSP headers
│   ├── setup.sh               ← script installazione server
│   └── backup.sh              ← backup SQLite giornaliero
├── docker/
│   ├── icon.png               ← 128×128 icona Unraid Docker UI
│   ├── nginx-internal.conf    ← nginx interno container (porta 8080)
│   ├── supervisord.conf       ← process manager (nginx + uvicorn)
│   ├── entrypoint.sh          ← startup: check SECRET_KEY, crea admin, avvia supervisor
│   ├── build-and-push.sh      ← build multi-arch + push ghcr.io
│   └── unraid-template.xml    ← template Unraid Community Apps
├── Dockerfile                 ← multi-stage: node build + python runtime
├── docker-compose.yml         ← test locale
├── DOCKER-UNRAID.md           ← guida deploy Unraid
├── DOCKER-CLAUDECODE.md       ← note operative per Claude Code
├── shared/                        ← contratti condivisi selfhosted/mobile
│   ├── MOBILE-ROADMAP.md          ← architettura e roadmap versione mobile
│   ├── export-schema.md           ← specifica formato export JSON versionato
│   └── export-schema.v1.json      ← JSON Schema formale draft-07
└── .gitignore
```

---

## Step di Sviluppo

### ✅ STEP 0 — Scaffolding & Pianificazione
- [x] Struttura directory definita e creata
- [x] CLAUDE.md creato
- [x] README.md creato
- [x] Directory fisiche create
- [x] Backend: config.py, database.py (WAL mode), models (User + Book), schemas (Pydantic), services (auth, isbn_lookup, cover_download), routers (auth, books, users, isbn), main.py
- [x] Frontend: package.json, vite.config.js, tailwind.config.js, temi CSS (4 temi completi), stores (auth + theme Zustand), api/client.js (axios + JWT interceptors), App.jsx, main.jsx
- [x] Deploy: systemd service, nginx.conf, setup.sh
- [x] .gitignore, .env.example

### ✅ STEP 1 — Backend Core
**Obiettivo:** API funzionante con auth + CRUD libri base

Tasks:
- [x] Setup FastAPI + SQLAlchemy + SQLite WAL
- [x] Modelli DB: User, Book
- [x] Auth: login, JWT, refresh (register rimosso — vedi audit sicurezza)
- [x] CRUD books (con permessi admin/user)
- [x] Schema Pydantic completo
- [x] Endpoint health check

Files creati:
`backend/main.py`, `backend/config.py`, `backend/database.py`,
`backend/models/*`, `backend/routers/auth.py`, `backend/routers/books.py`,
`backend/routers/users.py`, `backend/routers/isbn.py`, `backend/schemas/*`,
`backend/services/auth_service.py`, `backend/middleware/auth.py`,
`backend/requirements.txt`, `backend/pytest.ini`, `backend/tests/*`

Note tecniche:
- passlib rimosso: incompatibile con bcrypt 4.x su Python 3.14 — sostituito con bcrypt diretto
- Test: 35/35 passed post-audit (`cd backend && python -m pytest`)
- Uvicorn: `cd backend && uvicorn main:app --reload`

---

### ✅ STEP 2 — ISBN Lookup Service
**Obiettivo:** Dato un ISBN, ritorna metadati + URL copertina

Tasks:
- [x] `isbn_lookup.py`: Open Library `/api/books` + `/search.json`
- [x] Gestione lingua italiana (campo `language`)
- [x] Fallback Google Books API (no auth, public endpoint)
- [x] `cover_download.py`: scarica copertina, salva in `static/covers/`
- [x] Endpoint `GET /isbn/{code}` → metadati
- [x] Endpoint `POST /isbn/{code}/import` → crea libro nel DB + opzioni (status, rating, notes, genre)

Note tecniche:
- Cascade lookup: SBN (solo ISBN italiani 978-88/979-12) → OpenLibrary /api/books → /search.json → Google Books
- ISBN normalizzato (rimuove trattini/spazi), validato (10 o 13 cifre)
- Cover download: OpenLibrary cover → fallback URL; skip se < 1KB (placeholder)
- Test: 34/34 passed (tutti mockati, nessuna chiamata HTTP reale)

Note API Open Library:
```
# Lookup per ISBN
GET https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&jscmd=data&format=json

# Covers
GET https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg

# Search (fallback per ISBN non trovati direttamente)
GET https://openlibrary.org/search.json?isbn={isbn}
```

Fallback Google Books (no key):
```
GET https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}
```

---

### ✅ STEP 3 — Frontend Base + Auth
**Obiettivo:** App React funzionante con login e routing

Tasks:
- [x] Setup Vite + React + TailwindCSS
- [x] Zustand stores (auth, theme)
- [x] 4 temi CSS (light/dark/catppuccin-light/catppuccin-dark)
- [x] Pagina Login
- [x] Layout Calibre-web style (sidebar + header + main)
- [x] Routing: react-router-dom v6
- [x] Axios client con JWT interceptor

Files creati:
`frontend/package.json`, `frontend/vite.config.js`, `frontend/tailwind.config.js`,
`frontend/postcss.config.js`, `frontend/index.html`,
`frontend/src/main.jsx`, `frontend/src/App.jsx`,
`frontend/src/api/client.js`,
`frontend/src/stores/authStore.js`, `frontend/src/stores/themeStore.js`,
`frontend/src/styles/themes.css`, `frontend/src/styles/index.css`,
`frontend/src/pages/Login.jsx`, `frontend/src/pages/Library.jsx`,
`frontend/src/pages/AddBook.jsx`, `frontend/src/pages/BookDetail.jsx`,
`frontend/src/pages/Admin.jsx`,
`frontend/src/components/layout/Layout.jsx`, `frontend/src/components/layout/Sidebar.jsx`,
`frontend/src/components/layout/Header.jsx`,
`frontend/src/components/ui/ThemeSwitcher.jsx`

Note tecniche:
- Build: `cd frontend && npm run build` → 112 modules, clean (no errors)
- Dev: `cd frontend && npm run dev` → proxy Vite → backend :8000
- Anti-FOUC: inline script in index.html legge theme da localStorage prima di React
- Refresh token: interceptor axios con coda per richieste parallele durante refresh
- ProtectedRoute: adminOnly redirect a /library se non admin

---

### ✅ STEP 4 — Libreria & Visualizzazione
**Obiettivo:** Pagina principale con griglia libri

Tasks:
- [x] `Library.jsx`: grid + list view (toggle persistito in localStorage)
- [x] `BookCard.jsx`: copertina 2:3, status badge overlay, genere, rating
- [x] `BookList.jsx`: vista lista con thumbnail + metadati
- [x] `BookGrid.jsx`: grid auto-fill minmax(140px)
- [x] FilterBar: search (title+author client-side), status, genere, editore, lingua
- [x] SortGroupBar: sort select + order toggle + group by + view toggle + contatore
- [x] `BookDetail.jsx`: dettaglio completo + edit inline (status/rating/note auto-save) + form modifica + delete con conferma
- [x] Responsive: sidebar collassabile su mobile (hamburger)

Files creati/modificati:
`frontend/src/lib/bookUtils.js`,
`frontend/src/components/books/BookCard.jsx`,
`frontend/src/components/books/BookList.jsx`,
`frontend/src/components/books/BookGrid.jsx`,
`frontend/src/components/ui/FilterBar.jsx`,
`frontend/src/components/ui/SortGroupBar.jsx`,
`frontend/src/pages/Library.jsx` (rewrite),
`frontend/src/pages/BookDetail.jsx` (rewrite),
`frontend/src/components/layout/Layout.jsx` (mobile sidebar),
`frontend/src/components/layout/Header.jsx` (hamburger)

Note tecniche:
- Fetch 200 libri in singola call, tutto client-side (filtro, sort, group)
- groupBooks: converte status key → label italiana per i group header
- PATCH auto-save su status e rating; note salvo esplicito solo se dirty
- StarRating: click stessa stella = clear (null rating)

---

### ✅ STEP 5 — Scanner ISBN
**Obiettivo:** Scansione camera + inserimento manuale

Tasks:
- [x] `ISBNScanner.jsx`: BarcodeDetector API (Chrome/Edge/Android)
- [x] Fallback `@ericblade/quagga2` per iOS Safari (dynamic import → chunk separato 155KB)
- [x] Permesso camera graceful: requesting / denied / error states
- [x] Preview live + viewfinder overlay + found flash
- [x] `ManualEntry.jsx`: input ISBN con validazione (10/13 cifre, strip trattini)
- [x] `AddBookModal.jsx`: portal modal — flow completo (choose → scan/isbn/manual → lookup → preview → import)
- [x] `StarRating.jsx`: componente shared (usato da AddBookModal e BookDetail)
- [x] Modalità inserimento manuale completa: tutti i campi + status/rating/notes
- [x] `AddBook.jsx`: page che monta il modal, onSaved → /books/:id

Files creati:
`frontend/src/components/ui/StarRating.jsx`,
`frontend/src/components/scanner/ISBNScanner.jsx`,
`frontend/src/components/scanner/ManualEntry.jsx`,
`frontend/src/components/books/AddBookModal.jsx`,
`frontend/src/pages/AddBook.jsx` (rewrite)

Note tecniche:
- Quagga2 dynamic import → Vite auto-split chunk, caricato solo su iOS (no BarcodeDetector)
- createPortal su document.body → modal si attacca fuori dal DOM del layout
- lookupError mostrato inline nello step scan/isbn-search (non interrompe il flusso)
- Back button: scan/isbn-search/manual → choose; preview → prevStep (scan o isbn-search)
- Bottom-sheet su mobile (sm:rounded-modal), border-radius solo top su mobile

---

### ✅ STEP 6 — Admin Panel
**Obiettivo:** Pannello admin per gestione utenti e contenuti

Tasks:
- [x] `Admin.jsx`: 3 tab (Statistiche | Utenti | Tutti i libri)
- [x] Lista utenti + toggle active/inactive + toggle role user↔admin
- [x] Vista "tutti i libri" con filtro per utente (reusa FilterBar/SortGroupBar/BookGrid)
- [x] Creazione utente da admin (modal porta con form)
- [x] Reset password utente (modal — POST /users/{id}/admin-reset-password)
- [x] Statistiche: stat card 6 metriche + bar chart generi + bar chart per utente
- [x] Backend: aggiunto endpoint `POST /users/{id}/admin-reset-password` (admin-only)

Files modificati:
`frontend/src/pages/Admin.jsx` (full rewrite),
`backend/routers/users.py` (aggiunto admin-reset-password endpoint)

---

### ✅ STEP 7 — Deploy
**Obiettivo:** Setup server pronto per produzione

Tasks:
- [x] `deploy/setup.sh`: installazione automatica (apt/dnf, venv, build, systemd, nginx, cron backup, admin interattivo)
- [x] `deploy/bibliotrack.service`: systemd unit con hardening (NoNewPrivileges, PrivateTmp, ProtectSystem)
- [x] `deploy/nginx.conf`: reverse proxy + cache copertine + SPA fallback + gzip + security headers
- [x] `deploy/backup.sh`: sqlite3 .backup hot-copy, keep 30gg, cron automatico
- [x] `backend/.env.example`: variabili documentate
- [x] Build frontend produzione: `npm run build` (già testato, 126 moduli)
- [x] README.md: completo — quick start, installazione prod, gestione servizio, backup, utilizzo, API

---

### ✅ STEP 8 — Dockerizzazione + Unraid
**Obiettivo:** Container Docker single-image pronto per Unraid

File creati/aggiornati:
- `Dockerfile` — multi-stage: node:20-alpine build + python:3.11-slim runtime + nginx; VITE_API_URL=/api
- `docker-compose.yml` — test locale con volume ./data e env vars
- `docker/nginx-internal.conf` — nginx porta 8080; /api/ → uvicorn:8000/ (strip prefix); covers da /data/covers
- `docker/supervisord.conf` — supervisor gestisce nginx + uvicorn in foreground
- `docker/entrypoint.sh` — mkdir /data/db|covers; check SECRET_KEY; crea admin se ADMIN_PASSWORD+DB nuovo
- `docker/build-and-push.sh` — buildx multi-arch (amd64+arm64) push su ghcr.io
- `docker/unraid-template.xml` — template Community Apps Unraid
- `DOCKER-UNRAID.md` — guida utente completa
- `frontend/src/pages/Login.jsx` — bugfix: `axios` → `client` (serve per VITE_API_URL=/api)

Note tecniche:
- VITE_API_URL bake-in build-time: dev='' (vite proxy), Docker='/api' (nginx strip)
- entrypoint.sh crea admin via Python inline su primo avvio (DB vuoto + ADMIN_PASSWORD set)
- COVERS_DIR e DATABASE_URL defaultano a /data/ in entrypoint se non overridden
- Unraid: 1 volume /data, porta 8080, SECRET_KEY obbligatoria

---

### ✅ AUDIT SICUREZZA — Post STEP 8
**Obiettivo:** Verifica standard minimi di sicurezza per uso in produzione

Vulnerabilità trovate e corrette:

| Gravità | Problema | Fix applicato |
|---|---|---|
| 🔴 CRITICO | `/auth/register` aperto — chiunque poteva creare admin | Endpoint **rimosso**; utenti creati solo via admin panel o entrypoint |
| 🔴 CRITICO | `role` settabile da client non autenticato nel payload register | Rimosso con l'endpoint |
| 🟠 ALTO | Refresh token passato come query param URL → loggato in nginx | `POST /auth/refresh` ora accetta `{ "token": "..." }` nel body JSON |
| 🟠 ALTO | Nessun minimo lunghezza password → password vuote accettate | Validator Pydantic: min 8 caratteri su `UserCreate`, `PasswordChange`, `AdminPasswordReset` |
| 🟠 ALTO | `SECRET_KEY` default non validata a runtime | Config validator: rifiuta chiavi < 32 char; `main.py` logga warning se default insicuro |
| 🟠 ALTO | `axios.post('/auth/refresh')` usava URL assoluto senza `VITE_API_URL` → 502 in Docker | `client.js`: usa `${API_BASE}/auth/refresh` con `API_BASE = import.meta.env.VITE_API_URL \|\| ''` |
| 🟡 MEDIO | Security headers mancanti in nginx Docker | CSP, Permissions-Policy aggiunti a `docker/nginx-internal.conf` e `deploy/nginx.conf` |
| 🟡 MEDIO | CORS origins hardcoded a localhost | `config.py`: `CORS_ORIGINS` configurabile via env var |

Accettabili (non corretti — app domestica):
- Token in `localStorage` (XSS vector teorico; fix richiederebbe httpOnly cookies)
- No rate limiting su `/auth/login` (brute force; richiederebbe Redis)
- No HTTPS di default (documentato — attivare con certbot)

Files modificati:
`backend/routers/auth.py` (rimosso /register, /refresh → body),
`backend/schemas/user.py` (password validator min 8),
`backend/routers/users.py` (password validator su AdminPasswordReset),
`backend/config.py` (CORS_ORIGINS, SECRET_KEY validator),
`backend/main.py` (CORS da config, warning SECRET_KEY default),
`frontend/src/api/client.js` (refresh usa API_BASE + body),
`docker/nginx-internal.conf` (CSP + security headers),
`deploy/nginx.conf` (CSP + security headers),
`deploy/setup.sh` (admin creation via Python, non curl /register),
`backend/tests/*` (35/35 pass — test aggiornati, rimosso test /register, aggiunto test refresh body)

---

## Modello Dati

### User
```python
id: int (PK)
username: str (unique)
email: str (unique)
hashed_password: str
role: enum('admin', 'user')
is_active: bool
created_at: datetime
last_login: datetime
```

### Book
```python
id: int (PK)
isbn: str (nullable, indexed)
title: str
author: str              # "Cognome, Nome" o multipli
authors: JSON            # lista autori strutturata
publisher: str
edition: str
year: int
language: str
genre: str
description: text
cover_path: str          # path locale o URL esterno
pages: int
rating: int (1-5, nullable)  # valutazione personale
notes: text              # note private utente
status: enum('read', 'reading', 'to_read', 'abandoned')
added_at: datetime
updated_at: datetime
owner_id: int (FK → User)
loans: relationship(Loan)  # derivato, non campo DB
```

### Borrower
```python
id: int (PK)
name: str (lowercase+strip, unique per owner)  # usato per dedup
display_name: str                               # come inserito dall'utente
owner_id: int (FK → User, CASCADE)
created_at: datetime
# indice unico: (name, owner_id)
```

### Loan
```python
id: int (PK)
book_id: int (FK → Book, CASCADE)    # eliminazione libro → elimina loan
borrower_id: int (FK → Borrower, RESTRICT)  # non si elimina borrower con loan
owner_id: int (FK → User, CASCADE)
loaned_at: datetime
returned_at: datetime (nullable)     # NULL = prestito attivo
notes: text (nullable)
```

---

## Permessi

| Azione | admin | user |
|---|---|---|
| CRUD propri libri | ✅ | ✅ |
| CRUD libri altrui | ✅ | ❌ |
| Gestione utenti | ✅ | ❌ |
| Vista tutti i libri | ✅ | ❌ |
| Cambio tema | ✅ | ✅ |

---

## Temi CSS (variabili root)

### Light (brillante)
```css
--bg-primary: #ffffff
--bg-secondary: #f0f4f8
--accent: #2563eb
--text-primary: #1e293b
```

### Dark (pastello)
```css
--bg-primary: #1e1e2e
--bg-secondary: #181825
--accent: #89b4fa
--text-primary: #cdd6f4
```

### Catppuccin Light (Latte)
```css
--bg-primary: #eff1f5
--bg-secondary: #e6e9ef
--accent: #1e66f5
--text-primary: #4c4f69
```

### Catppuccin Dark (Mocha)
```css
--bg-primary: #1e1e2e
--bg-secondary: #181825
--accent: #cba6f7
--text-primary: #cdd6f4
```

---

### ✅ STEP 9 — ISBN Lookup: fallback IBS.it + logging cascade
**Obiettivo:** Coprire ISBN italiani non presenti in SBN/OpenLibrary/Google Books

Tasks:
- [x] Level 5 cascade: query Algolia di IBS.it (chiavi pubbliche embedded nel loro frontend JS)
- [x] Parser `_parse_ibs_algolia_hit`: titolo, autori, editore, anno, copertina 400px, genere
- [x] Match esatto per EAN (la query Algolia è fuzzy — filtro anti falsi positivi)
- [x] Logging dettagliato a ogni livello del cascade (livello, source, hit/miss/error, elapsed)
- [x] Log ERROR finale con sommario di tutti i livelli se lookup fallisce
- [x] Messaggio errore 404 frontend aggiornato: cita solo Open Library e Google Books
- [x] 40/40 test pass

Files modificati:
`backend/services/isbn_lookup.py` (Level 5 Algolia, logging cascade completo),
`backend/routers/isbn.py` (log 404 esplicito, detail message coerente),
`frontend/src/components/books/AddBookModal.jsx` (errore 404 aggiornato)

Note tecniche:
- IBS.it è SPA React: il contenuto ricerca è caricato via Algolia, non nell'HTML iniziale → JSON-LD scraping inutile
- Algolia AppID: `FBVFK8AIGY`, API key: `460ca8aeaa21b30a35784e7125bfca37`, index: `prd_IBS`
- Cover URL pattern IBS: `https://www.ibs.it/images/{isbn}_0_0_400_0_0.jpg`
- Language hardcoded a `ita` per tutti i risultati IBS (catalogo solo italiano)
- IBS non è citato nell'UI — se trova il libro appare normalmente; se fallisce l'utente vede solo "Open Library / Google Books"
- Filter Algolia: `productType:ITBOOK` per escludere ebook e accessori

### ✅ FIX — Scanner barcode Android (BarcodeDetector)
**Problema:** Camera si avviava ma non rilevava mai barcode; nessun autofocus al cambiamento distanza.

Root cause e fix:

| Causa | Fix |
|---|---|
| Nessun autofocus continuo | `track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })` dopo stream acquisito |
| `BarcodeDetector.detect(<video>)` inaffidabile su Android | Canvas off-screen: `drawImage(video)` → `detect(canvas)` (frame statico più affidabile) |
| RAF a 60fps: detect() flood impedisce focus | Throttle 250ms + `scanActiveRef` per evitare detect() sovrapposti |
| `facingMode: 'environment'` hard fallisce su alcuni device | Cambiato in `{ ideal: 'environment' }` |
| `play()` chiamato prima di `loadedmetadata` | Attende evento `loadedmetadata` → videoWidth/videoHeight validi all'avvio loop |

Files modificati:
`frontend/src/components/scanner/ISBNScanner.jsx` (solo path BarcodeDetector; QuaggaJS invariato)

Note tecniche:
- Canvas ref aggiunto (`canvasRef`) — nascosto nell'UI, usato solo per snapshot
- `scanActiveRef` previene chiamate detect() post-cleanup (race condition su unmount)
- Build: 126 moduli, no errori

---

### ✅ FIX — Scanner barcode Firefox/iOS (QuaggaJS)
**Problema:** Stessi sintomi del fix BarcodeDetector — camera attiva ma nessuna detection, nessun autofocus.

Root cause e fix:

| Causa | Fix |
|---|---|
| Nessun autofocus continuo | Dopo `Quagga.start()`: trova `<video>` iniettato da Quagga in `containerRef` → `applyConstraints({ focusMode: continuous })` sul track |
| Scan a framerate nativo (30-60fps) → CPU flood, no focus | `frequency: 5` nella config Quagga → ~5 frame/sec |
| `numOfWorkers: 0` → main thread bloccato ad ogni frame | `Math.min(navigator.hardwareConcurrency, 2)` worker quando disponibili |

Files modificati:
`frontend/src/components/scanner/ISBNScanner.jsx` (solo path QuaggaJS; BarcodeDetector invariato)

Note tecniche:
- Autofocus applicato tramite DOM (`containerRef.querySelector('video')`) — non dipende da API interne Quagga
- Aggiunti `width/height: { ideal: 1280/720 }` ai constraints Quagga per compatibilità camera Android
- Build: 126 moduli, no errori

### ✅ FIX — Scanner barcode: misread prima cifra + ISBN in messaggio errore
**Problema:** Scanner leggeva barcode errato (prima cifra sbagliata, es. 9→7, 9→0). ISBN non visibile nel messaggio di errore 404.

Root cause e fix:

| Causa | Fix |
|---|---|
| Frame mosso/sfocato produce prima cifra errata | Validazione checksum EAN-13/EAN-8/ISBN-10 — un digit sbagliato rompe quasi sempre il checksum → scartato subito |
| Singolo frame scorretto supera checksum | 2 letture consecutive identiche (`CONFIRM_NEEDED=2`) richieste prima di accettare |
| ISBN non visibile in caso di errore lookup | Messaggio 404 aggiornato: `"ISBN {isbn} non trovato…"` per verifica manuale |

Verifica: `_validateEAN13('7788809935358')` → `false`, `_validateEAN13('9788809935358')` → `true`

Files modificati:
`frontend/src/components/scanner/ISBNScanner.jsx` (checksum + confirm, entrambi i path),
`frontend/src/components/books/AddBookModal.jsx` (ISBN nel messaggio 404)

Note tecniche:
- `isValidChecksum()`: dispatcher su EAN-13 / EAN-8 / ISBN-10 in base alla lunghezza
- `lastCodeRef` + `confirmRef` resettati in cleanup per evitare stato stale
- Delay aggiunto: ~500ms BarcodeDetector (2×250ms), ~400ms Quagga (2×200ms a 5fps)
- Build: 126 moduli, no errori

### ✅ STEP 10 — Icone + PWA Manifest
**Obiettivo:** Favicon browser, icona home screen iOS/Android, PWA manifest, icona Docker Unraid

Tasks:
- [x] Resize icone da sorgente 1024×512px con Pillow (ImageMagick non disponibile su Windows)
- [x] `frontend/public/icon-512.png` — 512×512 PWA splash + sorgente
- [x] `frontend/public/icon-192.png` — 192×192 PWA Android
- [x] `frontend/public/apple-touch-icon.png` — 180×180 iOS home screen
- [x] `frontend/public/favicon.ico` — 32×32 browser tab
- [x] `frontend/public/manifest.webmanifest` — PWA standalone, theme_color #cba6f7, background #1e1e2e
- [x] `docker/icon.png` — 128×128 icona Unraid Docker UI
- [x] `frontend/index.html` — meta description, theme-color, favicon, apple-touch-icon, manifest link
- [x] `docker/unraid-template.xml` — `<Icon>` URL aggiornato a `diegoperu/bibliotrack`
- [x] Build: 126 moduli, no errori; tutti i file presenti in `dist/`

Files creati/modificati:
`frontend/public/favicon.ico`, `frontend/public/icon-192.png`, `frontend/public/icon-512.png`,
`frontend/public/apple-touch-icon.png`, `frontend/public/manifest.webmanifest`,
`docker/icon.png`, `frontend/index.html`, `docker/unraid-template.xml`

Note tecniche:
- ImageMagick assente su Windows → usato Pillow (`pip install Pillow` su Python 3.14 locale)
- Anti-FOUC script in `index.html` preservato intatto
- `manifest.webmanifest`: `purpose: maskable` su icon-512 per Android adaptive icons
- Unraid template: `<Icon>` punta a raw GitHub `diegoperu/bibliotrack/main/docker/icon.png`

### ✅ AUDIT SICUREZZA — Post Step 10

| Gravità | Problema | Esito |
|---|---|---|
| 🟡 BASSO | Algolia keys hardcoded in `isbn_lookup.py` | **Accettabile** — chiavi read-only pubbliche embedded nel JS di IBS.it, visibili a ogni browser. Non sono segreti BiblioTrack. Documentato nel codice. |
| 🟡 BASSO | `manifest.webmanifest` senza Cache-Control esplicito in nginx | **Fixato** — aggiunto `location = /manifest.webmanifest { add_header Cache-Control "no-cache"; }` in entrambi i nginx (Docker + deploy) |
| ✅ OK | Anti-FOUC script `localStorage` → `setAttribute('data-theme', t)` | `setAttribute` non esegue codice. Safe. |
| ✅ OK | ISBN nel messaggio 404 (template literal) | Testo puro, non innerHTML. Nessun XSS. |
| ✅ OK | ISBN → Algolia (JSON body) dopo validazione `\d{13}` | Nessun SSRF — URL hardcoded, ISBN solo nel body. |
| ✅ OK | CSP e manifest | `manifest-src` fallback su `default-src 'self'` copre `/manifest.webmanifest`. |
| ✅ OK | `connect-src 'self'` in CSP | Copre chiamate API anche in modalità standalone PWA (stessa origine). |

Nessuna vulnerabilità critica o alta introdotta. Un solo fix applicato (`manifest.webmanifest` cache).

Files modificati:
`docker/nginx-internal.conf`, `deploy/nginx.conf`

### ✅ FIX — Libreria admin mostrava libri di tutti gli utenti
**Problema:** Admin vedeva i libri di tutti gli utenti nella propria libreria personale.

Root cause e fix:

| Causa | Fix |
|---|---|
| `GET /books/` saltava `owner_id` filter per admin → restituiva tutti i libri | Filtro `owner_id` sempre attivo; aggiunto param `all_users=true` (admin-only) per pannello admin |
| Admin panel chiamava `GET /books/` senza distinzione | `Admin.jsx`: aggiunto `all_users: true` nei params del fetch "tutti i libri" |

Files modificati:
`backend/routers/books.py` (logica filtro), `frontend/src/pages/Admin.jsx` (param fetch)

Note tecniche:
- `all_users=true` ignorato se chiamato da utente non-admin (condizione `and current_user.role == UserRole.admin`)
- Libreria personale (`Library.jsx`) non passa `all_users` → admin vede solo i propri libri
- 40/40 test pass

### ✅ STEP 11 — Gestione Prestiti
**Obiettivo:** Sistema completo di prestiti libri a persone

Tasks:
- [x] `backend/models/loan.py`: tabelle `borrowers` (unico per name+owner) e `loans` (CASCADE su book, RESTRICT su borrower)
- [x] `backend/schemas/loan.py`: BorrowerOut, BorrowerSuggestion, LoanOut, LoanCreate, LoanReturn, BorrowerDetail, `loan_to_out()` helper
- [x] `backend/schemas/book.py`: aggiunto `is_on_loan: Optional[bool]` a BookResponse, `BookDetailResponse` con `active_loan`
- [x] `backend/routers/loans.py`: GET /loans, GET /loans/active, GET /loans/borrowers, GET /loans/borrowers/{id}, POST /loans, PUT /loans/{id}/return
- [x] `backend/routers/books.py`: GET /books/{id} aggiornato con `active_loan`, GET /books/{id}/loans (storico), `with_loan_status` param su lista
- [x] `backend/main.py`: registrato `loans.router`
- [x] `backend/tests/test_loans.py`: 18 test (58/58 totali pass)
- [x] `frontend/src/components/loans/LoanModal.jsx`: modal presta + autocomplete borrower (debounce 300ms)
- [x] `frontend/src/pages/Loans.jsx`: tab Attivi (più vecchio prima) + tab Per persona (accordion, ordinato per attivi desc)
- [x] `frontend/src/pages/BookDetail.jsx`: sezione prestiti — badge attivo + "Segna restituito" + storico + "Presta questo libro"
- [x] `frontend/src/components/books/BookCard.jsx`: badge "📤 Prestato" se `book.is_on_loan`
- [x] `frontend/src/components/books/BookList.jsx`: badge "📤 Prestato" se `book.is_on_loan`
- [x] `frontend/src/components/layout/Sidebar.jsx`: voce "Prestiti" con icona 📤
- [x] `frontend/src/App.jsx`: route `/loans`
- [x] `shared/export-schema.md`: versione 2 documentata (LoanExport)
- [x] `shared/export-schema.v2.json`: JSON Schema draft-07 (v1 invariato)

Note tecniche:
- Borrower normalizzato lowercase+strip → deduplicazione case-insensitive
- `ondelete="CASCADE"` su book_id: eliminazione libro elimina storico prestiti (documentato nel codice)
- `ondelete="RESTRICT"` su borrower_id: non si può eliminare Borrower con loan associati
- Loan immutabile via API: nessun DELETE endpoint esposto
- `GET /loans/borrowers` ritorna `BorrowerOut` (con conteggi) — usato sia da autocomplete che da tab Per persona
- Conteggi borrower calcolati con batch query (2 query totali, non N+1)
- `with_loan_status=true` su `GET /books`: batch subquery per `is_on_loan`, 0 N+1
- `joinedload(Loan.book, Loan.borrower)` su tutte le query loan principali
- `GET /loans/borrowers`: ordinato per display_name; frontend "Per persona" ri-ordina per active_loan_count desc
- Build: 128 moduli, no errori

### ✅ STEP 12 — Export/Import Backend Selfhosted (ZIP)
**Obiettivo:** Backup/portabilità libreria — endpoint indipendenti da mobile, riusabili da STEP MOBILE-5

Tasks:
- [x] `backend/schemas/export.py`: `BookExport`, `LoanExport`, `ExportBundle`, `ImportResult` (schema v2, coerente con `shared/export-schema.v2.json`)
- [x] `backend/services/export_service.py`: `build_export_zip()` + `import_export_zip()`
- [x] `backend/routers/books.py`: `GET /books/export` (streaming zip), `POST /books/import` (multipart upload)
- [x] `backend/tests/test_export.py`: 8 test (66/66 totali pass)

Decisioni:
- **Formato: ZIP** (`export.json` + `covers/{isbn}.ext`), non solo URL — backup self-contained, funziona offline, non dipende da Open Library/IBS ancora online in futuro
- `cover_url` sempre presente nel JSON come fallback (derivato da OpenLibrary se cover locale non disponibile), usato se lo zip non contiene l'immagine
- Dedup import: stesse regole di `export-schema.md` (isbn match, altrimenti title+author case-insensitive) → skip silenzioso
- `schema_version` sconosciuto/futuro → warning in `errors[]`, importa comunque i campi noti
- Root-level `borrowers[]` NON incluso (derivabile dai `loans[]` dei libri, come da schema v2 — coerente con `additionalProperties: false` in `export-schema.v2.json`)

Audit sicurezza (durante implementazione, non a posteriori):
| Gravità | Problema | Fix |
|---|---|---|
| 🔴 ALTO | `isbn` dal JSON importato passato non validato a `download_cover()` → `covers_dir / f"{isbn}.jpg"` → **path traversal / arbitrary file write** se isbn contiene `../` | `isbn` normalizzato + validato con `is_valid_isbn()` (stesso validator di `services/isbn_lookup.py`); se non valido, trattato come `None` (libro importato comunque, senza isbn) |
| 🟡 MEDIO | Nessun limite dimensione upload → DoS con file enorme | Cap 50MB su `POST /books/import`, HTTP 413 se superato |
| ✅ OK | Nome file cover nello zip (`covers/{isbn}.*`) scritto su disco con `Path(cover_entry).name` | `.name` scarta sempre i componenti di directory — zip-slip non sfruttabile anche se il nome entry contenesse `../` |
| ✅ OK | Route ordering `/books/export`, `/books/import` prima di `/books/{book_id}` | Evita che `book_id: int` intercetti erroneamente il path letterale |

Files creati/modificati:
`backend/schemas/export.py` (nuovo), `backend/services/export_service.py` (nuovo),
`backend/routers/books.py` (route export/import + guardia dimensione),
`backend/tests/test_export.py` (nuovo, 8 test incl. 2 di regressione sicurezza)

---

### ✅ STEP MOBILE-1 — Scaffold Capacitor + SQLite locale
**Obiettivo:** Progetto Capacitor separato in `mobile/`, non tocca `backend/`/`frontend/`. Vedi `shared/MOBILE-ROADMAP.md`.

Decisioni prese prima di partire:
- Piattaforme: solo Android per ora (`npx cap add android`) — iOS rimandato (serve Mac/Xcode, non nel focus attuale)
- Schema SQLite include già `borrowers`/`loans` (non solo `books`) — evita una migrazione futura quando arriverà la UI prestiti su mobile; export-schema v2 le prevede già
- MOBILE-1 = solo scaffold + SQLite + UI components + inserimento manuale. Niente scanner, niente cascade ISBN (MOBILE-2), niente export/import/backup (MOBILE-3/4), niente UI prestiti (schema pronto, UI rimandata)

Tasks:
- [x] `mobile/package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html` — stessa toolchain di `frontend/` (Vite 5, React 18, Tailwind 3, Zustand 4)
- [x] `mobile/capacitor.config.json` — appId `it.diegoperu.bibliotrack`, webDir `dist`
- [x] `npm install` + `npx cap add android` + `npx cap sync android` — eseguiti, funzionanti (Node 26, npm 11)
- [x] `mobile/src/db/schema.js` + `database.js` — tabelle `books`, `borrowers`, `loans` (stessa forma del modello backend, senza `owner_id`), `SQLiteConnection` singleton
- [x] `mobile/src/stores/bookStore.js` — CRUD via SQLite (init/addBook/updateBook/deleteBook), whitelist colonne aggiornabili
- [x] `mobile/src/stores/themeStore.js` — identico al web, storage key separata (`bibliotrack-mobile-theme`)
- [x] `mobile/src/lib/bookUtils.js` — identico al web; `getCoverUrl` adattato (solo URL http(s) diretti, no proxy `/static/`)
- [x] Componenti copiati verbatim (nessuna dipendenza da `api/client.js`): `StarRating`, `ThemeSwitcher`, `FilterBar`, `SortGroupBar`, `BookCard`, `BookGrid`, `BookList`
- [x] `mobile/src/components/books/AddBookModal.jsx` — riscritto: solo inserimento manuale (no step scan/isbn-search), scrive su `bookStore.addBook()`
- [x] `mobile/src/pages/Library.jsx`, `BookDetail.jsx` (senza sezione prestiti), `Settings.jsx` (tema + info) — riscritti su `bookStore`
- [x] `mobile/src/components/layout/Layout.jsx` — header minimale (titolo + link impostazioni), niente sidebar/admin
- [x] `mobile/src/App.jsx` — `HashRouter` (non `BrowserRouter`: necessario per webview Capacitor su reload)
- [x] Build verificata: `npm run build` → 71 moduli, no errori

Audit sicurezza:
| Gravità | Problema | Fix |
|---|---|---|
| 🟡 BASSO | `bookStore.updateBook()` costruiva `SET col = ?` da `Object.keys(fields)` non filtrate | Whitelist `UPDATABLE_COLUMNS` — chiamanti attuali passano solo chiavi fisse, ma chiude la porta a futuri usi con chiavi non controllate |
| ✅ OK | `npm audit`: 4 vuln (esbuild via vite, tar via `@capacitor/cli`) | Entrambe dev/build-tooling, mai in bundle prod; stesso esbuild/vite già accettato in `frontend/` — nessun nuovo rischio |
| ✅ OK | Cover da URL utente (`cover_path`) renderizzata in `<img src>` | Non è innerHTML, nessun XSS; stesso comportamento già accettato nel form manuale web |
| ✅ OK | SQLite locale non cifrato (`androidIsEncryption: false`) | Coerente con selfhosted (nessuna cifratura a livello campo); sandboxing per-app di Android è la protezione esistente |

Non fatto (limite ambiente): build/run reale su emulatore/device — richiede Android Studio + SDK (`ANDROID_HOME`) non presenti in questo ambiente. Scaffold e `android/` generati e sincronizzati; verifica reale rimandata a quando l'utente apre il progetto in Android Studio.

Files creati: intero albero `mobile/` (nuovo), nessuna modifica a `backend/` o `frontend/`.

---

### ✅ STEP 13 — UI Export/Import su web (Backup)
**Obiettivo:** Esporre `GET /books/export` / `POST /books/import` (STEP 12) con una pagina web — decisione presa di farla prima di continuare col mobile (MOBILE-2 messo in coda), per dare backup reale subito e validare il contratto zip con uso vero.

Tasks:
- [x] `frontend/src/pages/Backup.jsx`: sezione Esporta (bottone → blob download, filename da `Content-Disposition`) + sezione Importa (file input zip → multipart POST, mostra imported/skipped/errors)
- [x] `frontend/src/App.jsx`: route `/backup` (protetta, non admin-only — ogni utente esporta/importa solo i propri libri)
- [x] `frontend/src/components/layout/Sidebar.jsx`: voce nav "Backup" con icona 💾
- [x] `frontend/src/components/layout/Header.jsx`: titolo pagina per `/backup`
- [x] Build verificata: 129 moduli, no errori
- [x] Verifica end-to-end reale (non solo unit test): backend avviato su porta di test, utente/libro creati, `GET /books/export` → zip valido con header `Content-Disposition` nel formato atteso dal parsing regex di `Backup.jsx`, `POST /books/import` → stesso zip due volte → `{imported:0, skipped:1, errors:[]}` la seconda volta (dedup corretto). Dati di test rimossi a fine verifica, DB dev locale ripulito.

Non verificato: il click reale in browser (nessun tool di browser automation disponibile in questo ambiente) — solo il contratto HTTP che la pagina consuma è stato validato end-to-end.

Files modificati: `frontend/src/pages/Backup.jsx` (nuovo), `frontend/src/App.jsx`, `frontend/src/components/layout/Sidebar.jsx`, `frontend/src/components/layout/Header.jsx`. Nessuna modifica backend (STEP 12 già completo).

---

### ✅ AUDIT SICUREZZA PROFONDO — Post STEP 13
**Scope:** intero progetto (backend, frontend, mobile, nginx, Docker). Ogni fix verificato con test.

| Gravità | Problema | Fix |
|---|---|---|
| 🔴 ALTO | **SSRF via import**: `cover_url` dal JSON caricato passato a `download_cover()` → il server faceva GET verso URL arbitrari (rete interna, 169.254.169.254, ecc.) e salvava la risposta come cover scaricabile → primitiva di lettura della rete interna | `_is_safe_cover_url()` in `export_service.py`: solo http/https + risoluzione DNS + reject IP non globali (privati/loopback/link-local). Residuo noto: TOCTOU DNS-rebinding tra check e fetch — accettato per app domestica |
| 🔴 ALTO | **Delete libro con storico prestiti → 500**: `Book.loans` senza cascade ORM → `UPDATE loans SET book_id=NULL` → NOT NULL violation. Il CASCADE dichiarato nel modello non è mai scattato perché **SQLite non applica FK senza `PRAGMA foreign_keys=ON`** (mai attivato). Stessa causa: delete utente con prestiti falliva; RESTRICT su borrower mai applicato | `database.py`: `PRAGMA foreign_keys=ON` per connessione; `Book.loans`: `cascade="all, delete-orphan"`. Verificato empiricamente: delete libro → loans rimossi; delete utente → books+loans+borrowers rimossi, zero orfani |
| 🟠 MEDIO | **Zip bomb su import**: cap 50MB solo sulla dimensione compressa; `zf.read()` senza limite sul decompresso → esaurimento RAM/disco con zip artigianale | Cap decompresso da header zip (`getinfo().file_size`, applicato da Python in lettura): 20MB per `export.json`, 10MB per cover; cover oversize → skip con fallback |
| 🟠 MEDIO | **Admin vedeva prestiti di tutti in /loans** (pagina personale) — stessa classe del bug libreria admin già fixato (c649fa1); comportamento era pure codificato in un test | `_base_loan_query` filtra sempre per owner; admin mantiene accesso ai singoli prestiti altrui via `_get_loan_or_403` / `GET /books/{id}/loans`. Test invertito |
| 🟠 MEDIO | **nginx `client_max_body_size 10M`** vs cap import 50MB → upload zip >10MB respinti dal proxy con 413 prima di arrivare al backend | 60M in entrambi i config (docker + deploy) |
| 🟠 MEDIO | **`/loans` assente dal regex API in `deploy/nginx.conf`** → su deploy bare-metal tutte le chiamate loans ricevevano index.html (SPA fallback) — feature prestiti rotta | Aggiunto `loans` al location regex. (Docker non affetto: usa prefix `/api/`) |
| 🟡 BASSO | **Header sicurezza persi su asset**: `add_header` in un location nginx cancella quelli ereditati dal server block → covers/JS/CSS/manifest serviti senza `nosniff` (il commento nel config affermava il contrario) | `X-Content-Type-Options nosniff` ripetuto nei 3 location interessati di entrambi i config |
| 🟡 BASSO | **User enumeration via timing su login**: username inesistente → risposta ~200ms più rapida (bcrypt saltato) | Confronto con hash dummy quando l'utente non esiste (`_DUMMY_HASH` in `auth.py`) |

Verificati e OK (nessuna azione): JWT `algorithms` pinnata (no alg confusion), token type check access/refresh, permessi users.py (no privilege escalation via PATCH: role/is_active bloccati per non-admin), path traversal import già mitigato (STEP 12), StaticFiles no traversal, CORS con bearer token (no cookie → CSRF non applicabile), mobile bookStore parametrizzato + whitelist colonne, entrypoint non logga password, Algolia keys pubbliche (già documentato).

Accettati (invariati, app domestica): token in localStorage, no rate limiting login, no rotazione refresh token, HTTPS opzionale via certbot, `unsafe-inline`/`unsafe-eval` in CSP (richiesti da Vite/React), DNS rebinding TOCTOU su SSRF guard.

Nota deploy: DB esistenti creati con FK off possono contenere righe orfane pregresse — il pragma non le valida retroattivamente, le nuove operazioni sì.

Files modificati:
`backend/database.py` (FK pragma), `backend/models/book.py` (cascade ORM),
`backend/services/export_service.py` (SSRF guard + cap decompressi),
`backend/routers/loans.py` (owner filter), `backend/routers/auth.py` (timing),
`docker/nginx-internal.conf`, `deploy/nginx.conf` (body size, loans regex, nosniff),
`backend/tests/test_loans.py` (+2 test), `backend/tests/test_export.py` (+2 test)
Test: **69/69 pass**

---

## Sessione Corrente

**Ultimo step completato:** Audit sicurezza profondo post-STEP 13 ✅ (2 fix ALTI: SSRF import, FK SQLite mai attivate)
**Stato:** Selfhosted completo con backup web funzionante (pagina + endpoint, verificati end-to-end). `mobile/` scaffoldato (STEP MOBILE-1), in pausa — MOBILE-2 in coda.
**Prossimi step previsti:**
- STEP MOBILE-2: scanner nativo + cascade ISBN lato client — vedi shared/MOBILE-ROADMAP.md
- STEP MOBILE-3: export/import JSON su mobile — riusa formato di `export_service.py`, contratto già validato dalla UI web
- Deploy Docker su Unraid (quando pronto)
- Nuove feature selfhosted (aggiungere qui quando definite)
**Note tecniche:**
- `/auth/register` rimosso — creazione utenti solo via admin panel o entrypoint Docker
- Refresh token: body JSON (non query param) — breaking change rispetto a versioni precedenti
- Cascade lookup ISBN (5 livelli): SBN (solo IT) → OpenLibrary /api/books → /search.json → Google Books → IBS.it Algolia
- IBS.it usa Algolia (SPA React) — chiavi pubbliche `FBVFK8AIGY` / `460ca8aeaa21b30a35784e7125bfca37` index `prd_IBS`
- Source IBS non esposto nell'UI — errore 404 cita solo "Open Library e Google Books" + ISBN letto
- Scanner BarcodeDetector (Chrome/Android): canvas off-screen + autofocus + throttle 250ms + checksum + 2 confirm
- Scanner QuaggaJS (Firefox/iOS): autofocus via DOM track + frequency:5 + workers + checksum + 2 confirm
- QuaggaJS necessario per iOS (no BarcodeDetector nativo su Safari < 17)
- Icone: sorgente 512×512 in `frontend/public/`, resize con Pillow (ImageMagick non disponibile su Windows)
- PWA manifest: `manifest.webmanifest` con theme_color Catppuccin Mocha (#cba6f7), background #1e1e2e
- Unraid: `docker/icon.png` 128×128, URL raw GitHub `diegoperu` in `unraid-template.xml`
- SQLite in WAL mode: `PRAGMA journal_mode=WAL` su ogni connessione
- Deploy target finale: Docker su Unraid (vedi DOCKER-UNRAID.md + DOCKER-CLAUDECODE.md)
- Deploy alternativo: Linux server con Nginx disponibile, dominio proprio (vedi deploy/)
- 1 admin, pochi utenti (< 10)
- Container: porta 8080, volume unico /data (db + covers), supervisor gestisce nginx+uvicorn
- SECRET_KEY: minimo 32 caratteri, genera con `openssl rand -hex 32`
- Export schema v1 definito in shared/export-schema.md + shared/export-schema.v1.json
- Export schema v2 (con prestiti): shared/export-schema.v2.json — v1 immutabile
- Export/import backend: `GET /books/export` (zip: export.json + covers/), `POST /books/import` (multipart, max 50MB) — filtrati per owner, no `all_users`
- Export/import UI web: `frontend/src/pages/Backup.jsx` — nav "Backup" in Sidebar, non admin-only, ogni utente vede solo i propri
- Prestiti: Borrower normalizzato lowercase+strip (dedup case-insensitive), Loan immutabile via API
- `GET /books/{id}` ritorna `BookDetailResponse` con `active_loan` (null se disponibile)
- `GET /books?with_loan_status=true` aggiunge `is_on_loan: bool` via batch subquery
- Mobile: SQLite locale device, single-user, no auth, export/import JSON versionato
- Mobile: opzionalmente collegabile al backend selfhosted con token utente normale
- Mobile: NON in sviluppo — roadmap in shared/MOBILE-ROADMAP.md
- Nuove feature selfhosted che aggiungono campi a Book → aggiornare anche export-schema.md
