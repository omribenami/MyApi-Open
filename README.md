# MyApi

**The privacy-first personal API platform and AI agent gateway.**

[![CI](https://github.com/omribenami/MyApi/actions/workflows/ci.yml/badge.svg)](https://github.com/omribenami/MyApi/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-supported-2496ed)](https://docs.docker.com)
[![Discord](https://img.shields.io/badge/discord-join-5865f2)](https://discord.gg/WPp4sCN4xB)

Connect your services once. Issue scoped tokens to AI agents. Keep full control over who accesses what — with a full audit trail of every action.

> **Prefer zero-ops?** A fully managed, always-updated instance is available at **[myapiai.com](https://www.myapiai.com)** — sign up for free and skip the server setup entirely.

---

## What is MyApi?

Most AI agent setups share the same problems: raw credentials scattered across tools, no way to revoke a single agent without rotating everything, no audit trail, and a setup that lives entirely in your head with no backup. MyApi fixes all of this by acting as a **privacy-first gateway** between your data and the agents that use it.

<img width="1268" height="1080" alt="image" align="center" src="https://github.com/user-attachments/assets/62ebccc0-2b70-4097-b9db-59672f5b19ab" />


You connect your services (Google, GitHub, Slack, and 30+ more) through MyApi once. Agents get a scoped token — or better yet, authenticate via **cryptographic keypair signing (ASC)** so no raw secret ever crosses the wire. Your credentials are never exposed, every action is logged, and a one-click ZIP export means your entire agent setup is always backed up and portable.

---

## Features

| Feature | Description |
|---|---|
| **OAuth Aggregation** | Connect 30+ (and counting) services (Google, GitHub, Slack, Notion, Salesforce, Jira...) in one place. Tokens auto-refresh. Agents proxy through MyApi — never touch credentials. |
| **AI Agent Gateway** | Issue scoped Bearer tokens to any AI agent. First access requires your approval. Every request is logged. |
| **Persona System** | Multiple AI identities, each with its own soul content (SOUL.md), attached knowledge docs, and skills. Active persona shapes every API response. |
| **Knowledge Base** | Upload or write Markdown/PDF documents. Attach them to specific personas for grounded, contextual responses. |
| **Skills & Marketplace** | Build reusable capability modules. Install community skills from the marketplace. Publish your own. |
| **Token Vault** | AES-256-GCM encrypted storage for third-party API keys (OpenAI, Stripe, AWS, etc.). Rotate once, updated everywhere. |
| **AFP Connector** | API File Protocol — desktop daemon (Windows/macOS/Linux) for persistent local agent connections with scoped filesystem and shell access. |
| **ASC — Secure Agent Auth** | Agentic Secure Connection — agents authenticate via Ed25519 keypair signing instead of raw tokens. Signatures are timestamp-bound; replayed requests are rejected within 60 seconds. |
| **Backup & Import** | One-click ZIP export of your full agent ecosystem (personas, knowledge, skills, memory). Import back on any instance in seconds. Checksums included. |
| **Team Workspaces** | Multi-tenancy with Owner/Admin/Member/Viewer roles. Fully isolated contexts per workspace. |
| **Device Management** | Every new device (browser, CLI, AFP daemon, ASC agent) requires approval before access. Revoke instantly. |
| **Immutable Audit Log** | Append-only log of every API action — what, when, by which token, with what result. |
| **2FA & Scoped Tokens** | TOTP-based two-factor auth, session management, and fine-grained token scopes (`basic`, `knowledge`, `services:write`, etc.). |

---

## Architecture

<img src="https://github.com/user-attachments/assets/5bf8bf21-dfca-4afe-b724-9cee6eab8470" align="center" width="512" alt="MyApi Stack">

**Request flow:**
```
Request → auth middleware → scope validator → RBAC → device approval gate
        → route handler → brain/vault → database → response
```

---

## Quick Start

### Docker (recommended)

```bash
# 1. Clone
git clone https://github.com/omribenami/MyApi.git
cd MyApi

# 2. Configure
cp src/.env.example src/.env
# Edit src/.env — set ENCRYPTION_KEY, VAULT_KEY, JWT_SECRET, SESSION_SECRET

# 3. Start (development — hot reload on both frontend and backend)
docker-compose -f docker-compose.dev.yml up --build
# Dashboard  →  http://localhost:5173
# API        →  http://localhost:4500

# 4. Start (production)
docker-compose -f docker-compose.prod.yml up -d --build
# Dashboard + API  →  http://localhost:4500/dashboard/
```

### Manual (bare metal)

```bash
# Backend
cd src
npm install
node scripts/init-db.js       # create database schema
node index.js                 # start server on port 4500

# Frontend (development)
cd src/public/dashboard-app
npm install
npm run dev                   # Vite dev server on port 5173

# Frontend (production build — served by Express at /dashboard/)
npm run build                 # output → src/public/dist/
```

> The master token is printed to the server logs on first startup. Copy it to log in.

---

## Configuration

Copy `src/.env.example` to `src/.env` and fill in your values.

### Required

| Variable | Description |
|---|---|
| `PORT` | Server port (default: `4500`) |
| `NODE_ENV` | `development` or `production` |
| `ENCRYPTION_KEY` | 32-character key — AES-256 encryption for OAuth tokens |
| `VAULT_KEY` | 32-character key — Token Vault encryption |
| `JWT_SECRET` | JWT signing secret |
| `SESSION_SECRET` | Express session secret |

### Optional

| Variable | Description |
|---|---|
| `DB_PATH` | SQLite database path (default: `./data/myapi.db`) |
| `SESSION_COOKIE_SECURE` | `true` in production (HTTPS), `false` for local dev |
| `RATE_LIMIT_MAX_REQUESTS` | Requests per window per IP (default: `100`) |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms (default: `900000` / 15 min) |
| `EMAIL_PROVIDER` | `smtp` or `sendgrid` for outbound email notifications |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `POWER_USER_EMAIL` | Email address granted User Management access in the dashboard |

### OAuth service credentials

OAuth providers follow the pattern `{SERVICE}_CLIENT_ID` / `{SERVICE}_CLIENT_SECRET` with a corresponding `ENABLE_OAUTH_{SERVICE}=true` feature flag. See [`docs/SERVICES_MANUAL.md`](docs/SERVICES_MANUAL.md) for the full configuration reference covering all 45+ supported services.

---

## Self-Hosting

MyApi is fully self-hostable. For a production deployment you'll need:

- A server with Docker + Docker Compose (or Node.js 18+)
- A domain with HTTPS — e.g. `https://your.domain.com` (nginx + Let's Encrypt, or Cloudflare Tunnel)
- The environment variables above filled in for your domain

See the full deployment guide: [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md)

```bash
# Example: nginx reverse proxy to port 4500
# See docs/SERVICES_MANUAL.md for the full nginx + SSL config block
```

---

## Hosted Service

**Don't want to manage your own server?**

[**myapiai.com**](https://www.myapiai.com) is the official managed version of this project — always running the latest release, with automatic backups, SSL, and email included out of the box.

- Free tier available
- Same open-source codebase, zero infrastructure work
- Pro and Enterprise tiers for teams

## Roadmap

- Expanded agent capabilities (streaming responses, webhook triggers)
- Additional OAuth providers (target 60+, including more enterprise services)
- Additional enterprise features on [myapiai.com](https://www.myapiai.com)

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Run the tests: `npm test` (from `src/`)
4. Make sure `cd src/public/dashboard-app && npm run lint` passes
5. Open a pull request against `main`

For security issues, see [`SECURITY.md`](SECURITY.md) for the responsible disclosure process.

---

## Community & Support

- **Discord**: [discord.gg/WPp4sCN4xB](https://discord.gg/WPp4sCN4xB)
- **Issues**: [GitHub Issues](https://github.com/omribenami/MyApi/issues)
- **Documentation**: [`docs/`](docs/) — architecture, API reference, services guide, compliance

---

## License

Copyright © 2026 MyApi. Licensed under the [GNU Affero General Public License v3.0](LICENSE).

This means you can self-host, modify, and distribute MyApi freely — but any modified version you run as a network service must also be made available under AGPL-3.0. See the [LICENSE](LICENSE) file for the full terms.
