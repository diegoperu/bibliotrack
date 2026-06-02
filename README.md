```
    ____  _ __    ___     ______                __
   / __ )(_) /_  / (_)___/_  __/________ ______/ /__
  / __  / / __ \/ / / __ \/ / / ___/ __ `/ ___/ //_/
 / /_/ / / /_/ / / / /_/ / / / /  / /_/ / /__/ ,<
/_____/_/_.___/_/_/\____/_/ /_/   \__,_/\___/_/|_|
```

> **Progetto personale** — sviluppato per uso privato. Non è un prodotto commerciale.

# BiblioTrack 📚

Web app per catalogare la tua libreria personale. Mobile-first, scansione ISBN da fotocamera, metadati automatici via OPAC SBN (primario per editori italiani) + Open Library + Google Books.

> Ispirata a Calibre-web. Funziona su smartphone e desktop.

---

## Funzionalità

- 📷 **Scansione ISBN** da fotocamera (Chrome/Android nativo, iOS via QuaggaJS)
- 🔍 **Lookup automatico** metadati + copertina — cascade a 5 livelli: OPAC SBN → Open Library → Google Books → fallback italiani
- ✍️ **Inserimento manuale** come alternativa
- 📚 **Libreria personale** con filtri, raggruppamento e ordinamento
- 👤 **Gestione utenti** (admin / user)
- 🎨 **4 temi**: Light · Dark · Catppuccin Light · Catppuccin Dark
- 📱 **Responsive**: ottimizzata per smartphone, funziona su desktop
- 🔒 **Autenticazione JWT** con refresh token automatico

---

## Stack

| Layer | Tecnologia |
|---|---|
| Backend | Python 3.11+ / FastAPI |
| ORM | SQLAlchemy 2.x + SQLite (WAL) |
| Auth | JWT (python-jose) + bcrypt |
| Frontend | React 18 + Vite + TailwindCSS 3 |
| Camera | BarcodeDetector API (Chrome/Android) + QuaggaJS (Firefox/iOS) |
| Metadata | OPAC SBN (IT) · Open Library · Google Books · IBS.it (fallback IT) |
| Server | Nginx + systemd |

---

## Quick start (sviluppo)

```bash
# 1. Clona il repository
git clone https://github.com/tuoutente/bibliotrack.git
cd bibliotrack

# 2. Backend
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edita .env: imposta SECRET_KEY con `openssl rand -hex 32`
uvicorn main:app --reload --port 8000

# 3. Frontend (nuovo terminale)
cd frontend
npm install
npm run dev
```

- App → `http://localhost:5173`
- API docs → `http://localhost:8000/docs`

**Primo avvio:** crea l'account admin direttamente nel DB (l'endpoint `/auth/register` è rimosso per sicurezza):

```bash
cd backend
source venv/bin/activate    # Windows: venv\Scripts\activate
python3 - <<'EOF'
import os; os.environ.setdefault('SECRET_KEY', 'dev-key-change-me')
from database import engine, Base, SessionLocal
from models.user import User, UserRole
from services.auth_service import hash_password
Base.metadata.create_all(bind=engine)
db = SessionLocal()
db.add(User(username='admin', email='admin@example.com',
            hashed_password=hash_password('tua-password-sicura'),
            role=UserRole.admin, is_active=True))
db.commit(); db.close(); print('Admin creato')
EOF
```

Oppure usa `deploy/setup.sh` che lo fa interattivamente.

---

## Installazione produzione (Linux)

### Requisiti

- Ubuntu 22.04 / Debian 12 (o equivalente con `apt`)
- Python 3.11+
- Node.js 18+ (installato automaticamente se mancante)
- Nginx
- Root / sudo

### Installazione automatica

```bash
# 1. Clona il repository sul server
git clone https://github.com/tuoutente/bibliotrack.git /opt/src/bibliotrack
cd /opt/src/bibliotrack

# 2. Esegui lo script
sudo bash deploy/setup.sh
```

