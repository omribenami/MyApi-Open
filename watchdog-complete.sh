#!/bin/bash

# Complete watchdog for MyApi server + Cloudflare tunnel
# Checks every 30 seconds, restarts if either dies

set -e

MYAPI_DIR="${PROJECT_DIR:-/opt/MyApi-Open}"
CLOUDFLARE_DIR="${CLOUDFLARED_CONFIG_DIR:-/etc/cloudflared}"
LOG_FILE="/tmp/myapi-watchdog.log"
MYAPI_LOG="/tmp/myapi.log"
CLOUDFLARE_LOG="/tmp/cloudflare-myapi.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

check_and_restart_server() {
    if ! lsof -i :4500 > /dev/null 2>&1; then
        log "⚠️ MyApi server down (port 4500 not listening), restarting..."
        pkill -9 -f "node.*index.js" 2>/dev/null || true
        sleep 2
        cd "$MYAPI_DIR" && node src/index.js > "$MYAPI_LOG" 2>&1 &
        sleep 5
        if lsof -i :4500 > /dev/null 2>&1; then
            log "✓ MyApi server restarted and listening on port 4500"
        else
            log "❌ Failed to restart MyApi server"
        fi
    fi
}

check_and_restart_tunnel() {
    if ! pgrep -f "cloudflared.*config-myapi" > /dev/null; then
        log "⚠️ Cloudflare tunnel down, restarting..."
        pkill -f "cloudflared.*config-myapi" 2>/dev/null || true
        sleep 2
        cd "$CLOUDFLARE_DIR" && ${CLOUDFLARED_BIN:-cloudflared} tunnel --config config-myapi.yml run myapi-prod > "$CLOUDFLARE_LOG" 2>&1 &
        sleep 10
        if pgrep -f "cloudflared.*config-myapi" > /dev/null; then
            log "✓ Cloudflare tunnel restarted"
        else
            log "❌ Failed to restart Cloudflare tunnel"
        fi
    fi
}

check_server_responsive() {
    if ! curl -s http://localhost:4500/api/v1/ | grep -q "MyApi"; then
        log "⚠️ MyApi not responding, restarting..."
        pkill -9 -f "node.*MyApi" 2>/dev/null || true
        sleep 2
        check_and_restart_server
    fi
}

log "🚀 MyApi Watchdog started"

while true; do
    check_and_restart_server
    check_and_restart_tunnel
    check_server_responsive
    sleep 30
done
