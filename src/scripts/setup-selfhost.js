#!/usr/bin/env node
/**
 * Self-host bootstrap: generates a production .env with strong keys.
 *
 *   node src/scripts/setup-selfhost.js [--out src/.env]
 *
 * Idempotent: refuses to overwrite an existing .env (pass --force to replace).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outArg = process.argv.indexOf('--out');
const outPath = outArg > -1 ? process.argv[outArg + 1] : path.join(__dirname, '..', '.env');
const force = process.argv.includes('--force');

if (fs.existsSync(outPath) && !force) {
  console.error(`${outPath} already exists — refusing to overwrite (use --force to replace).`);
  process.exit(1);
}

const key = () => crypto.randomBytes(32).toString('hex');

const env = `# MyApi self-hosted configuration — generated ${new Date().toISOString()}
PORT=4500
NODE_ENV=production
MYAPI_SELF_HOSTED=true

# Encryption keys (KEEP THESE SAFE — losing them means losing encrypted data)
ENCRYPTION_KEY=${key()}
VAULT_KEY=${key()}
JWT_SECRET=${key()}
SESSION_SECRET=${key()}

# Database (inside the container this path is volume-mounted)
DB_PATH=./data/myapi.db

# Public base URL of this instance (update to your domain)
APP_BASE_URL=http://localhost:4500

# License key from your MyApi contract (or set MYAPI_LICENSE_FILE)
# MYAPI_LICENSE=

# BYO OAuth apps: register your own apps per service and set the env vars
# referenced in config/oauth.json (e.g. GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET).
# See docs/SELF_HOSTING.md for per-service guides.

# Optional: Composio (BYO key), Anthropic for AI automations
# COMPOSIO_API_KEY=
# ANTHROPIC_API_KEY=
`;

fs.writeFileSync(outPath, env, { mode: 0o600 });
console.log(`Wrote ${outPath}`);
console.log('\nNext steps:');
console.log('  1. Edit APP_BASE_URL to your public domain');
console.log('  2. Add your license key (MYAPI_LICENSE=...)');
console.log('  3. Register OAuth apps for the services you need (docs/SELF_HOSTING.md)');
console.log('  4. docker compose -f deploy/docker-compose.selfhost.yml up -d');
console.log('  5. Open /dashboard/ — the first-run master token is printed to the logs');
