/**
 * Regression tests for PUT /api/v1/tokens/:id
 *
 * Guards against two historical bugs:
 *   1. PUT endpoint silently dropped `requires_approval` / scopeBundle / allowedResources
 *      — callers could appear to toggle the flag but nothing persisted.
 *   2. Scoped token with requires_approval=1 still passed the device-approval gate
 *      because the middleware short-circuited before checking the flag.
 *   3. List endpoint leaked bcrypt `hash` field.
 *
 * Also exercises the "approved devices are revoked when approval is newly enabled"
 * behavior so that flipping the flag actually gates subsequent requests.
 */

const request = require('supertest');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = require('../server');
const db = require('../database');
const DeviceFingerprint = require('../utils/deviceFingerprint');

// Pin a stable request context so DeviceFingerprint.fromRequest() produces a
// deterministic hash we can pre-approve.
const TEST_UA = 'jest-token-update-test/1.0';
const TEST_IP = '127.0.0.1';

function withTestHeaders(req) {
  return req
    .set('User-Agent', TEST_UA)
    .set('X-Forwarded-For', TEST_IP)
    .set('Accept-Language', 'en-US');
}

function expectedFingerprintHash() {
  // Must match what middleware computes for a supertest-driven request.
  // Supertest binds the app to an ephemeral port on 127.0.0.1; Express's
  // req.hostname resolves to '127.0.0.1' in that environment.
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

function seedTestUser() {
  const suffix = crypto.randomBytes(4).toString('hex');
  const user = db.createUser('tester_' + suffix, 'Test User', `tester+${suffix}@example.com`, 'UTC', 'Password123!');
  return user.id;
}

function seedMasterToken(userId) {
  const raw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
  const hash = bcrypt.hashSync(raw, 10);
  const id = 'tok_master_' + crypto.randomBytes(8).toString('hex');
  db.db.prepare(`
    INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type)
    VALUES (?, ?, ?, 'full', 'Test Master', ?, 'master')
  `).run(id, hash, userId, new Date().toISOString());

  // Pre-approve the test device for this master token so device approval
  // middleware lets our requests through.
  const fpHash = expectedFingerprintHash();
  db.createApprovedDevice(id, userId, fpHash, 'Test Master Device', { os: 'Linux', browser: 'jest' }, TEST_IP);

  return { id, raw, userId };
}

let sharedMaster;
beforeAll(() => {
  const userId = seedTestUser();
  sharedMaster = seedMasterToken(userId);
});

describe('PUT /api/v1/tokens/:id — partial updates', () => {
  let master;
  beforeAll(() => { master = sharedMaster; });

  async function createScopedToken(body = {}) {
    const res = await withTestHeaders(request(app)
      .post('/api/v1/tokens'))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({
        label: 'Scoped Token',
        scopes: ['basic'],
        requiresApproval: false,
        ...body,
      });
    expect(res.status).toBe(201);
    return res.body.data;
  }

  it('persists requiresApproval when toggled from false -> true', async () => {
    const token = await createScopedToken();
    expect(token.requiresApproval).toBe(false);

    const putRes = await withTestHeaders(request(app)
      .put(`/api/v1/tokens/${token.id}`))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ requiresApproval: true });

    expect(putRes.status).toBe(200);
    expect(putRes.body.data.requiresApproval).toBe(true);

    const row = db.db.prepare('SELECT requires_approval FROM access_tokens WHERE id = ?')
      .get(token.id);
    expect(row.requires_approval).toBe(1);
  });

  it('persists requiresApproval when toggled from true -> false', async () => {
    const token = await createScopedToken({ requiresApproval: true });
    expect(token.requiresApproval).toBe(true);

    const putRes = await withTestHeaders(request(app)
      .put(`/api/v1/tokens/${token.id}`))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ requiresApproval: false });

    expect(putRes.status).toBe(200);
    expect(putRes.body.data.requiresApproval).toBe(false);

    const row = db.db.prepare('SELECT requires_approval FROM access_tokens WHERE id = ?')
      .get(token.id);
    expect(row.requires_approval).toBe(0);
  });

  it('revokes previously-approved devices when approval is newly enabled', async () => {
    const token = await createScopedToken();
    // Seed an approved device for this token
    const fpHash = crypto.randomBytes(16).toString('hex');
    db.createApprovedDevice(token.id, master.userId, fpHash, 'Test Device',
      { os: 'Linux', browser: 'jest' }, '127.0.0.2');

    const before = db.db.prepare(
      'SELECT revoked_at FROM approved_devices WHERE token_id = ? AND device_fingerprint_hash = ?'
    ).get(token.id, fpHash);
    expect(before.revoked_at).toBeNull();

    const putRes = await withTestHeaders(request(app)
      .put(`/api/v1/tokens/${token.id}`))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ requiresApproval: true });

    expect(putRes.status).toBe(200);

    const after = db.db.prepare(
      'SELECT revoked_at FROM approved_devices WHERE token_id = ? AND device_fingerprint_hash = ?'
    ).get(token.id, fpHash);
    expect(after.revoked_at).not.toBeNull();
  });

  it('does NOT revoke approved devices when approval is disabled', async () => {
    const token = await createScopedToken({ requiresApproval: true });
    const fpHash = crypto.randomBytes(16).toString('hex');
    db.createApprovedDevice(token.id, master.userId, fpHash, 'Test Device',
      { os: 'Linux', browser: 'jest' }, '127.0.0.2');

    await withTestHeaders(request(app)
      .put(`/api/v1/tokens/${token.id}`))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ requiresApproval: false });

    const after = db.db.prepare(
      'SELECT revoked_at FROM approved_devices WHERE token_id = ? AND device_fingerprint_hash = ?'
    ).get(token.id, fpHash);
    expect(after.revoked_at).toBeNull();
  });

  it('supports partial updates (scopes only, approval preserved)', async () => {
    const token = await createScopedToken({ requiresApproval: true });

    const putRes = await withTestHeaders(request(app)
      .put(`/api/v1/tokens/${token.id}`))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ scopes: ['basic', 'professional'] });

    expect(putRes.status).toBe(200);
    expect(putRes.body.data.scopes).toEqual(expect.arrayContaining(['basic', 'professional']));

    // approval flag must not be cleared when only scopes are sent
    const row = db.db.prepare('SELECT requires_approval FROM access_tokens WHERE id = ?')
      .get(token.id);
    expect(row.requires_approval).toBe(1);
  });

  it('rejects empty body with 400', async () => {
    const token = await createScopedToken();
    const res = await withTestHeaders(request(app)
      .put(`/api/v1/tokens/${token.id}`))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects modification of master tokens', async () => {
    const res = await withTestHeaders(request(app)
      .put(`/api/v1/tokens/${master.id}`))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ requiresApproval: true });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown token id', async () => {
    const res = await withTestHeaders(request(app)
      .put('/api/v1/tokens/tok_does_not_exist'))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ requiresApproval: true });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/tokens — response safety', () => {
  let master;
  beforeAll(() => { master = sharedMaster; });

  it('never returns bcrypt hash in the list response', async () => {
    const res = await withTestHeaders(request(app)
      .get('/api/v1/tokens'))
      .set('Authorization', `Bearer ${master.raw}`);
    expect(res.status).toBe(200);
    const serialized = JSON.stringify(res.body);
    // Hash always starts with $2 for bcrypt
    expect(serialized).not.toMatch(/"hash"\s*:\s*"\$2/);
    for (const t of res.body.data || []) {
      expect(t.hash).toBeUndefined();
    }
  });

  it('includes requiresApproval in the list response', async () => {
    // create a token with approval
    const createRes = await withTestHeaders(request(app)
      .post('/api/v1/tokens'))
      .set('Authorization', `Bearer ${master.raw}`)
      .send({ label: 'Approved Token', scopes: ['basic'], requiresApproval: true });
    expect(createRes.status).toBe(201);

    const res = await withTestHeaders(request(app)
      .get('/api/v1/tokens'))
      .set('Authorization', `Bearer ${master.raw}`);
    expect(res.status).toBe(200);
    const found = (res.body.data || []).find(t => (t.id || t.tokenId) === createRes.body.data.id);
    expect(found).toBeDefined();
    expect(found.requiresApproval).toBe(true);
  });
});
