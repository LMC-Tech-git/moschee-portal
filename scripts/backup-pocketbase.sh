#!/bin/bash
# =========================================
# PocketBase Daily Backup Script
# Moschee-Portal V1
# =========================================
#
# Erstellt ein tägliches Backup des PocketBase-Datenverzeichnisses
# und behält die letzten 7 Backups (Rotation).
#
# SETUP:
# 1. Pfade anpassen (PB_DATA_DIR, BACKUP_DIR)
# 2. Script ausführbar machen: chmod +x scripts/backup-pocketbase.sh
# 3. Cron-Job einrichten (als root oder pocketbase-user):
#    crontab -e
#    0 2 * * * /pfad/zu/moschee-portal/scripts/backup-pocketbase.sh >> /var/log/moschee-backup.log 2>&1
#
# RESTORE:
# tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz -C /pfad/zu/restore/
# =========================================

set -euo pipefail

# --- Konfiguration ---
PB_DATA_DIR="${PB_DATA_DIR:-/opt/pocketbase/pb_data}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/pocketbase}"
KEEP_DAYS=7
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup-${TIMESTAMP}.tar.gz"

# --- Prüfungen ---
if [ ! -d "$PB_DATA_DIR" ]; then
  echo "[FEHLER] PocketBase-Datenverzeichnis nicht gefunden: $PB_DATA_DIR"
  exit 1
fi

# Backup-Verzeichnis erstellen falls nötig
mkdir -p "$BACKUP_DIR"

# --- Backup erstellen ---
echo "[$(date)] Starte Backup von $PB_DATA_DIR..."

tar -czf "$BACKUP_FILE" -C "$(dirname "$PB_DATA_DIR")" "$(basename "$PB_DATA_DIR")"

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup erstellt: $BACKUP_FILE ($FILESIZE)"

# --- Alte Backups rotieren ---
DELETED=0
find "$BACKUP_DIR" -name "backup-*.tar.gz" -type f -mtime +$KEEP_DAYS | while read -r OLD_BACKUP; do
  rm -f "$OLD_BACKUP"
  echo "[$(date)] Altes Backup gelöscht: $OLD_BACKUP"
  DELETED=$((DELETED + 1))
done

TOTAL=$(find "$BACKUP_DIR" -name "backup-*.tar.gz" -type f | wc -l)
echo "[$(date)] Backup abgeschlossen. $TOTAL Backups vorhanden."
