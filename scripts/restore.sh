#!/bin/bash
# MyApi SQLite Restore Script
# Usage:
#   ./scripts/restore.sh                        # list available backups
#   ./scripts/restore.sh local                  # restore latest local backup
#   ./scripts/restore.sh local myapi-20260329.db  # restore specific local backup
#   ./scripts/restore.sh remote                 # restore latest remote (Supabase) backup
#   ./scripts/restore.sh remote myapi-20260329.db # restore specific remote backup

set -euo pipefail

# Load env vars
set -a; source /opt/MyApi/.env; set +a

BACKUP_DIR="/opt/MyApi/backups"
COMPOSE_FILE="/opt/MyApi/docker-compose.prod.yml"
SUPABASE_PROJECT_REF="hamdecobkbdzvzkxoqqr"
SUPABASE_BUCKET="db-backups"

list_local() {
  echo "Local backups:"
  ls -lht "$BACKUP_DIR"/myapi-*.db 2>/dev/null | awk '{print "  "$NF, "("$5")"}' || echo "  (none)"
}

list_remote() {
  echo "Remote backups (Supabase):"
  curl -s \
    "https://$SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/list/$SUPABASE_BUCKET" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prefix":"","sortBy":{"column":"created_at","order":"desc"}}' \
    | node -e "
      let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
        try {
          const files = JSON.parse(d);
          if (!Array.isArray(files) || files.length === 0) { console.log('  (none)'); return; }
          files.forEach(f => console.log('  ' + f.name + '  (' + new Date(f.created_at).toLocaleString() + ')'));
        } catch(e) { console.log('  Error parsing response:', d.slice(0,200)); }
      });
    "
}

do_restore() {
  local backup_file="$1"

  # Validate the backup
  echo "[restore] Validating backup..."
  INTEGRITY=$(node -e "
    const db = require('better-sqlite3')('$backup_file', { readonly: true });
    const result = db.pragma('integrity_check', { simple: true });
    console.log(result);
    db.close();
  " 2>&1)

  if [ "$INTEGRITY" != "ok" ]; then
    echo "[restore] ERROR: Backup integrity check failed: $INTEGRITY"
    exit 1
  fi

  USER_COUNT=$(node -e "
    const db = require('better-sqlite3')('$backup_file', { readonly: true });
    console.log(db.prepare('SELECT COUNT(*) as c FROM users').get().c);
    db.close();
  " 2>&1)

  echo "[restore] Backup looks good: $USER_COUNT user(s) found"
  echo ""
  read -p "[restore] Stop container and restore? This will replace the live database. [y/N] " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "[restore] Aborted."
    exit 0
  fi

  # Stop container
  echo "[restore] Stopping container..."
  docker compose -f "$COMPOSE_FILE" stop myapi

  # Copy current DB as emergency backup
  EMERGENCY="/opt/MyApi/backups/pre-restore-emergency-$(date +%Y%m%d-%H%M%S).db"
  docker run --rm -v myapi_myapi-data:/data -v /opt/MyApi/backups:/out alpine \
    cp /data/myapi.db "/out/$(basename $EMERGENCY)" 2>/dev/null || true
  echo "[restore] Current DB saved to: $EMERGENCY"

  # Copy backup into volume, clear WAL
  docker run --rm \
    -v myapi_myapi-data:/data \
    -v "$(dirname $backup_file):/src" \
    alpine sh -c "
      cp /src/$(basename $backup_file) /data/myapi.db
      rm -f /data/myapi.db-shm /data/myapi.db-wal
      echo 'Volume updated.'
    "

  # Start container
  echo "[restore] Starting container..."
  docker compose -f "$COMPOSE_FILE" up -d

  echo ""
  echo "[restore] Done! Restored from: $(basename $backup_file)"
}

SOURCE="${1:-list}"
TARGET="${2:-}"

case "$SOURCE" in
  list)
    list_local
    echo ""
    list_remote
    ;;

  local)
    if [ -z "$TARGET" ]; then
      BACKUP_FILE=$(ls -t "$BACKUP_DIR"/myapi-*.db 2>/dev/null | head -1)
      if [ -z "$BACKUP_FILE" ]; then
        echo "No local backups found in $BACKUP_DIR"
        exit 1
      fi
      echo "[restore] Using latest local backup: $(basename $BACKUP_FILE)"
    else
      BACKUP_FILE="$BACKUP_DIR/$TARGET"
      if [ ! -f "$BACKUP_FILE" ]; then
        echo "Backup not found: $BACKUP_FILE"
        list_local
        exit 1
      fi
    fi
    do_restore "$BACKUP_FILE"
    ;;

  remote)
    if [ -z "${SUPABASE_SERVICE_KEY:-}" ]; then
      echo "SUPABASE_SERVICE_KEY not set in .env"
      exit 1
    fi

    if [ -z "$TARGET" ]; then
      TARGET=$(curl -s \
        "https://$SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/list/$SUPABASE_BUCKET" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
        -H "Content-Type: application/json" \
        -d '{"prefix":"","sortBy":{"column":"created_at","order":"desc"}}' \
        | node -e "
          let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
            const files = JSON.parse(d);
            if (files.length > 0) console.log(files[0].name);
          });
        ")
      if [ -z "$TARGET" ]; then
        echo "No remote backups found."
        exit 1
      fi
      echo "[restore] Using latest remote backup: $TARGET"
    fi

    DOWNLOAD_PATH="/tmp/$TARGET"
    echo "[restore] Downloading $TARGET from Supabase..."
    HTTP_STATUS=$(curl -s -o "$DOWNLOAD_PATH" -w "%{http_code}" \
      "https://$SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/$SUPABASE_BUCKET/$TARGET" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

    if [ "$HTTP_STATUS" != "200" ]; then
      echo "[restore] Download failed (HTTP $HTTP_STATUS)"
      exit 1
    fi

    echo "[restore] Downloaded to $DOWNLOAD_PATH"
    do_restore "$DOWNLOAD_PATH"
    ;;

  *)
    echo "Usage: $0 [list|local|remote] [filename]"
    exit 1
    ;;
esac