Lo script esegue automaticamente:
1. Installazione dipendenze di sistema
2. Creazione utente sistema `bibliotrack`
3. Copia file in `/opt/bibliotrack/`
4. Creazione virtualenv Python + install dipendenze
5. Build frontend (`npm run build`)
6. Generazione `.env` con `SECRET_KEY` casuale
7. Installazione e avvio servizio systemd
8. Configurazione nginx
9. Setup backup notturno (cron 3:00)
10. (Opzionale) Creazione account admin interattiva

### Struttura produzione

```
/opt/bibliotrack/
├── backend/           ← app Python + DB + copertine
│   ├── .env           ← configurazione (generata da setup.sh)
│   ├── bibliotrack.db ← SQLite database
│   └── static/covers/ ← copertine scaricate
├── frontend/dist/     ← frontend compilato (servito da nginx)
├── venv/              ← Python virtualenv
└── backups/           ← backup automatici database
```

### Configurazione `.env`

```env
# Genera SECRET_KEY con: openssl rand -hex 32
SECRET_KEY=<generata-da-setup.sh>
DATABASE_URL=sqlite:////opt/bibliotrack/backend/bibliotrack.db
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
COVERS_DIR=/opt/bibliotrack/backend/static/covers
```

### HTTPS (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tuodominio.it
```

---

## Deploy Docker / Unraid

BiblioTrack viene distribuito come **singolo container** (nginx + uvicorn + supervisor).  
Non richiede docker-compose su Unraid.

### Architettura container

```
Container BiblioTrack  :8080
├── nginx              ← frontend React + reverse proxy /api/
├── uvicorn            ← FastAPI backend (127.0.0.1:8000, interno)
└── /data  (volume)
    ├── db/bibliotrack.db
    └── covers/
```

### Opzione A — Build locale su Unraid (consigliata)

```bash
# 1. Clona il repo su Unraid (SSH o Unraid Terminal)
git clone https://github.com/diegoperu/bibliotrack.git \
    /mnt/user/appdata/bibliotrack-build
cd /mnt/user/appdata/bibliotrack-build

# 2. Build immagine (5-10 min al primo avvio)
docker build -t bibliotrack:latest .

# 3. Crea directory dati
mkdir -p /mnt/user/appdata/bibliotrack/{db,covers}
```

In **Unraid UI → Docker → Add Container → Advanced View**:

| Campo | Valore |
|---|---|
| Name | `BiblioTrack` |
| Repository | `bibliotrack:latest` |
| Network | `bridge` |
| Port (host→container) | `8080:8080/tcp` |
| Path (host→container) | `/mnt/user/appdata/bibliotrack` → `/data` |

**Variabili d'ambiente obbligatorie:**

| Variabile | Valore |
|---|---|
| `SECRET_KEY` | output di `openssl rand -hex 32` |
| `ADMIN_USERNAME` | `admin` (o nome a scelta) |
| `ADMIN_EMAIL` | la tua email |
| `ADMIN_PASSWORD` | password sicura (min 8 caratteri) |

Clicca **Apply** → attendi 20 secondi → apri `http://IP-UNRAID:8080`.

> `ADMIN_*` sono usate **solo al primo avvio** (DB vuoto) per creare l'account admin.  
> Dopo il primo avvio puoi rimuoverle per sicurezza.

### Opzione B — docker-compose (test locale / server Linux)

```bash
# Copia e configura
cp backend/.env.example .env
# Edita .env: imposta SECRET_KEY, ADMIN_PASSWORD

# Avvia
SECRET_KEY=$(openssl rand -hex 32) ADMIN_PASSWORD=changeme docker-compose up -d

# Verifica
curl http://localhost:8080/api/health
```

### Verifica installazione

```bash
# Health check
curl http://IP-UNRAID:8080/api/health
# Risposta: {"status": "ok", "version": "1.0.0"}
```

