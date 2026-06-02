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
│   │   └── book.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── books.py
│   │   ├── users.py
│   │   └── isbn.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── isbn_lookup.py     ← Open Library + fallback
│   │   ├── cover_download.py
│   │   └── auth_service.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── book.py
│   ├── middleware/
│   │   └── auth.py
│   ├── static/
│   │   └── covers/            ← copertine scaricate
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

---

## Sessione Corrente

**Ultimo step completato:** Integrazione icone + PWA manifest ✅
**Stato:** Progetto completo e pronto per il deploy
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
