#!/usr/bin/env bash
# BiblioTrack — script di installazione automatica
# Uso: cd /percorso/bibliotrack && sudo bash deploy/setup.sh
set -euo pipefail

# ── Variabili ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
APP_DIR="/opt/bibliotrack"
APP_USER="bibliotrack"
PYTHON_MIN="3.11"
NODE_MIN=18

# ── Colori ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}▶${NC} $*"; }
info() { echo -e "${CYAN}  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
die()  { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }

echo -e "\n${CYAN}╔══════════════════════════════════════╗"
echo -e "║   BiblioTrack — Installazione        ║"
echo -e "╚══════════════════════════════════════╝${NC}\n"

# ── Controlli prerequisiti ────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Esegui come root: sudo bash deploy/setup.sh"

[[ -f "$REPO_DIR/backend/main.py" ]] || \
    die "Esegui lo script dalla root del repository BiblioTrack"

# Python version check
PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "0.0")
python3 -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" 2>/dev/null || \
    die "Python $PYTHON_MIN+ richiesto (trovato: $PY_VER)"

log "Ambiente: Python $PY_VER OK"

# ── Pacchetti di sistema ──────────────────────────────────────────────────────
log "Installazione dipendenze di sistema..."
if command -v apt-get &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq python3-venv python3-pip nginx curl sqlite3
elif command -v dnf &>/dev/null; then
    dnf install -y python3 python3-pip nginx curl sqlite
else
    die "Gestore pacchetti non supportato (richiede apt o dnf)"
fi
ok "Dipendenze installate"

# ── Node.js ───────────────────────────────────────────────────────────────────
NODE_VER=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo "0")
if [[ "$NODE_VER" -lt $NODE_MIN ]]; then
    log "Installazione Node.js $NODE_MIN+..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
    apt-get install -y -qq nodejs
fi
ok "Node.js $(node --version) OK"

# ── Utente applicazione ───────────────────────────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
    log "Creazione utente sistema $APP_USER..."
    useradd --system --shell /bin/false --create-home --home-dir "$APP_DIR" "$APP_USER"
    ok "Utente $APP_USER creato"
fi

# ── Directory applicazione ────────────────────────────────────────────────────
log "Setup directory $APP_DIR..."
mkdir -p "$APP_DIR/backend" "$APP_DIR/frontend/dist" "$APP_DIR/backups"
cp -r "$REPO_DIR/backend/." "$APP_DIR/backend/"
mkdir -p "$APP_DIR/backend/static/covers"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
ok "File copiati in $APP_DIR"

# ── Python virtualenv ─────────────────────────────────────────────────────────
log "Creazione virtualenv Python..."
if [[ ! -d "$APP_DIR/venv" ]]; then
    sudo -u "$APP_USER" python3 -m venv "$APP_DIR/venv"
fi
sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install -q --upgrade pip
sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt"
ok "Dipendenze Python installate"

# ── Build frontend ────────────────────────────────────────────────────────────
log "Build frontend..."
cd "$REPO_DIR/frontend"
npm ci --silent
npm run build --silent
cp -r "$REPO_DIR/frontend/dist/." "$APP_DIR/frontend/dist/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/frontend"
ok "Frontend compilato"

# ── Configurazione .env ───────────────────────────────────────────────────────
ENV_FILE="$APP_DIR/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
    log "Creazione .env con SECRET_KEY generata..."
    cp "$APP_DIR/backend/.env.example" "$ENV_FILE"
    SECRET_KEY=$(openssl rand -hex 32)
    sed -i "s|change-me-in-production-use-openssl-rand-hex-32|${SECRET_KEY}|" "$ENV_FILE"
    # Set absolute paths
    sed -i "s|DATABASE_URL=sqlite:///\./|DATABASE_URL=sqlite:////|" "$ENV_FILE"
    sed -i "s|bibliotrack.db|${APP_DIR}/backend/bibliotrack.db|" "$ENV_FILE"
    sed -i "s|COVERS_DIR=\./static/covers|COVERS_DIR=${APP_DIR}/backend/static/covers|" "$ENV_FILE"
    chown "$APP_USER:$APP_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    ok ".env creato (SECRET_KEY generata automaticamente)"
else
    warn ".env già esistente — non sovrascritto"
fi

# ── Systemd service ───────────────────────────────────────────────────────────
log "Installazione servizio systemd..."
sed "s|/opt/bibliotrack|${APP_DIR}|g" "$SCRIPT_DIR/bibliotrack.service" \
    > /etc/systemd/system/bibliotrack.service
