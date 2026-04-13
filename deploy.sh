#!/bin/bash
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$REPO_DIR/src"
COMPOSE_FILE="$SRC_DIR/docker-compose.yml"
ENV_FILE="$REPO_DIR/.env"

BUILD_CONNECTORS=false
BUILD_CONNECTORS_ONLY=false
BUILD_AFP_APP=false

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --connector-build|-cb)
      BUILD_CONNECTORS=true
      ;;
    --build-connectors-only|-bco)
      BUILD_CONNECTORS_ONLY=true
      BUILD_CONNECTORS=true
      ;;
    --build-afp-app|-baa)
      BUILD_AFP_APP=true
      ;;
    *)
      echo "[deploy] Unknown flag: $arg"
      echo "Usage: $0 [--connector-build|-cb] [--build-connectors-only|-bco] [--build-afp-app|-baa]"
      exit 1
      ;;
  esac
done

echo "[deploy] Pulling latest code..."
cd "$REPO_DIR"
git pull

# ── Connector builds ────────────────────────────────────────────────────────
build_connectors() {
  echo "[deploy] Building connectors..."

  # AFP OAuth daemon (Linux only — server binary)
  AFP_OAUTH_DIR="$REPO_DIR/connectors/afp-oauth"
  if [ -d "$AFP_OAUTH_DIR" ]; then
    echo "[deploy]   Building afp-oauth (Linux x64)..."
    cd "$AFP_OAUTH_DIR"
    npm install --silent
    npm run build:linux
    echo "[deploy]   afp-oauth-linux built: $(du -sh "$AFP_OAUTH_DIR/dist/afp-oauth-linux" 2>/dev/null | cut -f1)"
    cd "$REPO_DIR"
  else
    echo "[deploy]   WARNING: $AFP_OAUTH_DIR not found, skipping."
    return
  fi

  if [ "$BUILD_CONNECTORS_ONLY" = true ]; then
    # Hot-copy into running container (no Docker rebuild needed)
    CONTAINER=$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q myapi 2>/dev/null | head -1)
    if [ -n "$CONTAINER" ]; then
      echo "[deploy]   Copying binaries into running container..."
      docker exec "$CONTAINER" mkdir -p /app/afp-oauth-dist
      docker cp "$AFP_OAUTH_DIR/dist/afp-oauth-linux" "$CONTAINER:/app/afp-oauth-dist/afp-oauth-linux"
      # Also copy Mac/Windows from git-tracked dist (they don't need rebuilding)
      for f in afp-oauth-mac-arm afp-oauth-mac-x64 afp-oauth-win.exe; do
        [ -f "$AFP_OAUTH_DIR/dist/$f" ] && docker cp "$AFP_OAUTH_DIR/dist/$f" "$CONTAINER:/app/afp-oauth-dist/$f"
      done
      echo "[deploy]   Binaries hot-swapped in container — no restart needed."
    else
      echo "[deploy]   WARNING: Container not running. Start with ./deploy.sh first."
    fi
  else
    # Stage into src/ so Docker COPY . . picks them up
    echo "[deploy]   Staging binaries for Docker build..."
    mkdir -p "$SRC_DIR/afp-oauth-dist"
    cp "$AFP_OAUTH_DIR/dist/afp-oauth-linux" "$SRC_DIR/afp-oauth-dist/"
    for f in afp-oauth-mac-arm afp-oauth-mac-x64 afp-oauth-win.exe; do
      [ -f "$AFP_OAUTH_DIR/dist/$f" ] && cp "$AFP_OAUTH_DIR/dist/$f" "$SRC_DIR/afp-oauth-dist/$f"
    done
    echo "[deploy]   Staged: $(ls -1 "$SRC_DIR/afp-oauth-dist/")"
  fi

  echo "[deploy] Connectors built."
}

if [ "$BUILD_CONNECTORS" = true ]; then
  build_connectors
fi

