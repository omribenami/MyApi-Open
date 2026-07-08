#!/bin/bash
# Auto-update Docker CE if a newer version is available.
# Runs as root. Container restarts automatically via restart: unless-stopped.

set -euo pipefail

DATE=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[$DATE] $1"; }

apt-get update -qq 2>/dev/null

UPGRADABLE=$(apt list --upgradable 2>/dev/null \
  | grep -E "^(docker-ce|docker-ce-cli|containerd\.io|docker-compose-plugin)/" \
  | awk -F'[ /]' '{print $1, $3}' || true)

if [ -z "$UPGRADABLE" ]; then
  log "Docker is up to date — no action taken."
  exit 0
fi

log "Updates available:"
echo "$UPGRADABLE" | while read -r line; do log "  $line"; done

log "Upgrading Docker packages..."
DEBIAN_FRONTEND=noninteractive apt-get install -y --only-upgrade \
  docker-ce docker-ce-cli containerd.io docker-compose-plugin

NEW_VERSION=$(docker --version)
log "Upgrade complete. $NEW_VERSION"

# Container comes back on its own via restart: unless-stopped.
# Verify it recovered within 30 seconds.
sleep 45
if docker ps --filter "name=myapi-platform" --filter "status=running" | grep -q "myapi-platform"; then
  log "Container myapi-platform is running OK."
else
  log "WARNING: myapi-platform not running after upgrade — attempting start..."
  docker compose --env-file /opt/MyApi/.env -f /opt/MyApi/src/docker-compose.yml up -d 2>&1 | tee -a "$LOG"
fi
