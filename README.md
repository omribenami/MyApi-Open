# MyApi — The Privacy-First Personal API Platform & AI Agent Gateway

[![CI](https://github.com/omribenami/MyApi-Open/actions/workflows/ci.yml/badge.svg)](https://github.com/omribenami/MyApi-Open/actions/workflows/ci.yml)
[![License: AGPL-3.0 + Commons Clause](https://img.shields.io/badge/license-AGPL--3.0%20%2B%20Commons%20Clause-orange.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-supported-2496ed)](https://docs.docker.com)
[![Discord](https://img.shields.io/badge/discord-join-5865f2)](https://discord.gg/WPp4sCN4xB)

Connect your services once. Issue scoped tokens to AI agents. Keep full control over who accesses what — with a full audit trail of every action.

> **Managed cloud version →** [**myapiai.com**](https://www.myapiai.com) — no server required. Sign up for free and skip the setup entirely.

---

## Why MyApi?

Most AI agent setups suffer from the same fundamental flaws: raw credentials scattered across local environments, zero audit trails, and the inability to revoke access without rotating every key you own. Whether you're using **OpenClaw**, **Hermes**, or **Claude Code**, your security is only as strong as your last `.env` file.

**MyApi flips the equation.** Instead of configuring every agent individually, MyApi acts as a privacy-first gateway and central hub between your sensitive data and the agents that use it. Connect your services once; authorize your agents forever.

### Core Advantages

* **Unified Connection:** Your agents across different platforms share the same data and services seamlessly.
* **Agent Management:** Centrally manage personas, specialized skills, and knowledge bases from a single dashboard.
* **Multiple Agents — One Brain:** Ensure all your agents have a consistent "memory" and context by connecting them to a single source of truth.
* **Shareable Scoped Tokens:** Grant an agent access to a **"Bundle"** (Persona + unique skills + unique knowledge base) rather than giving them raw, unfettered access to your entire infrastructure.
* **Secure Infrastructure:** Provide agents with a hardened connection to your services and workstations via one secure, audited API.
* **Instant Revocation:** End access for a single agent or tool instantly without touching your primary service credentials.

<p align="center">
<img width="1268" height="1080" alt="image" align="center" src="https://github.com/user-attachments/assets/62ebccc0-2b70-4097-b9db-59672f5b19ab" />
</p>

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

<p align="center">
  <img width="512" src="https://github.com/user-attachments/assets/5bf8bf21-dfca-4afe-b724-9cee6eab8470" alt="MyApi Stack">
</p>

**Request flow:**

```
Request → auth middleware → scope validator → RBAC → device approval gate
        → route handler → brain/vault → database → response
```

---

## Quick Start

### Option A: Docker (Recommended)

```bash
# 1. Clone
git clone https://github.com/omribenami/MyApi-Open.git
cd MyApi-Open

# 2. Configure
cp src/.env.example src/.env
# Edit src/.env — fill in your secrets (see Configuration below)
# Generate secure keys:
#   openssl rand -hex 32

# 3. Start (development — hot reload on both frontend and backend)
docker-compose -f docker-compose.dev.yml up --build
# Dashboard  →  http://localhost:5173
# API        →  http://localhost:4500

# 4. Start (production)
docker-compose -f docker-compose.prod.yml up -d --build
# Dashboard + API  →  http://localhost:4500/dashboard/
```

### Option B: Manual (Node.js 18+)

```bash
# 1. Clone
git clone https://github.com/omribenami/MyApi-Open.git
cd MyApi-Open

# 2. Install dependencies
npm install

# 3. Configure
cp src/.env.example src/.env
# Edit src/.env — fill in your secrets (see Configuration below)

# 4. Initialize the database
node src/scripts/init-db.js

# 5. Start the server
node src/index.js
# API  →  http://localhost:4500

# 6. Frontend (development)
cd src/public/dashboard-app
npm install
npm run dev
# Dashboard  →  http://localhost:5173

# 7. Frontend (production build — served by Express at /dashboard/)
npm run build    # output → src/public/dist/
```

---

## First Run

On first startup, the server generates a **master token** and prints it to the console logs:

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🔐 SAVE THIS TOKEN - IT WILL ONLY BE SHOWN ONCE!           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

Token: myapi_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

1. **Copy the token** — you need it to log in to the dashboard and make API calls.
2. **Open the dashboard** at `http://localhost:4500/dashboard/` (production) or `http://localhost:5173` (development).
3. **Paste the token** to authenticate.

> **Missed it?** If the token scrolled past in Docker logs, run:
> ```bash
> docker-compose logs myapi | grep "Token:"
> ```
> For manual installs, delete `src/data/myapi.db` and restart to regenerate.

---

## Configuration

Copy `src/.env.example` to `src/.env` and fill in your values.

### Generate Secure Keys

```bash
# Generate a 32-byte hex key (for ENCRYPTION_KEY, VAULT_KEY, JWT_SECRET, SESSION_SECRET)
openssl rand -hex 32
```

### Required

| Variable | Description |
|---|---|
| `PORT` | Server port (default: `4500`) |
| `NODE_ENV` | `development` or `production` |
| `ENCRYPTION_KEY` | 32-byte hex key — AES-256 encryption for OAuth tokens |
| `VAULT_KEY` | 32-byte hex key — Token Vault encryption |
| `JWT_SECRET` | JWT signing secret |
| `SESSION_SECRET` | Express session secret |

### Functionally Required

| Variable | Description |
|---|---|
| `BASE_URL` | Public URL of your instance (e.g. `https://your-domain.com`) — used for OAuth callbacks |
| `POWER_USER_EMAIL` | Email address granted User Management access in the dashboard |

### Optional

| Variable | Description |
|---|---|
| `DB_PATH` | SQLite database path (default: `./data/myapi.db`) |
| `SESSION_COOKIE_SECURE` | `true` in production (HTTPS), `false` for local dev |
| `SESSION_COOKIE_DOMAIN` | Your domain (e.g. `.your-domain.com`) — required for production |
| `RATE_LIMIT_MAX_REQUESTS` | Requests per window per IP (default: `100`) |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms (default: `900000` / 15 min) |
| `EMAIL_PROVIDER` | `smtp`, `sendgrid`, or `resend` for outbound email notifications |
| `CORS_ORIGIN` | Comma-separated allowed origins |

### OAuth Service Credentials

OAuth providers follow the pattern `{SERVICE}_CLIENT_ID` / `{SERVICE}_CLIENT_SECRET` with a corresponding `ENABLE_OAUTH_{SERVICE}=true` feature flag. See [`docs/SERVICES_MANUAL.md`](docs/SERVICES_MANUAL.md) for the full configuration reference covering all 45+ supported services.

---

## Production / Self-Hosting

MyApi is fully self-hostable. For a production deployment you'll need:

- A server with Docker + Docker Compose (or Node.js 18+)
- A domain with **HTTPS** — e.g. `https://your-domain.com` (nginx + Let's Encrypt, or Cloudflare Tunnel)
- The environment variables above configured for your domain

### Key Production Variables

| Variable | Example |
|---|---|
| `BASE_URL` | `https://your-domain.com` |
| `PUBLIC_URL` | `https://your-domain.com` |
| `SESSION_COOKIE_DOMAIN` | `.your-domain.com` |
| `SESSION_COOKIE_SECURE` | `true` |
| `CORS_ORIGIN` | `https://your-domain.com` |

### nginx Reverse Proxy

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:4500;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

See the full deployment guide: [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md)

---

## ☁️  Skip the Server — myapiai.com

**Don't want to manage your own server?**

[**myapiai.com**](https://www.myapiai.com) is the official managed version of this project — full-featured cloud hosting, always running the latest release, with automatic backups, SSL, and email built in.

- ✅ **Always up to date** — latest features and security patches
- ✅ **Free tier available** — get started immediately
- ✅ **Pro and Team plans** — for power users and organizations
- ✅ **Zero infrastructure** — same open-source codebase, no servers to manage

👉 **[Sign up at myapiai.com](https://www.myapiai.com)**

---

## Roadmap

- Expanded agent capabilities (streaming responses, webhook triggers)
- Additional OAuth providers (target 60+, including more enterprise services)
- Additional enterprise features on [myapiai.com](https://www.myapiai.com)

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Run the tests: `npm test` (from repo root)
4. Make sure `cd src/public/dashboard-app && npm run lint` passes
5. Open a pull request against `main`

For security issues, see [`SECURITY.md`](SECURITY.md) for the responsible disclosure process.

---

## Community & Support

- **Discord**: [discord.gg/WPp4sCN4xB](https://discord.gg/WPp4sCN4xB)
- **Issues**: [GitHub Issues](https://github.com/omribenami/MyApi-Open/issues)
- **Documentation**: [`docs/`](docs/) — architecture, API reference, services guide, compliance

---

## License

Copyright © 2026 Agentic Integrations LLC. Licensed under the [GNU Affero General Public License v3.0](LICENSE) with a **[Commons Clause](https://commonsclause.com/)** non-commercial restriction.

**Key terms:**
- ✅ Use, modify, and self-host freely for personal and non-commercial use
- ✅ Deploy on your own infrastructure, no restrictions
- ✅ Modify the source code for internal use
- ❌ Cannot commercialize or resell as a service (including SaaS, hosting, API aggregation, etc.)

Any modified version you run as a network service must also be made available under AGPL-3.0. For commercial licensing or exceptions, contact [Agentic Integrations LLC](https://www.myapiai.com).

See the [LICENSE](LICENSE) file for full terms.
