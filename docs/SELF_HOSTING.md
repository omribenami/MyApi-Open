# Self-Hosting MyApi (B2B)

Run the entire MyApi agent gateway inside your own infrastructure. Your OAuth
tokens, knowledge base, audit trail, and agent traffic never touch our cloud.

## Requirements

- Linux host (Ubuntu 22.04+ tested), Docker + Docker Compose v2
- 2 GB RAM minimum; SQLite storage on local disk (a few hundred users is fine)
- A domain + TLS terminator (Caddy, nginx, or Cloudflare Tunnel) in front

## Install (≈15 minutes)

```bash
git clone <your-distribution-repo> myapi && cd myapi

# 1. Generate secrets + .env
node src/scripts/setup-selfhost.js

# 2. Edit src/.env
#    - APP_BASE_URL=https://agents.yourcompany.com
#    - MYAPI_LICENSE=<license key from your contract>
#    - OAuth app credentials for the services you use (below)

# 3. Launch
docker compose -f docker-compose.selfhost.yml up -d --build

# 4. Grab the first-run master token from the logs
docker logs myapi-selfhost 2>&1 | grep -i "master token"
```

Open `https://agents.yourcompany.com/dashboard/`, sign in, and create your
organization (Organization → Create). Then configure SSO, SCIM, and policies
from the Organization console.

## License

Self-hosted instances read the license from `MYAPI_LICENSE` (or
`MYAPI_LICENSE_FILE`). Check status at `GET /api/v1/license` or in the
dashboard. Policy is **soft enforcement**: an expired license gets a 14-day
grace period with warnings; we never hard-stop your instance. Seat counts
above your license produce warnings, not lockouts.

No license? The instance runs in evaluation mode with warnings.

## BYO OAuth applications

On self-host you register your **own** OAuth apps so consent screens show your
company and tokens are issued to you:

| Service | Console | Redirect URI |
|---|---|---|
| Google | console.cloud.google.com → Credentials | `{APP_BASE_URL}/api/v1/oauth/callback` |
| GitHub | github.com/settings/developers | `{APP_BASE_URL}/api/v1/oauth/callback` |
| Slack | api.slack.com/apps | `{APP_BASE_URL}/api/v1/oauth/callback` |
| Microsoft | portal.azure.com → App registrations | `{APP_BASE_URL}/api/v1/oauth/callback` |
| Others | see `config/oauth.json` for the env var names each service expects | same |

Set the client ID/secret env vars referenced in `config/oauth.json`
(e.g. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) in `src/.env`, plus
`ENABLE_OAUTH_{SERVICE}=true`.

Composio-powered services: set `COMPOSIO_API_KEY` (your own Composio account).
AI automations: set `ANTHROPIC_API_KEY` or let users bring their own keys.

## SSO / SCIM

- SP metadata for SAML: `{APP_BASE_URL}/api/v1/auth/sso/saml/metadata/{orgId}`
- OIDC redirect URI: `{APP_BASE_URL}/api/v1/auth/sso/oidc/callback`
- SCIM base URL: `{APP_BASE_URL}/scim/v2` (token from Organization → Security)

## Upgrades

```bash
git pull
docker compose -f docker-compose.selfhost.yml up -d --build
```

Database migrations run automatically on boot. Data persists in `./data` on
the host — back it up (the app also has a built-in encrypted backup manager).

## Telemetry

None. Self-hosted instances make no calls home. The only outbound traffic is
what your users' agents do (service APIs, your IdP, your SIEM sink).
