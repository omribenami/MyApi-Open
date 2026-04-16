# CLAUDE.md

## Open Source Publication TODO

These tasks must be completed before this repo is ready for public release.
Work from /opt/MyApi-Open (this is the public repo — NOT the private source at /home/jarvis/.openclaw/workspace/projects/MyApi).

### Remaining Tasks

- [x] **LICENSE** — Added Commons Clause non-commercial addendum header before AGPL-3.0 body.
  Copyright: `Agentic Integrations LLC`. Personal use only, no monetization allowed.

- [x] **README.md** — Updated license section with clear commercial restrictions and non-commercial addendum notice.
  Self-hosting instructions already complete (Docker + manual setup in Quick Start).

- [x] **.gitignore** — Verified covers: `.env*` (except `*.example`), `*.db`, `*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`, `src/data/`, `data/`, `src/uploads/`.

- [x] **Commit & push** — Committed and pushed `feat: complete open source release — AGPL-3.0 + Commons Clause`

### Already Completed
- [x] Cloned omribenami/MyApi-Open to /opt/MyApi-Open
- [x] Rsynced current MyApi source (excluded .env files, .db files, node_modules, qa-tests/phase1-results.json)
- [x] Removed SQLite WAL/SHM leftover files from src/tests/ and src/
- [x] Replaced all `omribenami/MyApi` repo URLs → `omribenami/MyApi-Open`
- [x] Removed personal email/name references (benami, omri.ba@) from all source files
- [x] Updated docs/SKILL.md author → Agentic Integrations LLC
- [x] Updated tests/rbac.test.js.skip username → generic test user
- [x] Updated LICENSE copyright line → Agentic Integrations LLC
- [x] Added `"author": "Agentic Integrations LLC"` and `"license": "AGPL-3.0-only"` to package.json

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Backend** (run from repo root):
```bash
node src/index.js          # Start server (port 4500)
npm test                   # Full integration test suite
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report (50% threshold enforced)

# Run a single test file
npx jest src/tests/integration.test.js --detectOpenHandles

# Run a specific test by name
npx jest --testNamePattern="vault token" --detectOpenHandles
```

**Frontend** (run from `src/public/dashboard-app/`):
```bash
npm run dev      # Vite dev server on port 5173 (hot reload)
npm run build    # Build to ../dist/ (served by Express at /dashboard/)
npm run lint     # ESLint
```

**Database**:
```bash
node src/scripts/init-db.js   # Initialize or reset DB schema
```

## Architecture

Three-tier: React dashboard → Express API gateway → SQLite database

### Backend Entry Point: `src/index.js`

Monolithic server file (~2400 lines) that:
- Starts Express on port 4500 with Helmet, CORS, rate limiting
- Configures OAuth for 45+ services from `config/oauth.json` or env vars (pattern: `${VAR_NAME}` substitution, feature flags `ENABLE_OAUTH_{SERVICE}`)
- Initializes the DB and runs migrations on startup
- Mounts all routes from `src/routes/` under `/api/v1/`
- Serves the built React app from `src/public/dist/` at `/dashboard/`

### Request Flow

```
Request → auth middleware (src/middleware/auth.js)
        → scope-validator (src/middleware/scope-validator.js)
        → RBAC (src/middleware/rbac.js)
        → device approval gate (src/middleware/deviceApproval.js)
        → route handler (src/routes/*.js)
        → brain/vault for data (src/brain/brain.js, src/vault/vault.js)
        → database (src/config/database.js)
```

**Auth headers**: `Authorization: Bearer {token}` + `X-Workspace-ID: {id}` for multi-tenancy.

### Token Types

- **Personal tokens**: Full data access, generated on first run (printed to logs)
- **Guest/scoped tokens**: Read-only, filtered by scope hierarchy (`admin:*` > `services:*` > `services:{name}:read`)
- Vault tokens are bcrypt-hashed; OAuth tokens are AES-256-GCM encrypted before DB storage

### Key Source Files

| File | Purpose |
|------|---------|
| `src/config/database.js` | SQLite (better-sqlite3), WAL mode, 50+ tables, all CRUD operations and schema migrations |
| `src/routes/api.js` | Core identity/preference/connector endpoints; factory pattern: `createApiRoutes(brain, vault, tokenManager, auditLog)` |
| `src/routes/` | Additional routes: `admin`, `auth`, `services`, `skills`, `vault-instructions`, `workspaces`, `notifications`, `devices`, `email`, `invitations`, `import`, `export` |
| `src/brain/brain.js` | `PersonalBrain` class — enforces token scope and applies privacy filters on all data responses |
| `src/gateway/tokens.js` | `TokenManager` — creates, validates, revokes API tokens |
| `src/gateway/audit.js` | `AuditLog` — writes every API action with IP, scope, and metadata |
| `src/lib/encryption.js` | AES-256-GCM with PBKDF2 (600k iterations), authenticated encryption, key rotation |
| `src/lib/context-engine.js` | Context caching and retrieval for AI interactions |
| `src/lib/knowledge-base.js` | Knowledge base document operations |

### Database

SQLite at `src/data/myapi.db` (controlled by `DB_PATH` env var). Key table groups:
- **Auth**: `vault_tokens`, `access_tokens`, `oauth_tokens`, `oauth_state_tokens`
- **Users/Identity**: `users`, `personas`, `handshakes`
- **AI/Knowledge**: `kb_documents`, `persona_documents`, `conversations`, `messages`, `context_cache`
- **Skills/Marketplace**: `skills`, `skill_versions`, `marketplace_listings`, `marketplace_ratings`
- **Multi-tenancy**: `workspaces`, `workspace_members`, `roles`, `role_permissions`
- **Billing/Compliance**: `billing_customers`, `billing_subscriptions`, `usage_daily`, `compliance_audit_log`
- **Audit**: `audit_log` (written for every API request)

### Frontend Structure

Base path `/dashboard/` (configured in `vite.config.js`). Key directories:
- `src/pages/` — 27 pages (Settings.jsx is ~79KB, AccessTokens.jsx ~35KB, Marketplace.jsx ~44KB)
- `src/components/` — 36 components; Layout.jsx is the nav/sidebar shell
- `src/stores/` — Zustand stores (authStore is central: user, tokens, workspaces, session)
- `src/utils/apiClient.js` — Axios instance with auth interceptors, workspace header injection, rate-limit backoff, and auto-redirect on 401

**Tailwind**: v3 (NOT v4). `postcss.config.js` uses `tailwindcss: {}` + `autoprefixer: {}`. `index.css` uses `@tailwind base/components/utilities` directives. v4 was intentionally reverted for old Android Chrome compatibility.

### Tests

Tests live in `src/tests/`. Jest is configured via `jest.config.js` with:
- `setupFiles`: `src/tests/setup-env.js` (env var setup)
- `setupFilesAfterEnv`: `src/tests/setup.js` (test lifecycle hooks)
- 10s timeout per test
- supertest for HTTP-level integration testing against a real in-memory DB

Test files follow phase-based naming: `integration.test.js`, `phase1-workspaces.test.js`, `phase2-billing.test.js`, `phase3.audit-security.test.js`, `phase5-retention.test.js`, etc.

### Environment

Copy `src/.env.example` to `src/.env`. Critical variables:
```
PORT=4500
ENCRYPTION_KEY=<32-char>     # AES-256 OAuth token encryption
VAULT_KEY=<32-char>          # Vault token encryption
JWT_SECRET=<secret>
DB_PATH=./data/myapi.db
```
