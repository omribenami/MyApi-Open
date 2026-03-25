#!/usr/bin/env node
/**
 * Emergency master token recovery script.
 * Run directly on the server when locked out of the API:
 *
 *   node src/scripts/recover-master-token.js
 *
 * Revokes all existing master tokens and creates a fresh one.
 * Prints the raw token to stdout — save it immediately.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
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
