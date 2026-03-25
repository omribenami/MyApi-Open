# MyApi

MyApi is a robust, privacy-first personal API platform and dashboard designed to consolidate your digital identity, service integrations, and autonomous agent capabilities. It serves as the bridge between your personal data, external APIs, and AI agents.

## Core Features

- **Services & Connectors**: Seamlessly connect and manage OAuth integrations and API keys for over 35+ services including Google, GitHub, Slack, Discord, Twitter, and more.
- **Tokens Vault**: Manage master tokens and generate fine-grained, scoped guest tokens to securely share access with external agents or third-party applications.
- **Persona Management**: Create, edit, and activate dynamic AI personas (with tailored `SOUL.md` variants) for specialized agent interactions.
- **Identity Docs**: A central hub to define and manage user profiles and identity metadata (`USER.md`).
- **Knowledge Base**: An integrated Markdown-supported knowledge base for attaching specific documents and long-term memory (`MEMORY.md`) to distinct personas.
- **Skills Marketplace**: Discover, install, and publish custom skills and capabilities that expand the functional toolset of your local agents.

## Architecture

The project follows a decoupled architecture emphasizing security and extensibility:

- **Backend** (`/src/`): A lightweight, fast Node.js/Express server that acts as the Gateway Context Assembler and OAuth proxy. It handles routing, authentication, and secure database interactions (SQLite).
- **Frontend Dashboard** (`/src/public/dashboard-app/`): A responsive, modern React + Vite single-page application styled with Tailwind CSS and utilizing Zustand for state management.
- **Design System** (`/docs/`): Comprehensive documentation covering UI architecture, color palettes, typography, and over 35 detailed component specifications.

## Deployment Guide

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Cloudflare Tunnel (for production tunneling) or similar reverse proxy

### Environment Setup

Create a `.env` file in `/src` with the following variables:

```bash
# Core
PORT=4500
NODE_ENV=production  # or 'development' for local

# Session & Security
SESSION_SECRET=<generate-random-string-here>
SESSION_COOKIE_SECURE=true  # Set to false for local dev

# OAuth Configuration (create apps at each provider's developer portal)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
# ... (other OAuth providers as needed)

# Database
DB_PATH=./src/db.sqlite  # SQLite database location

# Token Encryption
TOKEN_ENCRYPTION_KEY=<generate-random-32-byte-hex-string>

# Optional: Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=120

# Outbound Email (SMTP or SendGrid)
EMAIL_PROVIDER=smtp            # smtp | sendgrid
EMAIL_FROM=noreply@myapiai.com   # required deployment sender (configurable per env)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false              # true for 465
SMTP_USER=<optional-username>
SMTP_PASSWORD=<optional-password>
# SendGrid (if EMAIL_PROVIDER=sendgrid)
SENDGRID_API_KEY=<your-sendgrid-api-key>
```

### Outbound Email API (No Inbox Access)

MyApi supports **outbound-only** email operations. Inbox read/search is intentionally not implemented.

- `GET /api/v1/email/test` — verify provider connection/config
- `GET /api/v1/email/status` — config readiness + queue counters + last failure
- `POST /api/v1/email/send-test` — send test email (`{ "to": "user@example.com" }`)
- `POST /api/v1/email/process` — process queued outbound emails
- `GET /api/v1/email/jobs` — recent queue jobs/failures for dashboard observability

### Data Export API (v2 JSON + v3 ZIP)

- `GET /api/v1/export` (authenticated)
- Query params:
  - `mode=portable|forensic` (default: `portable`)
  - `format=json|zip` (default: `json`)
  - `includeFiles=true|false` (ZIP only, default: `false`)
  - section toggles (JSON mode): `profile`, `tokens`, `personas`, `knowledge`, `settings` (`true` by default)

**JSON mode (v2, backward compatible):**
- Same behavior as existing export endpoint
- Portable mode excludes session-like token labels and masks token IDs
- Forensic mode includes full token IDs/internal refs
- Token secrets are never exported

**ZIP mode (v3 portable package):**
- Returns `application/zip` with structure:
  - `manifest.json`
  - `profile/identity.json`, `profile/user.md`, `profile/soul.md`
  - `personas/personas.json` (+ `personas/configs/*.json` when available)
  - `connectors/services.json`, `connectors/oauth-metadata.json` (metadata only)
  - `knowledge/index.json`, `knowledge/docs/*.md`
  - `knowledge/files/*` only when `includeFiles=true`
  - `settings/settings.json`
  - `audit/summary.json`
  - `checksums.sha256`

Example (JSON):
```bash
curl -H "Authorization: Bearer <token>" \
  "https://www.myapiai.com/api/v1/export?mode=portable&tokens=true"
```

Example (ZIP):
```bash
curl -L -H "Authorization: Bearer <token>" \
  "https://www.myapiai.com/api/v1/export?format=zip&mode=portable&includeFiles=false" \
  -o myapi-export.zip
```

