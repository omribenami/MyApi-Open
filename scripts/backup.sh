#!/bin/bash
# MyApi SQLite Backup Script
# - Creates a consistent SQLite backup
# - Keeps last 7 local backups
# - Uploads to Supabase Storage (if SUPABASE_SERVICE_KEY is set)

set -euo pipefail

# Load env vars (picks up SUPABASE_SERVICE_KEY)
set -a; source ${APP_DIR:-/opt/MyApi-Open}/.env; set +a

DB_VOLUME_PATH="/var/lib/docker/volumes/myapi_myapi-data/_data/myapi.db"
BACKUP_DIR="${APP_DIR:-/opt/MyApi-Open}/backups"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/myapi-$DATE.db"

SUPABASE_PROJECT_REF="hamdecobkbdzvzkxoqqr"
SUPABASE_BUCKET="db-backups"

mkdir -p "$BACKUP_DIR"

# Create consistent backup using SQLite's .backup (safe even while DB is live)
echo "[backup] Creating backup: $BACKUP_FILE"
docker exec myapi node -e "
  const db = require('better-sqlite3')('/app/data/myapi.db');
  db.backup('/app/data/backup-temp.db').then(() => {
    console.log('backup done');
    db.close();
  });
"

# Copy the backup out of the container
docker cp myapi:/app/data/backup-temp.db "$BACKUP_FILE"
docker exec myapi rm -f /app/data/backup-temp.db

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[backup] Saved $BACKUP_FILE ($SIZE)"

# Keep only last 7 local backups
ls -t "$BACKUP_DIR"/myapi-*.db 2>/dev/null | tail -n +8 | xargs -r rm --
echo "[backup] Local retention: $(ls "$BACKUP_DIR"/myapi-*.db | wc -l) backups kept"

# Upload to Supabase Storage (requires SUPABASE_SERVICE_KEY env var)
if [ -n "${SUPABASE_SERVICE_KEY:-}" ]; then
  FILENAME=$(basename "$BACKUP_FILE")
  echo "[backup] Uploading to Supabase Storage: $SUPABASE_BUCKET/$FILENAME"

  HTTP_STATUS=$(curl -s -o /tmp/supabase-upload-response.txt -w "%{http_code}" \
    -X POST \
    "https://$SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/$SUPABASE_BUCKET/$FILENAME" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$BACKUP_FILE")

  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    echo "[backup] Upload successful (HTTP $HTTP_STATUS)"
  else
    echo "[backup] Upload failed (HTTP $HTTP_STATUS): $(cat /tmp/supabase-upload-response.txt)"
    exit 1
  fi

  # Keep only last 7 remote backups (delete older ones)
  # List and delete oldest via Supabase Storage API
  REMOTE_FILES=$(curl -s \
    "https://$SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/list/$SUPABASE_BUCKET" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prefix":"","sortBy":{"column":"created_at","order":"asc"}}' \
    | node -e "
      let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
        const files = JSON.parse(d);
        if (files.length > 7) files.slice(0, files.length-7).forEach(f=>console.log(f.name));
      });
    " 2>/dev/null || true)

  if [ -n "$REMOTE_FILES" ]; then
    while IFS= read -r fname; do
      echo "[backup] Removing old remote backup: $fname"
      curl -s -X DELETE \
        "https://$SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/$SUPABASE_BUCKET/$fname" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" > /dev/null
    done <<< "$REMOTE_FILES"
  fi
else
  echo "[backup] SUPABASE_SERVICE_KEY not set — skipping remote upload"
fi

echo "[backup] Done."
