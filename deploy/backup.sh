#!/usr/bin/env bash
# BiblioTrack — backup SQLite giornaliero
# Esegui: sudo bash /opt/bibliotrack/backup.sh
# Cron automatico configurato da setup.sh
set -euo pipefail

APP_DIR="/opt/bibliotrack"
BACKUP_DIR="$APP_DIR/backups"
DB_PATH="$APP_DIR/backend/bibliotrack.db"
KEEP_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/bibliotrack_${DATE}.db"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$DB_PATH" ]]; then
    echo "$(date): Database non trovato: $DB_PATH" >&2
    exit 1
fi

# Usa sqlite3 .backup per backup sicuro a caldo (no lock, no corruption)
if command -v sqlite3 &>/dev/null; then
    sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
else
    # Fallback: copia diretta (richiede app ferma per sicurezza)
    cp "$DB_PATH" "$BACKUP_FILE"
fi

# Comprimi
gzip -f "$BACKUP_FILE"
FINAL="${BACKUP_FILE}.gz"

SIZE=$(du -sh "$FINAL" | cut -f1)
echo "$(date): Backup OK → $FINAL ($SIZE)"

# Rimuovi backup più vecchi di KEEP_DAYS giorni
find "$BACKUP_DIR" -name "bibliotrack_*.db.gz" -mtime "+${KEEP_DAYS}" -delete
REMAINING=$(find "$BACKUP_DIR" -name "bibliotrack_*.db.gz" | wc -l)
echo "$(date): Backup mantenuti: $REMAINING (max ${KEEP_DAYS}gg)"
