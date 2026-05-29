# BiblioTrack — Deploy Docker su Unraid

Guida completa per dockerizzare BiblioTrack e deployarlo su Unraid.
Tre approcci possibili — scegli quello più adatto alla tua configurazione.

---

## Architettura del container

```
Container BiblioTrack (porta 8080)
│
├── nginx (porta interna 8080)
│   ├── /           → frontend React (statico, /app/frontend/dist)
│   ├── /api/       → proxy → uvicorn 127.0.0.1:8000
│   └── /static/covers/ → alias → /data/covers/
│
├── uvicorn (porta interna 8000, solo localhost)
│   └── FastAPI app (/app/backend)
│
└── Volume /data (montato dall'host)
    ├── db/bibliotrack.db   ← database SQLite
    └── covers/             ← copertine scaricate
```

Un solo container, nessun compose richiesto su Unraid.

---

## Prerequisiti

- Unraid 6.12+ con Docker abilitato
- Accesso SSH all'host Unraid (o terminale web)
- Git installato (o scaricare il progetto come ZIP)

---

## Approccio A — Build locale su Unraid (più semplice)

Costruisci l'immagine direttamente sull'host Unraid. Nessun registry necessario.

### 1. Copia il progetto su Unraid

Dal tuo PC:
```bash
# Copia via SCP (sostituisci IP con quello di Unraid)
scp -r ./bibliotrack root@192.168.1.X:/mnt/user/appdata/bibliotrack-build

# Oppure via Unraid terminal: clona dal tuo git server/GitHub
git clone https://github.com/tuoutente/bibliotrack /mnt/user/appdata/bibliotrack-build
```

### 2. Build dell'immagine su Unraid

In Unraid > Tools > Terminal (o via SSH):
```bash
cd /mnt/user/appdata/bibliotrack-build

# Build (richiede 5-10 minuti al primo avvio)
docker build -t bibliotrack:latest .

# Verifica che l'immagine esista
docker images | grep bibliotrack
```

### 3. Crea directory dati

```bash
mkdir -p /mnt/user/appdata/bibliotrack/{db,covers}
```

### 4. Aggiungi container via Unraid UI

**Docker > Add Container > Advanced View**

| Campo | Valore |
|-------|--------|
| Name | `BiblioTrack` |
| Repository | `bibliotrack:latest` |
| Network Type | `bridge` |
| Console shell | `sh` |

**Ports:**
```
Host Port: 8080
Container Port: 8080
Protocol: TCP
```

**Volumes:**
```
Host Path:      /mnt/user/appdata/bibliotrack
Container Path: /data
Access:         Read/Write
```

**Variables:**

| Name | Value |
|------|-------|
| `SECRET_KEY` | *(output di `openssl rand -hex 32`)* |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_EMAIL` | `tua@email.it` |
| `ADMIN_PASSWORD` | *(password sicura)* |

Clicca **Apply** e poi **Done**.

---

## Approccio B — GitHub Container Registry (raccomandato per aggiornamenti)

Pusha l'immagine su ghcr.io e Unraid la scarica direttamente.

### 1. Prepara GitHub Container Registry

```bash
# Sul tuo PC, crea un Personal Access Token GitHub con scope:
# write:packages, read:packages, delete:packages
# https://github.com/settings/tokens/new

# Login al registry
echo "IL_TUO_TOKEN" | docker login ghcr.io -u IL_TUO_USERNAME --password-stdin
```

### 2. Build e push

```bash
cd bibliotrack

# Build per amd64 (CPU Unraid tipica)
REGISTRY=ghcr.io/tuoutente ./docker/build-and-push.sh latest

# L'immagine sarà disponibile come:
# ghcr.io/tuoutente/bibliotrack:latest
```

### 3. Rendi l'immagine pubblica (opzionale)

Su GitHub > Packages > bibliotrack > Package Settings > Change Visibility > Public

Oppure lasciala privata e aggiungi le credenziali in Unraid:
```
Docker > Registry > Add Registry
URL: ghcr.io
Username: IL_TUO_USERNAME
Password: IL_TUO_TOKEN
```

### 4. Aggiungi container in Unraid

Come nel punto 4 dell'Approccio A, ma con Repository:
```
ghcr.io/tuoutente/bibliotrack:latest
```

---

## Approccio C — File .tar.gz (senza registry, senza build su Unraid)

Utile se Unraid non ha accesso a internet per il registry.

```bash
# Sul tuo PC: build + export
docker build -t bibliotrack:latest .
docker save bibliotrack:latest | gzip > bibliotrack.tar.gz

