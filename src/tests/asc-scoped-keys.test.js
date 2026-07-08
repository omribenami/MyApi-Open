/**
 * Scoped ASC keys: MCP agent Ed25519 keys registered with a scoped token
 * inherit that token's scope instead of full account access.
 *
 *   1. Registration with a scoped token binds scope into the pending approval
 *   2. Approval persists scope on approved_devices + mirrors to access_token_scopes
 *   3. Signed ASC requests carry the bound scope (guest semantics, not master)
 *   4. In-scope service calls work; out-of-scope service calls 403
 *   5. Legacy keys (no scope) keep full access
 */

const request = require('supertest');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = require('../server');
const db = require('../database');
const {
  createUser,
  createAscSelfRegistration,
  approvePendingDevice,
  getPendingApprovalById,
  createApprovedDeviceASC,
  getApprovedDeviceByKeyFingerprintGlobal,
  getTokenScopes,
} = db;

function seedUser(prefix) {
  const suffix = crypto.randomBytes(4).toString('hex');
  return createUser(`${prefix}_${suffix}`, prefix, `${prefix}+${suffix}@example.com`, 'UTC', 'Password123!', 'pro');
}

function makeAgentKey() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const rawPub = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  const rawPubB64 = rawPub.toString('base64');
  const fingerprint = crypto.createHash('sha256').update(rawPub).digest('hex').substring(0, 32);
  return { privateKey, rawPubB64, fingerprint };
}

function ascHeaders(key) {
  const ts = String(Math.floor(Date.now() / 1000));
  const msg = Buffer.from(`${ts}:${key.fingerprint}`);
  const sig = crypto.sign(null, msg, key.privateKey).toString('base64');
  return {
    'X-Agent-PublicKey': key.rawPubB64,
    'X-Agent-Signature': sig,
    'X-Agent-Timestamp': ts,
  };
}

function ascRequest(method, path, key) {
  let req = request(app)[method](path);
  for (const [h, v] of Object.entries(ascHeaders(key))) req = req.set(h, v);
  return req;
}

