#!/bin/bash
# MyApi SQLite Backup Script
# - Creates a consistent SQLite backup
# - Encrypts with AES-256-CBC (BACKUP_ENCRYPTION_KEY from .env)
# - Keeps last 7 local encrypted backups
# - Uploads encrypted file to Supabase Storage

set -euo pipefail

# Load keys from .env
SUPABASE_SERVICE_KEY=$(grep -E '^SUPABASE_SERVICE_KEY=' /opt/MyApi/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
ENCRYPTION_KEY=$(grep -E '^BACKUP_ENCRYPTION_KEY=' /opt/MyApi/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

if [ -z "$ENCRYPTION_KEY" ]; then
  echo "[backup] ERROR: BACKUP_ENCRYPTION_KEY not set in .env — aborting." >&2
  exit 1
fi

CONTAINER="myapi-platform"
BACKUP_DIR="/opt/MyApi/backups"
DATE=$(date +%Y%m%d-%H%M%S)
PLAIN_FILE="$BACKUP_DIR/myapi-$DATE.db"
ENC_FILE="$PLAIN_FILE.enc"

SUPABASE_PROJECT_REF="hamdecobkbdzvzkxoqqr"
SUPABASE_BUCKET="db-backups"

mkdir -p "$BACKUP_DIR"

# Create consistent backup via SQLite's .backup (safe while DB is live)
echo "[backup] Creating backup..."
docker exec "$CONTAINER" node -e "
  const db = require('better-sqlite3')('/app/data/myapi.db');
  db.backup('/app/data/backup-temp.db').then(() => {
    console.log('backup done');
    db.close();
  });
"
docker cp "$CONTAINER":/app/data/backup-temp.db "$PLAIN_FILE"
docker exec "$CONTAINER" rm -f /app/data/backup-temp.db

SIZE=$(du -sh "$PLAIN_FILE" | cut -f1)
echo "[backup] Plaintext snapshot: $PLAIN_FILE ($SIZE)"

# Encrypt with AES-256-CBC + PBKDF2
openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
  -in "$PLAIN_FILE" -out "$ENC_FILE" \
  -pass pass:"$ENCRYPTION_KEY"

# Remove plaintext immediately after encryption
rm -f "$PLAIN_FILE"
echo "[backup] Encrypted: $ENC_FILE"

# Keep only last 7 local encrypted backups
ls -t "$BACKUP_DIR"/myapi-*.db.enc 2>/dev/null | tail -n +8 | xargs -r rm --
echo "[backup] Local retention: $(ls "$BACKUP_DIR"/myapi-*.db.enc 2>/dev/null | wc -l) backups kept"

# Upload encrypted file to Supabase Storage
if [ -n "${SUPABASE_SERVICE_KEY:-}" ]; then
  FILENAME=$(basename "$ENC_FILE")
  echo "[backup] Uploading to Supabase: $SUPABASE_BUCKET/$FILENAME"

  HTTP_STATUS=$(curl -s -o /tmp/supabase-upload-response.txt -w "%{http_code}" \
    --max-time 60 \
    -X POST \
    "https://$SUPABASE_PROJECT_REF.supabase.co/storage/v1/object/$SUPABASE_BUCKET/$FILENAME" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$ENC_FILE" || echo "000")

  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    echo "[backup] Upload successful (HTTP $HTTP_STATUS)"
  else
    echo "[backup] WARNING: Upload failed (HTTP $HTTP_STATUS): $(cat /tmp/supabase-upload-response.txt)" >&2
    echo "[backup] Local encrypted backup retained at $ENC_FILE"
  fi

  # Keep only last 7 remote backups
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
