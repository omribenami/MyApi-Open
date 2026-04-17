#!/bin/bash

# MyApi Watchdog - Auto-restarts server and tunnel if they crash
# Monitors both processes every 30 seconds

set -e

PROJECT_DIR="${PROJECT_DIR:-/opt/MyApi-Open}"
LOG_FILE="/tmp/myapi-watchdog.log"
API_PORT=4500
TUNNEL_PID_FILE="/tmp/myapi-tunnel.pid"
SERVER_PID_FILE="/tmp/myapi-server.pid"

function log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

function check_server() {
  if ! curl -s http://localhost:$API_PORT/api/v1/ > /dev/null 2>&1; then
    log "ERROR: Server not responding on port $API_PORT"
    return 1
  fi
  return 0
}

function check_tunnel() {
  if ! ps aux | grep -v grep | grep "cloudflared tunnel.*myapi-prod" > /dev/null; then
    log "ERROR: Cloudflare tunnel not running"
    return 1
  fi
  return 0
}

function restart_server() {
  log "RESTARTING SERVER..."
  pkill -f "node src/index.js" || true
  sleep 2
  cd "$PROJECT_DIR"
  nohup node src/index.js > /tmp/myapi.log 2>&1 &
  SERVER_PID=$!
  echo $SERVER_PID > "$SERVER_PID_FILE"
  sleep 5
  
  if check_server; then
    log "✅ Server restarted successfully (PID: $SERVER_PID)"
    return 0
  else
    log "❌ Server failed to start"
    return 1
  fi
}

function restart_tunnel() {
  log "RESTARTING TUNNEL..."
  pkill -f "cloudflared tunnel.*myapi-prod" || true
  sleep 2
  ${CLOUDFLARED_BIN:-cloudflared} tunnel --config ${CLOUDFLARED_CONFIG:-/etc/cloudflared/config.yml} run myapi-prod > /tmp/cloudflare-myapi.log 2>&1 &
  TUNNEL_PID=$!
  echo $TUNNEL_PID > "$TUNNEL_PID_FILE"
  sleep 3
  
  if check_tunnel; then
    log "✅ Tunnel restarted successfully (PID: $TUNNEL_PID)"
    return 0
  else
    log "❌ Tunnel failed to start"
    return 1
  fi
}

function main() {
  log "🔍 MyApi Watchdog started"
  log "Monitoring server on port $API_PORT and Cloudflare tunnel"
  log "Health check interval: 30 seconds"
  
  # Initial startup
  if ! check_server; then
    restart_server
  fi
  
  if ! check_tunnel; then
    restart_tunnel
  fi
  
  # Monitoring loop
  while true; do
    sleep 30
    
    # Check server health
    if ! check_server; then
      log "⚠️  Server health check failed, attempting restart..."
      restart_server || log "❌ Server restart failed"
    fi
    
    # Check tunnel health
    if ! check_tunnel; then
      log "⚠️  Tunnel health check failed, attempting restart..."
      restart_tunnel || log "❌ Tunnel restart failed"
    fi
  done
}

# Run main loop
main
