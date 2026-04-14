#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const Database = require('better-sqlite3');

// Production safeguard: refuse to run in production unless explicitly overridden
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_CLEANUP_IN_PRODUCTION !== '1') {
  console.error('ERROR: Refusing to run test user cleanup in production.');
  console.error('Set ALLOW_CLEANUP_IN_PRODUCTION=1 to override (use with extreme caution).');
  process.exit(1);
}

const dbPath = process.env.DB_PATH
  ? path.resolve(__dirname, '..', process.env.DB_PATH)
  : path.join(__dirname, '../data/myapi.db');
const db = new Database(dbPath);

const prefix = process.env.TEST_USER_PREFIX || 'phase12a_';
const users = db.prepare('SELECT id, username FROM users WHERE username LIKE ?').all(`${prefix}%`);

if (users.length === 0) {
  console.log(`[cleanup-test-users] no users found for prefix ${prefix}`);
  process.exit(0);
}

const tx = db.transaction((list) => {
  for (const u of list) {
    db.prepare('DELETE FROM oauth_tokens WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM access_tokens WHERE owner_id = ?').run(u.id);
    db.prepare('DELETE FROM handshakes WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)').run(u.id);
    db.prepare('DELETE FROM conversations WHERE user_id = ?').run(u.id);
    db.prepare('DELETE FROM persona_documents WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)').run(u.id);
    db.prepare('DELETE FROM persona_skills WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)').run(u.id);
    db.prepare('DELETE FROM skills WHERE owner_id = ?').run(u.id);
    db.prepare('DELETE FROM personas WHERE owner_id = ?').run(u.id);
    db.prepare('DELETE FROM kb_documents WHERE owner_id = ?').run(u.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  }
});

tx(users);
console.log(`[cleanup-test-users] deleted ${users.length} test user(s) with prefix ${prefix}`);