### Aggiornamento container su Unraid

```bash
cd /mnt/user/appdata/bibliotrack-build
git pull
docker build -t bibliotrack:latest .
# Poi in Unraid UI: Docker → BiblioTrack → Force Update
```

### Reverse proxy (NPM / Nginx Proxy Manager)

Se BiblioTrack è dietro NPM o altro reverse proxy che termina SSL:

1. **Scheme upstream**: imposta `http` (non `https`) — il container parla HTTP sulla porta 8080
2. **Force SSL** e **Websockets Support**: attivati su NPM
3. NPM deve passare `X-Forwarded-Proto: https` al container (attivo di default con Force SSL)

### Troubleshooting

```bash
# Log completi (nginx + uvicorn + applicazione Python)
docker logs BiblioTrack
docker logs BiblioTrack --follow    # real-time

# Verifica uvicorn interno
docker exec BiblioTrack curl -s http://127.0.0.1:8000/health

# Fix permessi /data
chmod -R 755 /mnt/user/appdata/bibliotrack

# Reset password admin manuale
docker exec -it BiblioTrack sh -c "
cd /app/backend && python3 -c \"
from database import SessionLocal
from services.auth_service import hash_password
from models.user import User
db = SessionLocal()
u = db.query(User).filter(User.username=='admin').first()
u.hashed_password = hash_password('NUOVA_PASSWORD')
db.commit(); print('OK')
\""
```

> Guida completa con approccio via registry (ghcr.io), NPM reverse proxy, backup Unraid: **[DOCKER-UNRAID.md](DOCKER-UNRAID.md)**

---

## Aggiornamento

```bash
cd /opt/src/bibliotrack
git pull

# Backend
source /opt/bibliotrack/venv/bin/activate
pip install -r backend/requirements.txt

# Frontend
cd frontend && npm ci && npm run build
cp -r dist/. /opt/bibliotrack/frontend/dist/
cd ..

# Riavvia
sudo systemctl restart bibliotrack
sudo systemctl reload nginx
```

---

## Gestione servizio

```bash
sudo systemctl status bibliotrack      # stato
sudo systemctl restart bibliotrack     # riavvio
sudo journalctl -u bibliotrack -f      # log in tempo reale
sudo journalctl -u bibliotrack --since "1 hour ago"
```

---

## Backup

Backup automatico ogni notte alle 3:00 in `/opt/bibliotrack/backups/`.  
Mantenuti gli ultimi 30 giorni.

```bash
# Backup manuale
sudo bash /opt/bibliotrack/backup.sh

# Lista backup
ls -lh /opt/bibliotrack/backups/

# Ripristino
gunzip -c /opt/bibliotrack/backups/bibliotrack_20241201_030000.db.gz \
    > /opt/bibliotrack/backend/bibliotrack.db
sudo systemctl restart bibliotrack
```

---

## Utilizzo

### Aggiungere un libro

**Via scansione barcode** (raccomandato su mobile):
1. Tap su **"➕ Aggiungi libro"** nella sidebar
2. Scegli **"Scansiona barcode"** → permetti accesso fotocamera
3. Inquadra il codice a barre del libro
4. Verifica i metadati recuperati automaticamente
5. Aggiungi genere, stato di lettura, valutazione, note
6. **"Aggiungi alla libreria"**

**Via ISBN manuale:**
1. Tap **"➕ Aggiungi libro"** → **"Cerca per ISBN"**
2. Inserisci il codice ISBN (10 o 13 cifre, con o senza trattini)
3. Verifica e salva

**Inserimento manuale** (senza ISBN):
1. Tap **"➕ Aggiungi libro"** → **"Inserimento manuale"**
2. Compila titolo (obbligatorio), autore (obbligatorio) e campi opzionali
3. Salva

### Filtri e ordinamento