# Copia su Unraid
scp bibliotrack.tar.gz root@192.168.1.X:/tmp/

# Su Unraid (SSH o terminal)
docker load < /tmp/bibliotrack.tar.gz
# Poi segui punto 4 dell'Approccio A
```

---

## Configurazione avanzata Unraid

### Reverse proxy con Nginx Proxy Manager

Se usi NPM (raccomandato per HTTPS):

1. In Unraid, assicurati che NPM sia installato
2. Aggiungi un Proxy Host:
   - Domain: `libri.tuodominio.it`
   - Forward Hostname: `192.168.1.X` (IP Unraid)
   - Forward Port: `8080`
   - Abilita SSL con Let's Encrypt

3. Aggiorna la variabile d'ambiente del container:
   ```
   CORS_ORIGINS=["https://libri.tuodominio.it"]
   ```

### Accesso solo LAN (senza dominio)

Accedi tramite: `http://IP-UNRAID:8080`

Se vuoi una porta diversa, cambia "Host Port" da 8080 a quella che vuoi (es. 7777).

### Backup automatico con Unraid CA Backup

Configura CA Backup per includere:
```
/mnt/user/appdata/bibliotrack/
```

Oppure script manuale in Unraid > Settings > User Scripts:
```bash
#!/bin/bash
BACKUP_DIR="/mnt/user/backups/bibliotrack"
DATE=$(date +%Y%m%d_%H%M)
mkdir -p "$BACKUP_DIR"

# Stop container per backup db consistente
docker stop BiblioTrack

# Backup
cp /mnt/user/appdata/bibliotrack/db/bibliotrack.db \
   "$BACKUP_DIR/bibliotrack_${DATE}.db"

# Restart
docker start BiblioTrack

echo "Backup completato: bibliotrack_${DATE}.db"
```

---

## Aggiornamenti

### Approccio A (build locale)

```bash
# Su Unraid SSH/terminal
cd /mnt/user/appdata/bibliotrack-build
git pull

# Rebuild
docker build -t bibliotrack:latest .

# Restart container (Unraid lo fa con "Force Update")
docker stop BiblioTrack && docker rm BiblioTrack
# Poi ricrea dalla UI con gli stessi parametri
```

**Modo più semplice:** in Unraid > Docker > BiblioTrack > clicca icona container > **Force Update**
(funziona solo se l'immagine è su un registry)

### Approccio B (registry)

```bash
# Sul tuo PC
REGISTRY=ghcr.io/tuoutente ./docker/build-and-push.sh latest

# In Unraid UI
# Docker > BiblioTrack > Force Update
```

---

## Verifica installazione

Dopo l'avvio del container (attendi 15-20 secondi):

```bash
# Health check
curl http://IP-UNRAID:8080/api/health

# Risposta attesa:
# {"status": "ok", "app": "BiblioTrack"}
```

Apri nel browser: `http://IP-UNRAID:8080`

Login con le credenziali admin impostate nelle variabili d'ambiente.

---

## Troubleshooting

### Il container si avvia ma non risponde
```bash
# Controlla i log
docker logs BiblioTrack

# Controlla che uvicorn sia su
docker exec BiblioTrack curl -s http://127.0.0.1:8000/health
```

### Errore "Permission denied" su /data
```bash
# Fix permessi directory
chmod -R 755 /mnt/user/appdata/bibliotrack
```

### Copertine non si vedono
```bash
# Verifica che il volume sia montato correttamente
docker exec BiblioTrack ls /data/covers

# Verifica che nginx serva correttamente
docker exec BiblioTrack curl -I http://127.0.0.1:8080/static/covers/
```

### Reset password admin
```bash
# Variabile d'ambiente ADMIN_PASSWORD viene applicata solo al primo avvio
# Per reset manuale:
docker exec -it BiblioTrack sh
cd /app/backend
python3 -c "
from database import SessionLocal
from services.auth_service import hash_password
from models.user import User
db = SessionLocal()
u = db.query(User).filter(User.username=='admin').first()
u.hashed_password = hash_password('NUOVA_PASSWORD')
db.commit()
print('Password aggiornata')
"
```

---

## Struttura file Docker

```
bibliotrack/
├── Dockerfile                   ← build multi-stage
├── docker-compose.yml           ← per sviluppo locale / server Linux
└── docker/
    ├── nginx-internal.conf      ← nginx dentro il container
    ├── supervisord.conf         ← gestisce nginx + uvicorn
    ├── entrypoint.sh            ← startup script
    ├── build-and-push.sh        ← build + push su registry
    └── unraid-template.xml      ← template Community Applications
```
