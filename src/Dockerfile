# Production Dockerfile for MyApi
# Build context: repo root (one level above src/)
FROM node:22

WORKDIR /app

# ── Static assets (rarely change — keep near top for layer caching) ────────────

# Legal docs (Privacy Policy, Terms of Use)
COPY docs/ /docs/

# AFP daemon + OAuth binaries
RUN mkdir -p afp-dist afp-oauth-dist
COPY connectors/afp-daemon/dist/ afp-dist/
COPY connectors/afp-oauth/dist/ afp-oauth-dist/

# Agent Auth installer script (served at /api/v1/agent-auth/install.js)
COPY connectors/agent-auth/ connectors/agent-auth/

# ── Dependency install (cached until package.json/lock changes) ────────────────
# Copy manifests BEFORE the full source so these expensive steps only re-run
# when dependencies actually change, not on every source file edit.

COPY src/package*.json ./
COPY src/public/dashboard-app/package*.json public/dashboard-app/

# Backend deps
RUN npm install --no-audit

# Force-rebuild better-sqlite3 from source so it targets this container's GLIBC
# (prebuilt binary targets GLIBC 2.38, Debian Bookworm has 2.36)
RUN npm rebuild better-sqlite3 --build-from-source

# Frontend deps
RUN cd public/dashboard-app && npm install --no-audit

# ── Source copy (always invalidates cache — but expensive steps are above) ──────

COPY src/ .

# Build frontend (must run after source copy to pick up latest UI changes)
RUN cd public/dashboard-app && npm run build

# Ensure data/log directories exist
RUN mkdir -p data logs && chmod -R 755 data logs

# Expose API port
EXPOSE 4500

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=20s \
  CMD node -e "require('http').get('http://localhost:4500/api/v1/', (r) => { if (r.statusCode !== 200) throw new Error(r.statusCode) })" || exit 1

# Start application in production mode
CMD ["node", "index.js"]