Nella libreria:
- **Cerca** — ricerca per titolo o autore
- **Stato** — filtra per letto / in lettura / da leggere / abbandonato
- **Genere / Editore / Lingua** — dropdown popolati automaticamente
- **Ordina** — per data, titolo, autore, anno, valutazione…
- **Raggruppa** — per genere, autore, stato, editore
- **Vista** — griglia (⊞) o lista (≡)

### Temi

ThemeSwitcher nella sidebar:
- ☀️ **Light** — chiaro brillante
- 🌙 **Dark** — scuro pastello
- ☕ **Latte** — Catppuccin chiaro
- 🌸 **Mocha** — Catppuccin scuro

---

## Gestione utenti (Admin)

Il pannello Admin è accessibile dalla sidebar solo agli utenti con ruolo `admin`.

**Statistiche:** totale libri/utenti, breakdown per stato e genere, libri per utente.

**Utenti:**
- Crea nuovi account (username, email, password, ruolo)
- Attiva / disabilita account
- Cambia ruolo user ↔ admin
- Reimposta password
- Elimina utente

**Tutti i libri:** visualizza e filtra i libri di tutti gli utenti.

---

## API

```
POST /auth/login                    → {access_token, refresh_token}
POST /auth/refresh                  → {access_token}  body: {"token": "<refresh>"}
GET  /auth/me                       → utente corrente

GET    /books/                      → lista libri (propri; admin vede tutti)
POST   /books/                      → crea libro manualmente
GET    /books/{id}                  → dettaglio libro
PATCH  /books/{id}                  → aggiorna libro
DELETE /books/{id}                  → elimina libro

GET  /isbn/{code}                   → lookup metadati ISBN (autenticato)
POST /isbn/{code}/import            → importa libro da ISBN

GET    /users/                      → lista utenti (admin)
POST   /users/                      → crea utente (admin)
PATCH  /users/{id}                  → aggiorna utente
DELETE /users/{id}                  → elimina utente (admin)
POST   /users/{id}/admin-reset-password  → reset password (admin)
```

> **Nota:** `/auth/register` è stato rimosso. Nuovi utenti si creano solo tramite il pannello Admin (autenticato) o lo script `deploy/setup.sh`.

Documentazione interattiva: `http://server/docs`

---

## Sicurezza

- **Nessun endpoint pubblico di registrazione** — `/auth/register` rimosso. Solo l'admin può creare utenti tramite il pannello Admin o `setup.sh`.
- **Password**: minimo 8 caratteri, hashing bcrypt con salt casuale.
- **JWT**: access token (60 min) + refresh token (30 giorni). Refresh inviato nel body JSON, non in URL.
- **SECRET_KEY**: obbligatoria, minimo 32 caratteri. Il server non si avvia senza una chiave sicura.
- **Headers HTTP**: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`, `Permissions-Policy`.
- **HTTPS**: non abilitato di default — attivare con `sudo certbot --nginx -d tuodominio.it` dopo il deploy.

---

## Sviluppo

| Step | Descrizione | Stato |
|---|---|---|
| 0 | Scaffolding & Pianificazione | ✅ |
| 1 | Backend Core (FastAPI + Auth + CRUD) | ✅ |
| 2 | ISBN Lookup Service | ✅ |
| 3 | Frontend Base + Auth | ✅ |
| 4 | Libreria & Visualizzazione | ✅ |
| 5 | Scanner ISBN + AddBookModal | ✅ |
| 6 | Admin Panel | ✅ |
| 7 | Deploy & Documentazione | ✅ |
| 8 | Docker + Unraid | ✅ |
| — | Audit sicurezza | ✅ |
| — | ISBN fallback IBS.it (Algolia) + logging cascade | ✅ |
| — | Fix scanner barcode Android (BarcodeDetector) | ✅ |
| — | Fix scanner barcode Firefox/iOS (QuaggaJS) | ✅ |

---

## Licenza

MIT