describe('Scoped ASC keys', () => {
  let user;

  beforeAll(() => {
    db.initDatabase();
    // These columns normally arrive via async boot migrations — ensure they
    // exist before the first synchronous DB call in this suite.
    try { db.db.exec("ALTER TABLE device_approvals_pending ADD COLUMN approval_type TEXT DEFAULT 'device'"); } catch (_) {}
    try { db.db.exec("ALTER TABLE approved_devices ADD COLUMN scope TEXT DEFAULT 'full'"); } catch (_) {}
    user = seedUser('ascscope');
  });

  test('registration + approval persist the bound scope end to end', () => {
    const key = makeAgentKey();
    const approvalId = createAscSelfRegistration(
      user.id, key.fingerprint, key.rawPubB64, 'Scoped Agent', '127.0.0.1',
      ['services:gmail:read', 'services:googlecalendar:read']
    );
    const pending = getPendingApprovalById(approvalId);
    const info = JSON.parse(pending.device_info_json);
    expect(info.scope).toEqual(['services:gmail:read', 'services:googlecalendar:read']);

    approvePendingDevice(approvalId, 'Scoped Agent');
    const device = getApprovedDeviceByKeyFingerprintGlobal(key.fingerprint);
    expect(JSON.parse(device.scope)).toEqual(['services:gmail:read', 'services:googlecalendar:read']);
    // Mirrored to the scope table under the fingerprint for requireScopes()
    expect(getTokenScopes(key.fingerprint)).toEqual(
      expect.arrayContaining(['services:gmail:read', 'services:googlecalendar:read'])
    );
  });

  test('signed request with a scoped key reports guest scope, not full', async () => {
    const key = makeAgentKey();
    createApprovedDeviceASC('asc_self_reg', user.id, key.fingerprint, key.rawPubB64,
      'Scoped Probe Agent', {}, '127.0.0.1', ['services:gmail:read']);

    const res = await ascRequest('get', '/api/v1/tokens/me/capabilities', key);
    expect(res.status).toBe(200);
    expect(res.body.token.scope).toBe(JSON.stringify(['services:gmail:read']));
    expect(res.body.token.authType).toBe('asc');
  });

  test('in-scope service call passes; out-of-scope service call is rejected', async () => {
    const key = makeAgentKey();
    createApprovedDeviceASC('asc_self_reg', user.id, key.fingerprint, key.rawPubB64,
      'Gmail-only Agent', {}, '127.0.0.1', ['services:gmail:read']);

    const inScope = await ascRequest('get', '/api/v1/services/preferences/gmail', key);
    expect([200, 404]).toContain(inScope.status); // allowed through the scope gate

    const outOfScope = await ascRequest('get', '/api/v1/services/preferences/slack', key);
    expect(outOfScope.status).toBe(403);
  });

  test('scoped key cannot mint tokens (master-only endpoint)', async () => {
    const key = makeAgentKey();
    createApprovedDeviceASC('asc_self_reg', user.id, key.fingerprint, key.rawPubB64,
      'No-mint Agent', {}, '127.0.0.1', ['services:gmail:read']);

    const res = await ascRequest('post', '/api/v1/tokens', key)
      .send({ label: 'escalation attempt', scopes: ['services:gmail:read'] });
    expect(res.status).toBe(403);
  });

  test('legacy key without scope keeps full/master semantics', async () => {
    const key = makeAgentKey();
    createApprovedDeviceASC('asc_self_reg', user.id, key.fingerprint, key.rawPubB64,
      'Legacy Full Agent', {}, '127.0.0.1');

    const res = await ascRequest('get', '/api/v1/tokens/me/capabilities', key);
    expect(res.status).toBe(200);
    expect(res.body.token.scope).toBe('full');
  });

  test('register with bind_token_id inherits the chosen token scopes (dashboard picker path)', async () => {
    // Full-scope registering credential (like a dashboard session / master token)…
    const masterRaw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
    const masterId = 'tok_' + crypto.randomBytes(8).toString('hex');
    db.db.prepare(`
      INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval)
      VALUES (?, ?, ?, 'full', 'picker master', ?, 'master', 0)
    `).run(masterId, bcrypt.hashSync(masterRaw, 4), user.id, new Date().toISOString());

    // …explicitly picking a scoped token as the agent's access level
    const scopedId = 'tok_' + crypto.randomBytes(8).toString('hex');
    db.db.prepare(`
      INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval)
      VALUES (?, ?, ?, ?, 'gmail template', ?, 'guest', 0)
    `).run(scopedId, bcrypt.hashSync('unused', 4), user.id, JSON.stringify(['services:gmail:read']), new Date().toISOString());

    const key = makeAgentKey();
    const res = await request(app)
      .post('/api/v1/agentic/asc/register')
      .set('Authorization', `Bearer ${masterRaw}`)
      .set('User-Agent', 'jest-asc-scoped/1.0')
      .send({ public_key: key.rawPubB64, label: 'Picker Agent', bind_token_id: scopedId });
    expect(res.status).toBe(202);
    expect(res.body.scope).toEqual(['services:gmail:read']);

    // Foreign token id → 404, no scope leak
    const stranger = seedUser('strangertok');
    const foreignId = 'tok_' + crypto.randomBytes(8).toString('hex');
    db.db.prepare(`
      INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval)
      VALUES (?, ?, ?, ?, 'foreign', ?, 'guest', 0)
    `).run(foreignId, bcrypt.hashSync('unused', 4), stranger.id, JSON.stringify(['services:slack:read']), new Date().toISOString());

    const bad = await request(app)
      .post('/api/v1/agentic/asc/register')
      .set('Authorization', `Bearer ${masterRaw}`)
      .set('User-Agent', 'jest-asc-scoped/1.0')
      .send({ public_key: makeAgentKey().rawPubB64, bind_token_id: foreignId });
    expect(bad.status).toBe(404);
  });

  describe('Quick Connect enrollment codes', () => {
    function mintMaster() {
      const raw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
      const id = 'tok_' + crypto.randomBytes(8).toString('hex');
      db.db.prepare(`
        INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval)
        VALUES (?, ?, ?, 'full', 'qc master', ?, 'master', 0)
      `).run(id, bcrypt.hashSync(raw, 4), user.id, new Date().toISOString());
      return raw;
    }

    test('mint (scoped) → enroll → key is pre-approved with bound scope; code single-use', async () => {
      const masterRaw = mintMaster();
      const scopedId = 'tok_' + crypto.randomBytes(8).toString('hex');
      db.db.prepare(`
        INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval)
        VALUES (?, ?, ?, ?, 'qc gmail', ?, 'guest', 0)
      `).run(scopedId, bcrypt.hashSync('x', 4), user.id, JSON.stringify(['services:gmail:read']), new Date().toISOString());

      const mint = await request(app)
        .post('/api/v1/agentic/asc/enroll-code')
        .set('Authorization', `Bearer ${masterRaw}`)
        .set('User-Agent', 'jest-qc/1.0')
        .send({ bind_token_id: scopedId, label: 'QC Agent' });
      expect(mint.status).toBe(201);
      expect(mint.body.code).toMatch(/^MYAPI-/);
      expect(mint.body.scope).toEqual(['services:gmail:read']);

      // Enroll (public — no auth header at all)
      const key = makeAgentKey();
      const enroll = await request(app)
        .post('/api/v1/agentic/asc/enroll')
        .set('User-Agent', 'jest-qc/1.0')
        .send({ code: mint.body.code, public_key: key.rawPubB64 });
      expect(enroll.status).toBe(200);
      expect(enroll.body.status).toBe('approved');
      expect(enroll.body.scope).toEqual(['services:gmail:read']);

      // Key works immediately, scoped
      const probe = await ascRequest('get', '/api/v1/tokens/me/capabilities', key);
      expect(probe.status).toBe(200);
      expect(probe.body.token.scope).toBe(JSON.stringify(['services:gmail:read']));

      // Code is consumed — replay with a fresh key fails
      const replay = await request(app)
        .post('/api/v1/agentic/asc/enroll')
        .set('User-Agent', 'jest-qc/1.0')
        .send({ code: mint.body.code, public_key: makeAgentKey().rawPubB64 });
      expect(replay.status).toBe(400);
    });

    test('expired code rejected; garbage code rejected with identical error', async () => {
      const masterRaw = mintMaster();
      const mint = await request(app)
        .post('/api/v1/agentic/asc/enroll-code')
        .set('Authorization', `Bearer ${masterRaw}`)
        .set('User-Agent', 'jest-qc/1.0')
        .send({});
      expect(mint.status).toBe(201);
      expect(mint.body.scope).toBe('full');
      db.db.prepare("UPDATE asc_enroll_codes SET expires_at = '2000-01-01T00:00:00.000Z' WHERE code_hash = ?")
        .run(require('crypto').createHash('sha256').update(mint.body.code).digest('hex'));

      const expired = await request(app).post('/api/v1/agentic/asc/enroll')
        .set('User-Agent', 'jest-qc/1.0')
        .send({ code: mint.body.code, public_key: makeAgentKey().rawPubB64 });
      const garbage = await request(app).post('/api/v1/agentic/asc/enroll')
        .set('User-Agent', 'jest-qc/1.0')
        .send({ code: 'MYAPI-NOT-REAL', public_key: makeAgentKey().rawPubB64 });
      expect(expired.status).toBe(400);
      expect(garbage.status).toBe(400);
      expect(expired.body.error).toBe(garbage.body.error); // no oracle
    });

    test('re-enroll with previous-key proof replaces the old key (scope narrowing)', async () => {
      const masterRaw = mintMaster();

      // First enroll: full-access key A
      const mintA = await request(app)
        .post('/api/v1/agentic/asc/enroll-code')
        .set('Authorization', `Bearer ${masterRaw}`)
        .set('User-Agent', 'jest-qc/1.0')
        .send({ label: 'Full Agent' });
      const keyA = makeAgentKey();
      const enrollA = await request(app)
        .post('/api/v1/agentic/asc/enroll')
        .set('User-Agent', 'jest-qc/1.0')
        .send({ code: mintA.body.code, public_key: keyA.rawPubB64 });
      expect(enrollA.body.status).toBe('approved');

      // Second enroll: scoped code + proof of key A → key B replaces A
      const scopedId = 'tok_' + crypto.randomBytes(8).toString('hex');
      db.db.prepare(`
        INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval)
        VALUES (?, ?, ?, ?, 'narrow gmail', ?, 'guest', 0)
      `).run(scopedId, bcrypt.hashSync('x', 4), user.id, JSON.stringify(['services:gmail:read']), new Date().toISOString());
      const mintB = await request(app)
        .post('/api/v1/agentic/asc/enroll-code')
        .set('Authorization', `Bearer ${masterRaw}`)
        .set('User-Agent', 'jest-qc/1.0')
        .send({ bind_token_id: scopedId, label: 'Narrowed Agent' });

      const keyB = makeAgentKey();
      const proof = ascHeaders(keyA);
      const enrollB = await request(app)
        .post('/api/v1/agentic/asc/enroll')
        .set('User-Agent', 'jest-qc/1.0')
        .send({
          code: mintB.body.code,
          public_key: keyB.rawPubB64,
          previous_public_key: keyA.rawPubB64,
          previous_signature: proof['X-Agent-Signature'],
          previous_timestamp: proof['X-Agent-Timestamp'],
        });
      expect(enrollB.status).toBe(200);
      expect(enrollB.body.status).toBe('approved');
      expect(enrollB.body.scope).toEqual(['services:gmail:read']);
      expect(enrollB.body.replaced_fingerprint).toBe(keyA.fingerprint);

      // Key B works with the narrowed scope; key A is dead
      const probeB = await ascRequest('get', '/api/v1/tokens/me/capabilities', keyB);
      expect(probeB.status).toBe(200);
      expect(probeB.body.token.scope).toBe(JSON.stringify(['services:gmail:read']));
      const probeA = await ascRequest('get', '/api/v1/tokens/me/capabilities', keyA);
      expect(probeA.status).toBe(401);
    });

    test('replacement proof cannot revoke another user\'s key', async () => {
      // Victim: approved key owned by a different user
      const victim = seedUser('qcvictim');
      const victimKey = makeAgentKey();
      createApprovedDeviceASC('asc_self_reg', victim.id, victimKey.fingerprint,
        victimKey.rawPubB64, 'Victim Agent', {}, '127.0.0.1');

      // Attacker enrolls with a valid code + valid proof of the victim's key
      // (assume the attacker somehow got a signature — even then, cross-user
      // revocation must not happen because the device owner differs)
      const masterRaw = mintMaster();
      const mint = await request(app)
        .post('/api/v1/agentic/asc/enroll-code')
        .set('Authorization', `Bearer ${masterRaw}`)
        .set('User-Agent', 'jest-qc/1.0')
        .send({});
      const proof = ascHeaders(victimKey);
      const enroll = await request(app)
        .post('/api/v1/agentic/asc/enroll')
        .set('User-Agent', 'jest-qc/1.0')
        .send({
          code: mint.body.code,
          public_key: makeAgentKey().rawPubB64,
          previous_public_key: victimKey.rawPubB64,
          previous_signature: proof['X-Agent-Signature'],
          previous_timestamp: proof['X-Agent-Timestamp'],
        });
      expect(enroll.status).toBe(200);
      expect(enroll.body.replaced_fingerprint).toBeNull();
      // Victim's key still alive
      const probe = await ascRequest('get', '/api/v1/tokens/me/capabilities', victimKey);
      expect(probe.status).toBe(200);
    });

    test('replacement with an invalid signature enrolls but revokes nothing', async () => {
      const masterRaw = mintMaster();
      const keyA = makeAgentKey();
      createApprovedDeviceASC('asc_self_reg', user.id, keyA.fingerprint,
        keyA.rawPubB64, 'Sig Test Agent', {}, '127.0.0.1');

      const mint = await request(app)
        .post('/api/v1/agentic/asc/enroll-code')
        .set('Authorization', `Bearer ${masterRaw}`)
        .set('User-Agent', 'jest-qc/1.0')
        .send({});
      const enroll = await request(app)
        .post('/api/v1/agentic/asc/enroll')
        .set('User-Agent', 'jest-qc/1.0')
        .send({
          code: mint.body.code,
          public_key: makeAgentKey().rawPubB64,
          previous_public_key: keyA.rawPubB64,
          previous_signature: Buffer.from('bogus-signature-64-bytes-of-garbage-padding-here-xxxxxxxxxxxxxx').toString('base64'),
          previous_timestamp: String(Math.floor(Date.now() / 1000)),
        });
      expect(enroll.status).toBe(200);
      expect(enroll.body.replaced_fingerprint).toBeNull();
      const probe = await ascRequest('get', '/api/v1/tokens/me/capabilities', keyA);
      expect(probe.status).toBe(200);
    });

    test('scoped tokens cannot mint enrollment codes', async () => {
      const scopedRaw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
      const scopedId = 'tok_' + crypto.randomBytes(8).toString('hex');
      db.db.prepare(`
        INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval)
        VALUES (?, ?, ?, ?, 'weak', ?, 'guest', 0)
      `).run(scopedId, bcrypt.hashSync(scopedRaw, 4), user.id, JSON.stringify(['services:gmail:read']), new Date().toISOString());

      const res = await request(app)
        .post('/api/v1/agentic/asc/enroll-code')
        .set('Authorization', `Bearer ${scopedRaw}`)
        .set('User-Agent', 'jest-qc/1.0')
        .send({});
      expect(res.status).toBe(403);
    });
  });

  test('register endpoint binds scope from a scoped bearer token', async () => {
    // Scoped bearer token (requires_approval=0 skips device gating)
    const raw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
    const tokenId = 'tok_' + crypto.randomBytes(8).toString('hex');
    db.db.prepare(`
      INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval)
      VALUES (?, ?, ?, ?, 'scoped reg token', ?, 'guest', 0)
    `).run(tokenId, bcrypt.hashSync(raw, 4), user.id, JSON.stringify(['services:notion:read']), new Date().toISOString());

    const key = makeAgentKey();
    const res = await request(app)
      .post('/api/v1/agentic/asc/register')
      .set('Authorization', `Bearer ${raw}`)
      .set('User-Agent', 'jest-asc-scoped/1.0')
      .send({ public_key: key.rawPubB64, label: 'Notion Agent' });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('pending_approval');
    expect(res.body.scope).toEqual(['services:notion:read']);
    expect(res.body.message).toMatch(/limited to: services:notion:read/);
  });
});
