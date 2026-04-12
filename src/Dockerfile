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
# Copy manifests BEFORE the full source so npm install is cached on code-only changes.

COPY src/package*.json ./
COPY src/public/dashboard-app/package*.json public/dashboard-app/

# Backend + frontend npm install (cached until package.json changes)
RUN npm install --no-audit
RUN cd public/dashboard-app && npm install --no-audit

# ── Source copy ────────────────────────────────────────────────────────────────
# NOTE: local src/node_modules/ (if present) overwrites the container's node_modules
# so better-sqlite3 MUST be rebuilt AFTER this step to ensure it targets the
# container's GLIBC version, not the host's.

COPY src/ .

# Force-rebuild better-sqlite3 from source AFTER source copy so the binary always
# targets this container's GLIBC (prebuilt binary requires GLIBC 2.38, Bookworm has 2.36).
RUN npm rebuild better-sqlite3 --build-from-source

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
