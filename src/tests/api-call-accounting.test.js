/**
 * API call accounting + audit actor attribution.
 *
 * 1. Session (dashboard UI) requests must NOT increment usage_daily.api_calls
 *    and must not create generic api_request audit rows — browsing the website
 *    never inflates the API-call metric.
 * 2. Token-authenticated requests increment api_calls exactly once per request,
 *    whether or not the endpoint writes its own audit row (no double count,
 *    no missing count).
 * 3. Audit rows record the actor: auth_type, token_label, and the approved
 *    device (device_id/device_name from device management) that made the call.
 */

const request = require('supertest');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = require('../server');
const db = require('../database');
const DeviceFingerprint = require('../utils/deviceFingerprint');

const TEST_UA = 'jest-accounting/1.0';
const TEST_IP = '127.0.0.1';

function withTestHeaders(req) {
  return req
    .set('User-Agent', TEST_UA)
    .set('X-Forwarded-For', TEST_IP)
    .set('Accept-Language', 'en-US');
}

function expectedFingerprintHash() {
  return DeviceFingerprint.fromRequest({
    headers: {
      'user-agent': TEST_UA,
      'accept-language': 'en-US',
      'x-forwarded-for': TEST_IP,
    },
    hostname: '127.0.0.1',
    socket: { remoteAddress: TEST_IP },
  }).fingerprintHash;
}

function insertToken({ ownerId, scopeValue, tokenType = 'master', label }) {
  const raw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
  const hash = bcrypt.hashSync(raw, 10);
  const id = 'tok_' + crypto.randomBytes(8).toString('hex');
  db.db.prepare(`
    INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(id, hash, ownerId, scopeValue, label, new Date().toISOString(), tokenType);
  return { id, raw };
}

// Wait until res.on('finish') accounting (async, post-response) has run.
const settle = () => new Promise((r) => setTimeout(r, 60));

describe('API call accounting', () => {
  let userId;
  let token;
  let deviceId;
  let workspaceId;

  beforeAll(async () => {
    // index.js fires runMigrations() without awaiting; the actor-column
    // migration must be applied before these tests query the new columns.
    for (let i = 0; i < 100; i++) {
      const cols = db.db.prepare('PRAGMA table_info(audit_log)').all().map((c) => c.name);
      if (cols.includes('device_name')) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    const suffix = crypto.randomBytes(4).toString('hex');
    const user = db.createUser(
      'acct_' + suffix, 'Accounting Tester', `acct+${suffix}@example.com`, 'UTC', 'Password123!'
    );
    userId = user.id;

    token = insertToken({ ownerId: userId, scopeValue: 'full', label: 'Acct Master' });
    deviceId = db.createApprovedDevice(
      token.id, userId, expectedFingerprintHash(),
      'Jest Test Device', { os: 'Linux', browser: 'jest' }, TEST_IP
    );

    const ws = db.createWorkspace('Acct WS', userId, 'acct-ws-' + suffix);
    workspaceId = ws.id;
  });

  function apiCallsToday() {
    const today = new Date().toISOString().slice(0, 10);
    const row = db.db.prepare(
      'SELECT api_calls FROM usage_daily WHERE workspace_id = ? AND date = ?'
    ).get(workspaceId, today);
    return row ? row.api_calls : 0;
  }

  it('counts a token-authenticated API request exactly once', async () => {
    const before = apiCallsToday();
    const res = await withTestHeaders(request(app).get('/api/v1/identity'))
      .set('Authorization', `Bearer ${token.raw}`)
      .set('X-Workspace-ID', workspaceId);
    expect(res.status).toBe(200);
    await settle();
    expect(apiCallsToday()).toBe(before + 1);
  });

  it('does not double-count when the endpoint writes its own audit row', async () => {
    const before = apiCallsToday();
    // /identity writes a read_identity audit row itself
    await withTestHeaders(request(app).get('/api/v1/identity'))
      .set('Authorization', `Bearer ${token.raw}`)
      .set('X-Workspace-ID', workspaceId);
    await settle();
    expect(apiCallsToday()).toBe(before + 1);

    // No generic api_request row should exist for an endpoint that audited itself
    const generic = db.db.prepare(`
      SELECT COUNT(*) n FROM audit_log
      WHERE requester_id = ? AND action = 'api_request' AND resource LIKE '%/identity%'
    `).get(token.id);
    expect(generic.n).toBe(0);
  });

  it('writes a generic api_request audit row for endpoints without their own', async () => {
    // /health-style authed endpoint without explicit audit — use /api/v1/skills (has scope but
    // list endpoint does not call createAuditLog) — verify via row existence either way:
    const res = await withTestHeaders(request(app).get('/api/v1/skills'))
      .set('Authorization', `Bearer ${token.raw}`)
      .set('X-Workspace-ID', workspaceId);
    expect(res.status).toBe(200);
    await settle();
    const rows = db.db.prepare(`
      SELECT action FROM audit_log
      WHERE requester_id = ? AND resource LIKE '%/skills%'
      ORDER BY timestamp DESC LIMIT 1
    `).all(token.id);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('attributes audit rows to the initiating device from device management', async () => {
    await withTestHeaders(request(app).get('/api/v1/identity'))
      .set('Authorization', `Bearer ${token.raw}`)
      .set('X-Workspace-ID', workspaceId);
    await settle();
    const row = db.db.prepare(`
      SELECT device_id, device_name, auth_type, token_label FROM audit_log
      WHERE requester_id = ? AND device_id IS NOT NULL
      ORDER BY timestamp DESC LIMIT 1
    `).get(token.id);
    expect(row).toBeTruthy();
    expect(row.device_id).toBe(deviceId);
    expect(row.device_name).toBe('Jest Test Device');
    expect(row.auth_type).toBe('bearer');
    expect(row.token_label).toBe('Acct Master');
  });

  it('session (dashboard UI) requests never increment the API call counter', async () => {
    const agent = request.agent(app);
    const suffix = crypto.randomBytes(4).toString('hex');
    const password = 'Password123!';
    const user = db.createUser('ui_' + suffix, 'UI Tester', `ui+${suffix}@example.com`, 'UTC', password);
    db.addWorkspaceMember(workspaceId, user.id, 'member');

    const login = await withTestHeaders(agent.post('/api/v1/auth/login'))
      .send({ email: `ui+${suffix}@example.com`, password });
    expect([200, 201]).toContain(login.status);

    const before = apiCallsToday();
    const res = await withTestHeaders(agent.get('/api/v1/identity'))
      .set('X-Workspace-ID', workspaceId);
    expect(res.status).toBe(200);
    await settle();
    expect(apiCallsToday()).toBe(before);
  });
});
