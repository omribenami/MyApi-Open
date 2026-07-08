# MyApi Open

**Community edition of the MyApi agent gateway.**

[![CI](https://github.com/omribenami/MyApi-Open/actions/workflows/ci.yml/badge.svg)](https://github.com/omribenami/MyApi-Open/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-supported-2496ed)](https://docs.docker.com)
[![Discord](https://img.shields.io/badge/discord-join-5865f2)](https://discord.gg/WPp4sCN4xB)

Connect your services once. Issue scoped access to AI agents. Keep auditability and revocation in one place.

> Prefer zero-ops? The official managed service lives at **[myapiai.com](https://www.myapiai.com)**.
> This repository is the **AGPL community edition**. The managed cloud offering includes additional hosted-only modules, operations, and commercial terms that are **not** all part of this repository.

---

## Edition model

MyApi is intentionally run as an **open-core** product.

| Area | MyApi Open (this repo) | MyApi Cloud / Commercial |
|---|---|---|
| Core API gateway | Yes | Yes |
| OAuth and scoped agent access patterns | Yes | Yes |
| ASC / AFP / self-hosting primitives | Yes | Yes |
| Generic connector and toolkit framework | Yes | Yes |
| Managed hosting, upgrades, backups, abuse handling | No | Yes |
| Billing, subscriptions, and cloud account operations | No | Yes |
| Hosted-only enterprise controls and managed ops | No | Yes |
| Official cloud legal terms and privacy operations | Reference only | Yes |

A fuller boundary document lives in [`docs/OPEN_CORE_BOUNDARY.md`](docs/OPEN_CORE_BOUNDARY.md).

---

## What stays open

MyApi Open is the place for:

- the agent gateway itself
- scoped auth and approval flows
- self-hosting and local deployment
- generic service / connector plumbing
- personas, knowledge, skills, and token-scoped automation primitives
- community contributions and extension points

## What stays closed

The managed MyApi Cloud offering may include:

- hosted billing and subscription operations
- commercial cloud-only admin and enterprise controls
- managed abuse / fraud / trust & safety operations
- proprietary operational tooling and deployment glue
- hosted tenant provisioning and other internal service orchestration

This separation is deliberate. The goal is to keep the platform credible and hackable for developers while preserving a real commercial product.

---

## Composio policy

Our position on Composio is:

- **Open:** generic Composio adapter code, toolkit discovery patterns, schema mapping, and self-hosting instructions
- **Closed / hosted-only:** MyApi's managed Composio tenant operations, paid auth-config provisioning, hosted defaults, commercial support flows, and internal abuse/risk controls

In plain English: we are comfortable exposing the **integration surface**, but not every piece of the **hosted business and operations layer** around it.

---

## Quick start

### Docker (recommended)

```bash
git clone https://github.com/omribenami/MyApi-Open.git
cd MyApi-Open
cp src/.env.example src/.env
# edit src/.env

docker-compose -f docker-compose.dev.yml up --build
# Dashboard  -> http://localhost:5173
# API        -> http://localhost:4500
```

### Production

```bash
docker-compose -f docker-compose.prod.yml up -d --build
# Dashboard + API -> http://localhost:4500/dashboard/
```

### Bare metal

```bash
cd src
npm install
node scripts/init-db.js
node index.js
```

---

## Legal scope of this repository

- Code in this repository is licensed under **AGPL-3.0**.
- The legal documents in this repository that mention the hosted service are provided so self-hosters can understand the hosted product boundary.
- If you deploy your own instance, **you** are responsible for your own terms, privacy, data processing disclosures, and compliance posture.
- If you use **myapiai.com**, the hosted-service legal terms published by Agentic Integration LLC apply.

---

## Documentation

- [`docs/OPEN_CORE_BOUNDARY.md`](docs/OPEN_CORE_BOUNDARY.md) — explicit Open / Closed / Maybe boundary
- [`docs/legal/TERMS_OF_USE.md`](docs/legal/TERMS_OF_USE.md) — hosted-service terms scope note
- [`docs/legal/PRIVACY_POLICY.md`](docs/legal/PRIVACY_POLICY.md) — hosted-service privacy scope note
- [`docs/SERVICES_MANUAL.md`](docs/SERVICES_MANUAL.md) — service configuration reference
- [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) — deployment guide

---

## Contributing

Contributions are welcome for the community edition.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Run the relevant tests
4. Open a pull request against `main`

For security issues, use [`SECURITY.md`](SECURITY.md).

---

## Community & support

- Discord: https://discord.gg/WPp4sCN4xB
- Issues: https://github.com/omribenami/MyApi-Open/issues
- Managed service: https://www.myapiai.com

---

## License

Copyright © 2026 MyApi.
Licensed under the [GNU Affero General Public License v3.0](LICENSE).

If you run a modified network service based on this repository, AGPL obligations apply to that modified version.