### Local Development (Docker)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/omribenami/MyApi.git
   cd MyApi
   ```

2. **Setup Environment Variables:**
   ```bash
   cp .env.dev.example .env
   # Edit .env with your local credentials if needed
   ```

3. **Start the Stack:**
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```
   - API available at `http://localhost:4500`
   - Dashboard available at `http://localhost:5173` (with hot-reloading)

### Production Deployment (Docker)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/omribenami/MyApi.git
   cd MyApi
   ```

2. **Setup Environment Variables:**
   ```bash
   cp .env.prod.example .env.local
   # MUST Edit .env.local with secure production secrets
   ```

3. **Start the Production Stack:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

4. **Configure SSL / HTTPS:**
   ```bash
   ./scripts/setup-ssl.sh yourdomain.com
   ```
   The backend serves the React dashboard and handles API endpoints natively behind Nginx with Let's Encrypt certificates.

#### Manual Production Deployment (Without Docker)

If you prefer to run bare-metal without Docker:

1. **Build the Frontend:**
   ```bash
   cd src/public/dashboard-app
   npm run build
   ```

2. **Start the Backend Service:**
   ```bash
   cd src
   NODE_ENV=production npm start
   ```

The backend will:
- Serve the React dashboard from `/src/public/dist`
- Expose API endpoints at `/api/v1/*`
- Handle OAuth callbacks and token management
- Run device approval flows and rate limiting

#### 3. Configure Reverse Proxy (Cloudflare/nginx)

**Cloudflare Tunnel Example:**
```bash
cloudflare-tunnel run --url http://localhost:4500
```

**Nginx Reverse Proxy:**
```nginx
upstream myapi {
  server localhost:4500;
}

server {
  listen 80;
  server_name www.myapiai.com;

  location / {
    proxy_pass http://myapi;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

#### 4. Enable HTTPS & Secure Cookies

Ensure `SESSION_COOKIE_SECURE=true` in production. Cookies will only be sent over HTTPS.

---

## Architecture & Key Components

### Backend (`/src`)

- **Express Server** (port 4500)
- **SQLite Database** for OAuth tokens, users, devices, and audit logs
- **OAuth Adapters** for 10+ services (Google, GitHub, Slack, Discord, etc.)
- **Device Approval Middleware** for multi-device security
- **Rate Limiting** (exempt bootstrap paths: `/api/v1/auth/me`, `/api/v1/dashboard/metrics`, etc.)
- **Audit Logging** for compliance and debugging

### Frontend (`/src/public/dashboard-app`)

- **React 18** with Vite bundler
- **Zustand** for state management (auth store, service store, etc.)
- **Tailwind CSS** for styling
- **Circuit Breaker Pattern** for auth recovery (prevents endless login retry loops)
- **Error Suppression** for graceful handling of storage corruption artifacts

### Database Schema

**Key Tables:**
- `users` — User profiles and OAuth data
- `access_tokens` — API tokens with scopes and encryption
- `oauth_tokens` — OAuth service tokens (Google, GitHub, etc.)
- `approved_devices` — Device fingerprints and approval status
- `device_approvals_pending` — Pending approval requests
- `audit_logs` — Compliance & security event log
- `personas` — AI persona configurations
- `kb_documents` — Knowledge base documents

---

## Critical Fixes & Recovery (Mar 18, 2026)

### Issue: Endless Auth Retry Loop + 401/403 Errors

**Root Causes:**
1. Stale OAuth session tokens not being validated before use
2. Device approval middleware blocking bootstrap endpoints
3. Global rate limiter hitting auth paths (429 Too Many Requests)
4. Missing circuit breaker to stop failed auth attempts

**Solutions Deployed:**

1. **Rate Limiter Exemption** (commit b819f4d)
   - Exempt bootstrap paths from global rate limiting
   - Paths: `/api/v1/auth/me`, `/api/v1/dashboard/metrics`, `/api/v1/privacy/cookies`, etc.
   ```javascript
   const isExempt = req.path === '/api/v1/auth/me' ||
                    req.path === '/api/v1/dashboard/metrics' ||
                    req.path.startsWith('/api/v1/ws');
   ```

2. **Device Approval Bypass** (commit 346d9a4)
   - Skip device-approval checks for auth/device routes
   - Allow unauthenticated users to attempt login first

3. **OAuth Session Recovery** (commit 515c99f)
   - Set two cookies on OAuth callback: `myapi_master_token` + `myapi_user`
   - Frontend reads `myapi_user` cookie as fallback if localStorage fails

4. **Circuit Breaker** (commit 0b608fc)
   - Track failed `/auth/me` attempts
   - Stop retrying after 2 failures
   - Initialize unauthenticated (show login page)

5. **Error Suppression** (commit 8ed05ff)
   - Suppress "Corruption: block checksum mismatch" errors (storage artifacts, not real failures)
   - Global error handler prevents reload loops

### Testing Recovery

```bash
# Clear local auth state
localStorage.removeItem('masterToken')
sessionStorage.clear()

# Hard refresh dashboard
# Should show login page (not endless errors)
```

## Documentation

Extensive design and technical documentation can be found in the `/docs` directory:
- [Design Summary](docs/DESIGN_SUMMARY.md)
- [UI Architecture](docs/UI_ARCHITECTURE.md)
- [Developer Quick Start](docs/DEVELOPER_QUICK_START.md)
- [Outbound Email Operations](docs/EMAIL_OUTBOUND.md)

## Repository Policy

**Strict Isolation:** This repository is dedicated exclusively to the MyApi platform codebase. External workspace environments, agent runtime logs, python environments, and system-level caches (e.g., `.venv`, `__pycache__`, `*.sqlite-shm`) are strictly ignored via `.gitignore` and must never be committed.

## Environment-Specific Configuration

### Development Environment

**Characteristics:**
- `NODE_ENV=development`
- HTTP (not HTTPS)
- `SESSION_COOKIE_SECURE=false`
- Rate limits disabled for testing (test mode allows 1000 req/min)
- Hot-reload enabled for both backend and frontend
- CORS allows any origin

**Configuration:**
```bash
# .env
NODE_ENV=development
SESSION_COOKIE_SECURE=false
RATE_LIMIT_MAX_REQUESTS=1000
```

**Run:**
```bash
cd src && npm run dev
cd src/public/dashboard-app && npm run dev
```

### Production Environment

**Characteristics:**
- `NODE_ENV=production`
- HTTPS only (Cloudflare tunnel or nginx reverse proxy)
- `SESSION_COOKIE_SECURE=true`
- Rate limits enforced (120 req/min per IP)
- Asset caching enabled
- Error handling suppresses sensitive details

**Configuration:**
```bash
# .env
NODE_ENV=production
SESSION_COOKIE_SECURE=true
SESSION_SECRET=<strong-random-secret>
TOKEN_ENCRYPTION_KEY=<random-32-byte-hex>
RATE_LIMIT_MAX_REQUESTS=120
```

**Build & Deploy:**
```bash
# Build frontend
cd src/public/dashboard-app && npm run build

# Start backend (will serve dist/ folder)
cd src && NODE_ENV=production npm start

# Forward through Cloudflare tunnel or reverse proxy
```

---

## Troubleshooting

### Dashboard Shows Blank Page or Endless Spinner

**Cause:** Auth initialization failed, circuit breaker didn't activate

**Fix:**
```bash
# In browser console
localStorage.removeItem('masterToken')
sessionStorage.clear()
location.reload()
```

### 401 Unauthorized on All API Calls

**Cause:** Stale OAuth session or missing token

**Fix:**
1. Logout and login again
2. Check browser cookies: `myapi_master_token` and `myapi_user` should exist
3. If missing, OAuth callback may have failed

### 429 Too Many Requests

**Cause:** Rate limiter blocking requests

**Check:** Auth paths (`/api/v1/auth/me`, `/api/v1/dashboard/metrics`) are exempt. If you're hitting limits on other endpoints, reduce request frequency or increase `RATE_LIMIT_MAX_REQUESTS`.

### Database Locked Errors

**Cause:** SQLite WAL (write-ahead logging) file conflicts

**Fix:**
```bash
# In /src directory
rm -f db.sqlite-shm db.sqlite-wal
# Restart backend
```

---

## Changelog

### 2026-03-18 (Emergency Fixes)

- **Fixed auth retry loop** with circuit breaker pattern
- **Exempted bootstrap endpoints** from global rate limiting
- **Added OAuth session recovery** via dual-cookie fallback
- **Implemented error suppression** for graceful storage corruption handling
- **Updated device approval middleware** to allow login before device verification

### 2026-03-03

- Stabilized dashboard build/deploy flow and fixed dist asset hash mismatches that caused blank page loads.
- Added Knowledge Base multipart file upload support (txt/md/pdf), improved upload validation, and clearer error handling.
- Enabled persona-scoped KB context availability and improved persona-document attachment validation.
- Added AI self-discovery surfaces:
  - `GET /api/v1/capabilities`
  - `GET /api/v1/tokens/me/capabilities`
  - `GET /openapi.json`
  - `GET /.well-known/ai-plugin.json`
- Enhanced Vault API intake/discovery flow with website URL metadata and safer discovery error handling.
- Expanded automated validation with Phase 12A integration checks (discovery + KB upload + persona scope).
- Applied a professional minimal UI polish (less colorful, reduced emoji-heavy UI, cleaner GitHub-like visual style).

## License

All rights reserved.
