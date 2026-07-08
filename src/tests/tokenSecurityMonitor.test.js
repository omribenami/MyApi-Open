/**
 * Token Security Monitor — end-to-end anomaly pipeline tests.
 *
 * Regression context: the live server never called config/database.initDatabase(),
 * so tokenSecurityMonitor.checkRequest() threw on getDatabase(), swallowed the
 * error, and returned { blocked: false } for every request — anomaly detection
 * was silently inert in production. These tests pin down:
 *   1. Monitor is not silently inert: velocity anomalies block even without a DB.
 *   2. Full pipeline on a real (file-backed) DB shared by both database modules,
 *      exactly like production: detect → suspend → pending approval → notify.
 *   3. ASN/network drift detection.
 *   4. Re-approval unsuspends the token and resets its baseline.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

// Both database modules must open the SAME file (production topology).
// Must be set before either module is required.
const TMP_DB = path.join(os.tmpdir(), `tsec-test-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = TMP_DB;

const configDb = require('../config/database');
const monitor = require('../lib/tokenSecurityMonitor');

function fakeReq(ip, ua) {
  const headers = { 'x-forwarded-for': ip, 'user-agent': ua };
  return {
    path: '/api/v1/identity',
    method: 'GET',
    ip,
    headers,
    get: (h) => headers[h.toLowerCase()] || '',
  };
}

describe('tokenSecurityMonitor with config/database NOT initialized', () => {
  it('still blocks velocity-exceeded requests instead of failing open', async () => {
    const req = fakeReq('10.1.2.3', 'TestAgent/1.0');
    let result;
    for (let i = 0; i < 150; i++) {
      result = await monitor.checkRequest(req, 'tok_noinit_velocity', 'guest');
    }
    // guest limit is 100/min — request #150 must be blocked even though the
    // monitor has no DB to persist a suspension into.
    expect(result.blocked).toBe(true);
    expect(result.reasons.join(' ')).toMatch(/Rate limit exceeded/);
  });
});

describe('tokenSecurityMonitor full pipeline (shared file DB)', () => {
  let mainDb;
  let raw; // raw better-sqlite3 handle from config/database

  const TOKEN_VEL = 'tok_test_velocity';
  const TOKEN_DRIFT = 'tok_test_drift';
  const USER_ID = 'user_tsec_test';
  let driftApprovalId;

  beforeAll(() => {
    // Same order as src/index.js startup: main schema first, then config/database
    // (whose security migrations ALTER tables the main schema creates).
    mainDb = require('../database');
    mainDb.initDatabase();
    configDb.initDatabase(TMP_DB);
    raw = configDb.getDatabase();

    const now = new Date().toISOString();
    raw.prepare(`INSERT OR IGNORE INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, 'x', ?)`)
      .run(USER_ID, 'tsec-test', 'tsec-test@example.com', now);
    for (const tok of [TOKEN_VEL, TOKEN_DRIFT]) {
      raw.prepare(`INSERT OR IGNORE INTO access_tokens (id, hash, owner_id, scope, label, created_at) VALUES (?, ?, ?, 'full', ?, ?)`)
        .run(tok, `hash_${tok}`, USER_ID, `Test ${tok}`, now);
    }
  });

  afterAll(() => {
    try { configDb.closeDatabase(); } catch (_) {}
    for (const f of [TMP_DB, `${TMP_DB}-wal`, `${TMP_DB}-shm`]) {
      try { fs.unlinkSync(f); } catch (_) {}
    }
  });

  it('velocity anomaly suspends the token, creates approval + notification + compliance log', async () => {
    const req = fakeReq('10.9.8.7', 'AgentSteady/2.0');
    let result;
    for (let i = 0; i < 150; i++) {
      result = await monitor.checkRequest(req, TOKEN_VEL, 'guest');
    }
    expect(result.blocked).toBe(true);
    expect(result.approvalId).toBeTruthy();
    expect(result.reasons.join(' ')).toMatch(/Rate limit exceeded/);

    const susp = raw.prepare(`SELECT suspended_at, suspension_reason FROM access_tokens WHERE id = ?`).get(TOKEN_VEL);
    expect(susp.suspended_at).toBeTruthy();
    expect(susp.suspension_reason).toMatch(/Rate limit exceeded/);

    const approval = raw.prepare(`SELECT * FROM device_approvals_pending WHERE token_id = ? AND approval_type = 'security_alert'`).get(TOKEN_VEL);
    expect(approval).toBeTruthy();
    expect(approval.status).toBe('pending');

    const notif = raw.prepare(`SELECT * FROM notifications WHERE user_id = ? AND type = 'security_alert'`).all(USER_ID);
    expect(notif.length).toBeGreaterThan(0);

    const audit = raw.prepare(`SELECT * FROM compliance_audit_logs WHERE action = 'token_security_anomaly' AND entity_id = ?`).all(TOKEN_VEL);
    expect(audit.length).toBeGreaterThan(0);
  });

  it('suspended token stays suspended for the auth gate (getTokenSuspension)', () => {
    const suspension = mainDb.getTokenSuspension(TOKEN_VEL);
    expect(suspension).toBeTruthy();
    expect(suspension.suspension_reason).toMatch(/Rate limit exceeded/);
  });

  it('first request learns a baseline and backfills its ASN asynchronously', async () => {
    const tok = 'tok_test_baseline';
    const now = new Date().toISOString();
    raw.prepare(`INSERT OR IGNORE INTO access_tokens (id, hash, owner_id, scope, label, created_at) VALUES (?, ?, ?, 'full', ?, ?)`)
      .run(tok, `hash_${tok}`, USER_ID, 'Baseline test', now);

    const result = await monitor.checkRequest(fakeReq('10.5.5.5', 'AgentBaseline/1.0'), tok, 'guest');
    expect(result.blocked).toBe(false);

    // private IPs resolve synchronously — give the backfill promise a tick
    await new Promise(r => setTimeout(r, 50));
    const baseline = raw.prepare(`SELECT * FROM token_security_baselines WHERE token_id = ?`).get(tok);
    expect(baseline).toBeTruthy();
    expect(baseline.baseline_ua_hash).toBeTruthy();
    expect(baseline.baseline_asn).toBe('private'); // backfilled, not stuck NULL
  });

  it('network drift from baseline suspends the token', async () => {
    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Token historically used from Cloudflare infra with a stable UA
    raw.prepare(`INSERT OR REPLACE INTO token_security_baselines (token_id, baseline_asn, baseline_asn_org, baseline_ua_hash, created_at, updated_at)
      VALUES (?, 'AS13335 Cloudflare', 'Cloudflare, Inc.', 'stableuahash0000', ?, ?)`).run(TOKEN_DRIFT, now, now);
    // Suspicious residential IP, pre-cached so no network call happens
    raw.prepare(`INSERT OR REPLACE INTO asn_cache (ip_prefix, asn, asn_org, org_type, cached_at, expires_at)
      VALUES ('98.123.45', 'AS7922 Comcast', 'Comcast Cable Communications, LLC', 'residential', ?, ?)`).run(now, tomorrow);

    const result = await monitor.checkRequest(fakeReq('98.123.45.67', 'TotallyDifferentBrowser/9'), TOKEN_DRIFT, 'personal');
    expect(result.blocked).toBe(true);
    // A genuinely new network type is still flagged the first time it appears.
    expect(result.reasons.join(' ')).toMatch(/New network type/);
    // UA drift alone is no longer a suspension reason (too noisy for shared agent tokens).
    expect(result.reasons.join(' ')).not.toMatch(/User-Agent changed/);

    const susp = raw.prepare(`SELECT suspended_at FROM access_tokens WHERE id = ?`).get(TOKEN_DRIFT);
    expect(susp.suspended_at).toBeTruthy();

    driftApprovalId = result.approvalId;
    expect(driftApprovalId).toBeTruthy();
  });

  it('approving the security alert unsuspends the token and LEARNS the network (no re-trip)', async () => {
    const deviceId = mainDb.approvePendingDevice(driftApprovalId, 'Re-approved after review');
    expect(deviceId).toBeTruthy();

    const susp = mainDb.getTokenSuspension(TOKEN_DRIFT);
    expect(susp).toBeNull();

    // Baseline is kept and the residential network is now in the allow-list.
    const baseline = raw.prepare(`SELECT * FROM token_security_baselines WHERE token_id = ?`).get(TOKEN_DRIFT);
    expect(baseline).toBeTruthy();
    expect(JSON.parse(baseline.known_org_types)).toContain('residential');

    // The very next request from that same residential network must NOT re-trip.
    const again = await monitor.checkRequest(fakeReq('98.123.45.67', 'TotallyDifferentBrowser/9'), TOKEN_DRIFT, 'personal');
    expect(again.blocked).toBe(false);
  });

  it('multi-homed agent token does not churn between two known networks', async () => {
    const tok = 'tok_test_multihomed';
    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 864e5).toISOString();
    raw.prepare(`INSERT OR IGNORE INTO access_tokens (id, hash, owner_id, scope, label, created_at) VALUES (?, ?, ?, 'full', 'AI Agent', ?)`)
      .run(tok, `hash_${tok}`, USER_ID, now);
    // Both datacenter (ChatGPT) and residential (home agent) are already approved.
    raw.prepare(`INSERT OR REPLACE INTO token_security_baselines (token_id, baseline_asn, baseline_asn_org, baseline_ua_hash, known_org_types, known_ua_hashes, created_at, updated_at)
      VALUES (?, 'AS8075 Azure', 'Microsoft Azure Cloud', 'azureua000000000', ?, ?, ?, ?)`)
      .run(tok, JSON.stringify(['datacenter', 'residential']), JSON.stringify(['azureua000000000']), now, now);
    raw.prepare(`INSERT OR REPLACE INTO asn_cache (ip_prefix, asn, asn_org, org_type, cached_at, expires_at) VALUES ('12.34.56','AS7018 AT&T','AT&T Services, Inc','residential',?,?)`).run(now, tomorrow);
    raw.prepare(`INSERT OR REPLACE INTO asn_cache (ip_prefix, asn, asn_org, org_type, cached_at, expires_at) VALUES ('20.50.60','AS8075 Azure','Microsoft Azure Cloud','datacenter',?,?)`).run(now, tomorrow);

    // From residential, with a brand-new UA → must NOT block (known network, UA learned).
    const r1 = await monitor.checkRequest(fakeReq('12.34.56.78', 'HermesAgent/9.9'), tok, 'master');
    expect(r1.blocked).toBe(false);
    // Back to datacenter → must NOT block.
    const r2 = await monitor.checkRequest(fakeReq('20.50.60.70', 'ChatGPT/1.0'), tok, 'master');
    expect(r2.blocked).toBe(false);
  });

  it('OAuth-delegated tokens are exempt from network/UA suspension (ChatGPT roams datacenter↔residential)', async () => {
    const tok = 'tok_test_oauth_client';
    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 864e5).toISOString();
    // An OAuth-client token (oauth_client_id set), like ChatGPT.
    raw.prepare(`INSERT OR IGNORE INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, oauth_client_id) VALUES (?, ?, ?, 'full', 'ChatGPT (OAuth)', ?, 'guest', 'chatgpt')`)
      .run(tok, `hash_${tok}`, USER_ID, now);
    raw.prepare(`INSERT OR REPLACE INTO asn_cache (ip_prefix, asn, asn_org, org_type, cached_at, expires_at) VALUES ('20.50.60','AS8075 Azure','Microsoft Azure Cloud','datacenter',?,?)`).run(now, tomorrow);
    raw.prepare(`INSERT OR REPLACE INTO asn_cache (ip_prefix, asn, asn_org, org_type, cached_at, expires_at) VALUES ('98.76.54','AS21928 T-Mobile','T-Mobile USA, Inc.','residential',?,?)`).run(now, tomorrow);

    // First from Azure datacenter (ChatGPT servers), then from T-Mobile residential
    // (the user's phone app) with a different UA — neither must suspend.
    expect((await monitor.checkRequest(fakeReq('20.50.60.70', 'ChatGPT-User/1.0'), tok, 'guest')).blocked).toBe(false);
    expect((await monitor.checkRequest(fakeReq('98.76.54.32', 'okhttp/4.9 (Android)'), tok, 'guest')).blocked).toBe(false);
    expect((await monitor.checkRequest(fakeReq('20.50.60.71', 'OpenAI/python'), tok, 'guest')).blocked).toBe(false);
    // Never suspended.
    const susp = raw.prepare(`SELECT suspended_at FROM access_tokens WHERE id = ?`).get(tok);
    expect(susp.suspended_at).toBeFalsy();
  });
});
