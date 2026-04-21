/**
 * Dev-only script: trigger a fake security anomaly on the first active token
 * to test the suspension + notification + email flow.
 *
 * Usage: node src/scripts/trigger-security-alert.js
 */
process.env.NODE_ENV = 'development';

// Initialize config/database.js (used by security monitor and our new tables)
const configDb = require('../config/database');
const dbPath = process.env.DB_PATH || require('path').resolve(__dirname, '../data/myapi.db');
configDb.initDatabase(dbPath);
const rawDb = configDb.getDatabase();

// Also load the main database module so all tables are created
const db = require('../database');

async function main() {

  // Find first active token
  let token = null;
  try {
    token = rawDb.prepare(`SELECT id, name, type FROM tokens WHERE revoked = 0 AND (suspended_at IS NULL OR suspended_at = 0) ORDER BY created_at ASC LIMIT 1`).get();
  } catch (_) {}
  if (!token) {
    try {
      const row = rawDb.prepare(`SELECT id, label AS name, token_type AS type, owner_id FROM access_tokens WHERE revoked_at IS NULL AND suspended_at IS NULL LIMIT 1`).get();
      if (row) token = row;
    } catch (_) {}
  }

  if (!token) {
    console.error('No active tokens found in DB. Start the server at least once to generate a master token.');
    process.exit(1);
  }

  console.log(`Using token: ${token.id} (${token.name}, type=${token.type})`);

  // Prime the ASN cache with a "datacenter" baseline for 1.1.1.1
  // then use a fake residential IP for the check
  const baselineIP = '1.1.1.1';
  const baselinePrefix = '1.1.1';
  const suspiciousIP = '98.123.45.67'; // Fake Comcast residential IP
  const suspiciousPrefix = '98.123.45';
  const now = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  try {
    // Set baseline ASN (datacenter) in cache
    rawDb.prepare(`INSERT OR REPLACE INTO asn_cache (ip_prefix, asn, asn_org, org_type, cached_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(baselinePrefix, 'AS13335 Cloudflare', 'Cloudflare, Inc.', 'datacenter', now, tomorrow);

    // Set "residential" entry for the suspicious IP in cache
    rawDb.prepare(`INSERT OR REPLACE INTO asn_cache (ip_prefix, asn, asn_org, org_type, cached_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(suspiciousPrefix, 'AS7922 Comcast', 'Comcast Cable Communications, LLC', 'residential', now, tomorrow);

    // Set a datacenter baseline for this token (as if it was used from Cloudflare infra)
    rawDb.prepare(`INSERT OR REPLACE INTO token_security_baselines (token_id, baseline_asn, baseline_asn_org, baseline_ua_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(token.id, 'AS13335 Cloudflare', 'Cloudflare, Inc.', 'abc123def456', now, now);

    console.log('Baseline set: Cloudflare (datacenter)');
    console.log('Trigger IP:   Comcast residential');
  } catch (e) {
    console.error('Failed to set up baseline:', e.message);
    process.exit(1);
  }

  // Build a fake request object
  const fakeReq = {
    path: '/api/v1/services/google/gmail/messages',
    method: 'GET',
    ip: suspiciousIP,
    headers: {
      'x-forwarded-for': suspiciousIP,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 — looks human',
    },
    get: (h) => fakeReq.headers[h.toLowerCase()] || '',
  };

  console.log('\nRunning security check...');
  const { checkRequest } = require('../lib/tokenSecurityMonitor');
  const result = await checkRequest(fakeReq, token.id, token.type || 'personal');

  if (result.blocked) {
    console.log('\n✓ Anomaly detected and token suspended!');
    console.log('  Reasons:', result.reasons);
    console.log('  Approval ID:', result.approvalId);
    console.log('  Message:', result.message);
    console.log('\nCheck benami.omri@gmail.com for the security alert email.');
    console.log('Check /api/v1/notifications for the in-app notification.');
    console.log(`\nTo re-approve: POST /api/v1/devices/approve/${result.approvalId}`);
    console.log(`To unsuspend token manually: UPDATE tokens/access_tokens SET suspended_at = NULL WHERE id = '${token.id}'`);
  } else {
    console.log('\nNo anomaly triggered (result:', result, ')');
    console.log('Token may already be suspended, or baseline check skipped.');
  }
}

main().catch(e => {
  console.error('Script error:', e);
  process.exit(1);
});
