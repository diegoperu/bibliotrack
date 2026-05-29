#!/bin/sh
set -e

# ── Directory dati (volume montato da Unraid / host) ──────────────────────────
mkdir -p /data/db /data/covers

# ── Variabili d'ambiente con default Docker ───────────────────────────────────
export DATABASE_URL="${DATABASE_URL:-sqlite:////data/db/bibliotrack.db}"
export COVERS_DIR="${COVERS_DIR:-/data/covers}"

# SECRET_KEY obbligatoria
if [ -z "${SECRET_KEY:-}" ]; then
    echo "ERRORE: SECRET_KEY non impostata."
    echo "  Genera con: openssl rand -hex 32"
    echo "  Poi imposta la variabile d'ambiente SECRET_KEY nel container."
    exit 1
fi

# ── Crea admin al primo avvio (se ADMIN_PASSWORD impostata e DB nuovo) ────────
DB_FILE="/data/db/bibliotrack.db"
if [ -n "${ADMIN_PASSWORD:-}" ] && [ ! -s "${DB_FILE}" ]; then
    echo "Primo avvio: creazione utente admin '${ADMIN_USERNAME:-admin}'..."
    cd /app/backend && python3 - <<'PYEOF'
import os, sys
sys.path.insert(0, '/app/backend')

from database import engine, Base, SessionLocal
from models.user import User, UserRole
from services.auth_service import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

username = os.environ.get('ADMIN_USERNAME', 'admin')
email    = os.environ.get('ADMIN_EMAIL',    'admin@bibliotrack.local')
password = os.environ.get('ADMIN_PASSWORD', '')

if not db.query(User).filter(User.username == username).first():
    db.add(User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        role=UserRole.admin,
        is_active=True,
    ))
    db.commit()
    print(f"✓ Admin creato: {username}")
else:
    print(f"Admin '{username}' già esistente")

db.close()
PYEOF
fi

# ── Avvia supervisor (nginx + uvicorn) ────────────────────────────────────────
echo "Avvio BiblioTrack (nginx + uvicorn)..."
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
