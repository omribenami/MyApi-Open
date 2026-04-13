# MyApi

MyApi is a privacy-first personal API platform and dashboard for consolidating identity, service integrations, memory, knowledge, and autonomous agent capabilities behind a single secure interface.

This repository is the sanitized open-source distribution of MyApi.

## Core Features

- **Services & Connectors**: Connect and manage OAuth integrations and API keys for 35+ services including Google, GitHub, Slack, Discord, and more.
- **Tokens Vault**: Manage master tokens and create fine-grained scoped guest tokens for agents and third-party applications.
- **Persona Management**: Create, edit, and activate AI personas with tailored system prompts and behaviour.
- **Identity Docs**: Manage `USER.md`-style profile and identity metadata.
- **Knowledge Base**: Store long-term memory and Markdown knowledge attached to specific personas.
- **Skills Marketplace**: Discover, install, and publish reusable skills that extend local agents.
- **Audit & Security Controls**: Token scoping, device approval flows, encryption, and audit logging.

## Architecture

The project follows a decoupled architecture focused on security and extensibility:

- **Backend** (`/src/`): Node.js/Express gateway, OAuth proxy, API server, and SQLite-backed application layer.
- **Frontend Dashboard** (`/src/public/dashboard-app/`): React + Vite single-page app styled with Tailwind CSS and powered by Zustand stores.
- **Documentation** (`/docs/`): Design, architecture, deployment, services, and operational references.

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Clone

```bash
git clone https://github.com/omribenami/MyApi-Open.git
cd MyApi-Open
```

### Install backend

```bash
cd src
npm install
```

### Install frontend

```bash
cd public/dashboard-app
npm install
```

### Run locally

Backend, from `src/`:

```bash
npm run dev
```

Frontend, from `src/public/dashboard-app/` in a second terminal:

```bash
npm run dev
```

Endpoints:

- API: `http://localhost:4500`
- Dashboard: `http://localhost:5173`

## Environment Setup

Create `src/.env` from the example:

```bash
cp src/.env.example src/.env
```

Important settings include:

```bash
PORT=4500
NODE_ENV=development
DB_PATH=./db.sqlite
SESSION_SECRET=<generate-a-secret>
ENCRYPTION_KEY=<generate-a-secret>
VAULT_KEY=<generate-a-secret>
JWT_SECRET=<generate-a-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
```

Note: This open repository does not ship live credentials. Configure provider secrets in your own environment before use.

## Docker

Development:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

Production:

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

## Key API Areas

- `GET /api/v1/capabilities`
- `GET /openapi.json`
- `GET /.well-known/ai-plugin.json`
- `GET /api/v1/email/status`
- `POST /api/v1/email/send-test`
- `GET /api/v1/export`
- `GET /api/v1/dashboard/stats`

## Data Export

MyApi supports JSON and ZIP export flows for portable user data packaging.

Example JSON export:

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4500/api/v1/export?mode=portable&tokens=true"
```

Example ZIP export:

```bash
curl -L -H "Authorization: Bearer <token>" \
  "http://localhost:4500/api/v1/export?format=zip&mode=portable&includeFiles=false" \
  -o myapi-export.zip
```

## Documentation

Useful starting points in `/docs`:

- [Design Summary](docs/DESIGN_SUMMARY.md)
- [UI Architecture](docs/UI_ARCHITECTURE.md)
- [Developer Quick Start](docs/DEVELOPER_QUICK_START.md)
- [Services Manual](docs/SERVICES_MANUAL.md)
- [Email Outbound](docs/EMAIL_OUTBOUND.md)
- [Export](docs/EXPORT.md)

## Repository Policy

This repository is intended to contain only the MyApi codebase and sanitized documentation.

Never commit:

- live `.env` files
- database files and WAL/SHM files
- uploaded user content
- export archives
- local agent/tooling state
- real API keys, OAuth secrets, tokens, or certificates

## License

Licensed under the GNU Affero General Public License v3.0.
See [LICENSE](LICENSE).
