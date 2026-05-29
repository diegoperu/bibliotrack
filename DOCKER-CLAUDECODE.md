# BiblioTrack — Istruzioni Docker per Claude Code

> Questo file contiene le istruzioni operative per Claude Code
> per completare la dockerizzazione del progetto al termine dello sviluppo.
> 
> **Quando eseguire:** dopo che STEP 7 (deploy tradizionale) è completato.
> Leggere prima CLAUDE.md per lo stato attuale del progetto.

---

## Prerequisiti prima di dockerizzare

Verificare che siano tutti completati:
- [ ] STEP 1 — Backend Core ✅
- [ ] STEP 2 — ISBN Lookup ✅  
- [ ] STEP 3 — Frontend Base ✅
- [ ] STEP 4 — Libreria & Visualizzazione ✅
- [ ] STEP 5 — Scanner ISBN ✅
- [ ] STEP 6 — Admin Panel ✅
- [ ] STEP 7 — Deploy tradizionale ✅

---

## STEP 8 — Dockerizzazione (eseguire in ordine)

### 8.1 — Verifica file Docker esistenti

I file Docker sono già stati creati nella fase di scaffolding. Verificarne l'esistenza e la correttezza:

```bash
ls -la Dockerfile docker-compose.yml docker/
```

File richiesti:
- `Dockerfile` — build multi-stage
- `docker-compose.yml` — per test locale
- `docker/nginx-internal.conf` — nginx interno
- `docker/supervisord.conf` — process manager
- `docker/entrypoint.sh` — startup script
- `docker/build-and-push.sh` — script push registry

### 8.2 — Aggiornamento config.py per Docker

Verificare che `backend/config.py` gestisca correttamente `DATABASE_URL` con path assoluto.
Il container monta il database in `/data/db/bibliotrack.db`.

In `config.py`, assicurarsi che `COVERS_DIR` possa essere overridden da env:
```python
COVERS_DIR: str = "/data/covers"  # default per Docker
```

Se il progetto usa `./static/covers` come default per sviluppo locale, va bene —
l'entrypoint.sh sovrascrive con `/data/covers` via env var.

### 8.3 — Verifica CORS per Docker

In `backend/config.py`, `CORS_ORIGINS` deve accettare `["*"]` quando il frontend
è servito dallo stesso nginx del container (stesso origin). Verificare che il parsing
JSON funzioni con `["*"]`.

### 8.4 — Build test locale

```bash
# Build immagine
docker build -t bibliotrack:latest .

# Test avvio
docker run -d \
  --name bt-test \
  -p 8080:8080 \
  -v /tmp/bt-data:/data \
  -e SECRET_KEY=$(openssl rand -hex 32) \
  -e ADMIN_PASSWORD=testpass123 \
  bibliotrack:latest

# Attendi 15 secondi poi verifica
sleep 15
curl http://localhost:8080/api/health
```

Se health check risponde `{"status": "ok"}`, build OK.

```bash
# Pulizia test
docker stop bt-test && docker rm bt-test
```

### 8.5 — Test docker-compose

```bash
# Copia .env.example e compila
cp backend/.env.example .env.docker.test
# Edita con valori test

docker-compose up -d
sleep 20
curl http://localhost:8080/api/health
docker-compose logs --tail=50
docker-compose down
```

### 8.6 — Aggiornamento CLAUDE.md e README.md

Dopo che i test passano, aggiornare:

**In CLAUDE.md:**
- Marcare STEP 8 come completato
- Aggiornare "Sessione Corrente"
- Aggiungere nota su quale registry è stato configurato

**In README.md:**
- Aggiungere sezione "Deploy Docker / Unraid" che rimanda a DOCKER-UNRAID.md
- Aggiornare tabella step con STEP 8 ✅

---

## Checklist finale Docker

Prima di dichiarare STEP 8 completo, verificare:

```bash
# 1. Health check risponde
curl http://localhost:8080/api/health
# atteso: {"status": "ok", "app": "BiblioTrack"}

# 2. Frontend si carica
curl -s http://localhost:8080/ | grep -i "BiblioTrack"

# 3. Login funziona
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"testpass123"}'
# atteso: {"access_token": "...", ...}

# 4. Static covers serviti
curl -I http://localhost:8080/static/covers/
# atteso: 200 o 404 (ma non 502)

# 5. Database persiste dopo restart
docker-compose restart
sleep 10
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"testpass123"}'
# deve ancora funzionare (utente admin nel db persistito)
```

---

## Problemi comuni e fix

### Frontend non si carica (502 Bad Gateway nginx)
**Causa:** build React non completata nel Dockerfile.
**Fix:** verificare che `npm run build` nel Dockerfile non fallisca. Controllare:
```bash
docker build --progress=plain -t bibliotrack:latest . 2>&1 | grep -A5 "npm run build"
```

### Backend non parte (errore import)
**Causa:** dipendenza Python mancante o incompatibile.
**Fix:** verificare `requirements.txt` includa tutte le dipendenze aggiunte durante lo sviluppo:
```bash
docker exec bt-test pip list | grep -E "fastapi|sqlalchemy|uvicorn"
```

### Database non persiste
**Causa:** volume `/data` non montato o DATABASE_URL punta al path sbagliato.
**Fix:** verificare in `entrypoint.sh` che `DATABASE_URL` sia forzato a `sqlite:////data/db/bibliotrack.db`.

### Copertine non si vedono dopo restart
**Causa:** covers salvate in `/app/backend/static/covers/` invece di `/data/covers/`.
**Fix:** verificare che `COVERS_DIR=/data/covers` sia impostato e che `cover_download.py` usi `settings.COVERS_DIR`.

---

## Note architetturali per Claude Code

### Perché un singolo container invece di compose?
Unraid gestisce container singoli nella UI nativa. Compose richiede plugin aggiuntivi
(come Portainer) e rende la gestione più complicata per l'utente medio Unraid.
Il pattern "nginx + app nello stesso container" è comune per app self-hosted
(Calibre-web stesso funziona così).

### Perché supervisor e non just uvicorn?
Il container deve avviare nginx (frontend + proxy) E uvicorn (backend).
Supervisor è il modo standard per gestire più processi in un container Docker
senza usare script di init complessi. È già installato su debian/ubuntu.

### Perché /data come volume root?
Unraid usa `/mnt/user/appdata/NOMEAPP` come convenzione per i dati persistenti.
Avere un unico mount point `/data` semplifica la configurazione in Unraid UI
e il backup (basta fare backup di una sola cartella).

### PORT 8080 invece di 80
Unraid spesso ha già nginx o altri servizi su 80/443. La porta 8080 è per
convenzione usata per webapp self-hosted su Unraid. L'utente può cambiarla
liberamente nella UI Docker.
