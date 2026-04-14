#!/usr/bin/env node
/**
 * Emergency master token recovery script.
 * Run directly on the server when locked out of the API:
 *
 *   RECOVERY_SECRET=<secret> node src/scripts/recover-master-token.js --secret=<secret>
 *
 * Revokes all existing master tokens and creates a fresh one.
 * Prints the raw token to stdout — save it immediately.
 *
 * SECURITY: Requires RECOVERY_SECRET env var to be set and --secret=<value> CLI arg
 * matching it. Set RECOVERY_SECRET in your .env before you need it.
 * Rotate the secret after each use.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');

// Auth gate — must pass before opening DB
const expectedSecret = process.env.RECOVERY_SECRET;
if (!expectedSecret || expectedSecret.trim().length < 16) {
  console.error('ERROR: RECOVERY_SECRET env var not set or too short (min 16 chars).');
  console.error('Set RECOVERY_SECRET in your .env file before running this script.');
  process.exit(1);
}

const args = process.argv.slice(2);
const secretArg = args.find(a => a.startsWith('--secret='));
const providedSecret = secretArg ? secretArg.replace('--secret=', '') : null;
if (!providedSecret) {
  console.error('ERROR: --secret=<RECOVERY_SECRET> argument required.');
  console.error('Usage: RECOVERY_SECRET=<secret> node recover-master-token.js --secret=<secret>');
  process.exit(1);
}

// Timing-safe comparison to prevent brute-force timing attacks
const expectedBuf = Buffer.from(expectedSecret);
const providedBuf = Buffer.from(providedSecret);
if (
  expectedBuf.length !== providedBuf.length ||
  !crypto.timingSafeEqual(expectedBuf, providedBuf)
) {
  console.error('ERROR: Recovery secret mismatch. Access denied.');
  process.exit(1);
}

// Block accidental production use without explicit override
if (process.env.NODE_ENV === 'production' && process.env.RECOVERY_ALLOW_PRODUCTION !== '1') {
  console.error('ERROR: Refusing to run in production. Set RECOVERY_ALLOW_PRODUCTION=1 to override.');
  process.exit(1);
}

// Audit log recovery attempt to a file (DB may be unavailable)
const fs = require('fs');
const auditPath = require('path').join(__dirname, '../../recovery-audit.log');
const auditEntry = `${new Date().toISOString()} RECOVERY_ATTEMPT pid=${process.pid} node_env=${process.env.NODE_ENV || 'unknown'}\n`;
try { fs.appendFileSync(auditPath, auditEntry, { mode: 0o640 }); } catch (_) { /* best effort */ }

const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = process.env.DB_PATH
  ? path.resolve(__dirname, '..', process.env.DB_PATH)
  : path.join(__dirname, '../data/myapi.db');

console.log(`Opening database: ${dbPath}`);
const db = new Database(dbPath);

// Revoke all existing full-scope tokens
const now = new Date().toISOString();
const revoked = db.prepare(
  "UPDATE access_tokens SET revoked_at = ? WHERE scope = 'full' AND revoked_at IS NULL"
).run(now);
console.log(`Revoked ${revoked.changes} existing master token(s).`);

// Create new master token
const rawToken = 'myapi_' + crypto.randomBytes(32).toString('hex');
const hash = bcrypt.hashSync(rawToken, 10);
const id = 'tok_' + crypto.randomBytes(16).toString('hex');

db.prepare(
  "INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at) VALUES (?, ?, 'owner', 'full', 'Master Token (recovered)', ?)"
).run(id, hash, now);

db.close();

console.log('\n✅ New master token created:');
console.log(`\n  ${rawToken}\n`);
console.log('Save this token — it will not be shown again.');