systemctl daemon-reload
systemctl enable bibliotrack
systemctl restart bibliotrack
sleep 2

if systemctl is-active --quiet bibliotrack; then
    ok "Servizio bibliotrack avviato"
else
    die "Servizio non avviato — controlla: journalctl -u bibliotrack"
fi

# ── Nginx ─────────────────────────────────────────────────────────────────────
log "Configurazione nginx..."
sed "s|/opt/bibliotrack|${APP_DIR}|g" "$SCRIPT_DIR/nginx.conf" \
    > /etc/nginx/sites-available/bibliotrack
ln -sf /etc/nginx/sites-available/bibliotrack /etc/nginx/sites-enabled/bibliotrack
[[ -f /etc/nginx/sites-enabled/default ]] && rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ok "Nginx configurato"

# ── Installa backup script ─────────────────────────────────────────────────────
cp "$SCRIPT_DIR/backup.sh" "$APP_DIR/backup.sh"
sed -i "s|/opt/bibliotrack|${APP_DIR}|g" "$APP_DIR/backup.sh"
chmod +x "$APP_DIR/backup.sh"
chown "$APP_USER:$APP_USER" "$APP_DIR/backup.sh"

# Cron giornaliero backup (ore 3:00)
CRON_JOB="0 3 * * * $APP_USER $APP_DIR/backup.sh >> /var/log/bibliotrack-backup.log 2>&1"
if ! grep -qF "bibliotrack" /etc/crontab 2>/dev/null; then
    echo "$CRON_JOB" >> /etc/crontab
    ok "Backup automatico schedulato (ogni notte ore 3:00)"
fi

# ── Crea primo admin (opzionale, via Python diretto — /auth/register rimosso per sicurezza) ──
echo ""
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
read -r -p "Vuoi creare l'account admin ora? [S/n] " CREATE_ADMIN
CREATE_ADMIN="${CREATE_ADMIN:-S}"
if [[ "${CREATE_ADMIN,,}" == "s" ]]; then
    read -r -p "  Username admin: " ADMIN_USER
    read -r -p "  Email admin: "    ADMIN_EMAIL
    read -r -s -p "  Password admin (min 8 caratteri): " ADMIN_PASS; echo
    if [[ ${#ADMIN_PASS} -lt 8 ]]; then
        warn "Password troppo corta (min 8 caratteri) — utente non creato"
    else
        sudo -u "$APP_USER" \
            DATABASE_URL="sqlite:////${APP_DIR}/backend/bibliotrack.db" \
            COVERS_DIR="${APP_DIR}/backend/static/covers" \
            SECRET_KEY="$(grep SECRET_KEY "$ENV_FILE" | cut -d= -f2)" \
            "$APP_DIR/venv/bin/python3" - <<PYEOF
import os, sys
sys.path.insert(0, '${APP_DIR}/backend')
from database import engine, Base, SessionLocal
from models.user import User, UserRole
from services.auth_service import hash_password
Base.metadata.create_all(bind=engine)
db = SessionLocal()
username = '${ADMIN_USER}'
if not db.query(User).filter(User.username == username).first():
    db.add(User(
        username=username,
        email='${ADMIN_EMAIL}',
        hashed_password=hash_password('${ADMIN_PASS}'),
        role=UserRole.admin,
        is_active=True,
    ))
    db.commit()
    print(f"✓ Admin creato: {username}")
else:
    print(f"Utente '{username}' già esistente")
db.close()
PYEOF
        ok "Account admin '$ADMIN_USER' creato"
    fi
fi

# ── Sommario ──────────────────────────────────────────────────────────────────
SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗"
echo -e "║   ✅  BiblioTrack installato con successo!    ║"
echo -e "╚══════════════════════════════════════════════╝${NC}"
echo ""
info "App:    http://${SERVER_IP}"
info "API:    http://${SERVER_IP}/health"
info "Docs:   http://${SERVER_IP}/docs  (solo se DEBUG=true)"
echo ""
info "Comandi utili:"
info "  sudo systemctl status bibliotrack"
info "  sudo journalctl -u bibliotrack -f"
info "  sudo systemctl restart bibliotrack"
info "  sudo bash ${APP_DIR}/backup.sh"
echo ""
warn "Per HTTPS: sudo apt install certbot python3-certbot-nginx"
warn "           sudo certbot --nginx -d tuodominio.it"
echo ""