# ── AFP App (Electron — macOS/Windows only) ──────────────────────────────────
if [ "$BUILD_AFP_APP" = true ]; then
  AFP_APP_DIR="$REPO_DIR/connectors/afp-app"
  OS="$(uname)"
  if [ "$OS" != "Darwin" ] && [ "$OS" != "MINGW64_NT" ] && [ "$OS" != "CYGWIN" ]; then
    echo "[deploy] WARNING: --build-afp-app requires macOS (for .dmg) or Windows (for .exe)."
    echo "[deploy] Current OS: $OS — skipping Electron build."
    echo "[deploy] Run this flag on a Mac or Windows CI runner, then upload dist/ to GitHub Releases."
  else
    echo "[deploy] Building afp-app (Electron)..."
    cd "$AFP_APP_DIR"
    npm install --silent
    npm run build:all
    echo "[deploy] afp-app built:"
    ls -1 "$AFP_APP_DIR/dist/" 2>/dev/null || true
    cd "$REPO_DIR"
  fi
fi

# Stop here if connectors-only mode
if [ "$BUILD_CONNECTORS_ONLY" = true ]; then
  echo "[deploy] Done."
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "[deploy] ERROR: .env file not found at $ENV_FILE — aborting."
  exit 1
fi

# Detect environment
NODE_ENV=$(grep -E '^\s*NODE_ENV\s*=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' ' || true)
NODE_ENV="${NODE_ENV:-production}"

# ── Dev environment: restart via PM2, no Docker ──────────────────────────────
if [ "$NODE_ENV" = "development" ] || [ "$NODE_ENV" = "dev" ]; then
  echo "[deploy] Dev environment detected — skipping Docker, restarting via PM2..."

  echo "[deploy] Building frontend..."
  cd "$REPO_DIR/src/public/dashboard-app"
  npm install --silent
  npm run build
  echo "[deploy] Frontend built."

  # Kill any stray process holding the port (e.g. orphaned node from a previous run)
  PORT=$(grep -E '^\s*PORT\s*=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' ' || true)
  PORT="${PORT:-4500}"
  STALE_PIDS=$(ss -tlnp "sport = :$PORT" 2>/dev/null | grep -oP '(?<=pid=)\d+' | sort -u || true)
  if [ -n "$STALE_PIDS" ]; then
    echo "[deploy] Clearing stale port $PORT processes: $STALE_PIDS"
    kill -9 $STALE_PIDS 2>/dev/null || true
    sleep 1
  fi

  cd "$SRC_DIR"
  if pm2 list | grep -q "myapi-platform"; then
    pm2 restart myapi-platform --update-env
    echo "[deploy] PM2 process restarted."
  else
    pm2 start ecosystem.config.js --env development
    echo "[deploy] PM2 process started."
  fi
  pm2 status myapi-platform
  echo "[deploy] Done."
  exit 0
fi

# ── Docker build & restart ───────────────────────────────────────────────────
echo "[deploy] Building Docker image..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build

echo "[deploy] Restarting container..."

# Stop and remove ALL containers using the port, not just compose-managed ones,
# to avoid stale containers from previous deployments blocking the port.
PORT=$(grep -E '^\s*PORT\s*=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2 | tr -d ' ' || true)
PORT="${PORT:-4500}"
BLOCKING=$(docker ps -q --filter "publish=$PORT" 2>/dev/null || true)
if [ -n "$BLOCKING" ]; then
  echo "[deploy] Stopping containers blocking port $PORT: $BLOCKING"
  docker stop $BLOCKING 2>/dev/null || true
  docker rm $BLOCKING 2>/dev/null || true
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down --remove-orphans

# Safety: kill any lingering docker-proxy processes still holding the port
STALE_PIDS=$(ss -tlnp "sport = :$PORT" 2>/dev/null | grep -oP '(?<=pid=)\d+' | sort -u || true)
if [ -n "$STALE_PIDS" ]; then
  echo "[deploy] Clearing stale port processes: $STALE_PIDS"
  kill -9 $STALE_PIDS 2>/dev/null || true
  sleep 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

echo "[deploy] Waiting for health check..."
sleep 5
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "[deploy] Done."
