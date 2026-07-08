/**
 * Multi-user data isolation.
 *
 * Proves that two independent users cannot see each other's personal data:
 *   - preferences (durable, per-user) — DB layer + HTTP
 *   - identity (/api/v1/users/me) — non-owner users served from their OWN record
 *
 * Regression guard for the move off the in-memory, single-tenant vault:
 * preferences are now persisted per-user in the user_preferences table.
 */
const request = require('supertest');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = require('../server');
const db = require('../database');
const DeviceFingerprint = require('../utils/deviceFingerprint');
const { createUser, createApprovedDevice, getUserPreferences, setUserPreferences } = db;

const TEST_UA = 'jest-multiuser/1.0';
const TEST_IP = '127.0.0.1';
const withHeaders = (req) => req
  .set('User-Agent', TEST_UA).set('X-Forwarded-For', TEST_IP).set('Accept-Language', 'en-US');

function fpHash() {
  return DeviceFingerprint.fromRequest({
    headers: { 'user-agent': TEST_UA, 'accept-language': 'en-US', 'x-forwarded-for': TEST_IP },
    socket: { remoteAddress: TEST_IP },
  }).fingerprintHash;
}

function makeUserWithMaster(tag) {
  const s = crypto.randomBytes(4).toString('hex');
  const user = createUser(`${tag}_${s}`, `${tag} ${s}`, `${tag}+${s}@example.com`, 'UTC', 'Password123!');
  const raw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
  const hash = bcrypt.hashSync(raw, 10);
  const id = 'tok_' + crypto.randomBytes(8).toString('hex');
  db.db.prepare(`INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type)
                 VALUES (?, ?, ?, 'full', ?, ?, 'master')`)
    .run(id, hash, user.id, `${tag} master`, new Date().toISOString());
  // Pre-approve the test device so device-approval middleware lets the token through.
  createApprovedDevice(id, user.id, fpHash(), `${tag} device`, { os: 'Linux', browser: 'jest' }, TEST_IP);
  return { userId: user.id, raw, tokenId: id };
}

describe('Multi-user data isolation', () => {
  let A, B;

  beforeAll(() => {
    db.initDatabase();
    A = makeUserWithMaster('alice');
    B = makeUserWithMaster('bob');
  });

  describe('preferences — DB layer (isolation + durability)', () => {
    it('stores per-user and survives a re-read (i.e. a restart)', () => {
      setUserPreferences(A.userId, { theme: 'dark', lang: 'en' });
      setUserPreferences(B.userId, { theme: 'light' });
      // Re-read straight from the DB (no in-memory cache) — proves persistence + isolation.
      expect(getUserPreferences(A.userId)).toEqual({ theme: 'dark', lang: 'en' });
      expect(getUserPreferences(B.userId)).toEqual({ theme: 'light' });
    });

    it('one user\'s write never bleeds into another', () => {
      setUserPreferences(A.userId, { onlyAlice: true });
      expect(getUserPreferences(B.userId).onlyAlice).toBeUndefined();
    });
  });

  describe('preferences — HTTP (/api/v1/preferences)', () => {
    it('user B cannot read user A preferences', async () => {
      await withHeaders(request(app).put('/api/v1/preferences'))
        .set('Authorization', `Bearer ${A.raw}`).send({ secret: 'alice-only' }).expect(200);
      await withHeaders(request(app).put('/api/v1/preferences'))
        .set('Authorization', `Bearer ${B.raw}`).send({ secret: 'bob-only' }).expect(200);

      const aRes = await withHeaders(request(app).get('/api/v1/preferences')).set('Authorization', `Bearer ${A.raw}`);
      const bRes = await withHeaders(request(app).get('/api/v1/preferences')).set('Authorization', `Bearer ${B.raw}`);
      expect(aRes.status).toBe(200);
      expect(bRes.status).toBe(200);
      expect(aRes.body.data.secret).toBe('alice-only');
      expect(bRes.body.data.secret).toBe('bob-only');
    });
  });

  describe('identity — HTTP (/api/v1/users/me)', () => {
    it('each user sees only their own identity, never the other\'s', async () => {
      await withHeaders(request(app).put('/api/v1/users/me'))
        .set('Authorization', `Bearer ${A.raw}`).send({ Bio: 'I am Alice' }).expect(200);
      await withHeaders(request(app).put('/api/v1/users/me'))
        .set('Authorization', `Bearer ${B.raw}`).send({ Bio: 'I am Bob' }).expect(200);

      const aRes = await withHeaders(request(app).get('/api/v1/users/me')).set('Authorization', `Bearer ${A.raw}`);
      const bRes = await withHeaders(request(app).get('/api/v1/users/me')).set('Authorization', `Bearer ${B.raw}`);
      expect(aRes.status).toBe(200);
      expect(bRes.status).toBe(200);
      expect(aRes.body.identity.Bio).toBe('I am Alice');
      expect(bRes.body.identity.Bio).toBe('I am Bob');
      // Hard cross-check: neither response contains the other user's data.
      expect(JSON.stringify(aRes.body.identity)).not.toContain('I am Bob');
      expect(JSON.stringify(bRes.body.identity)).not.toContain('I am Alice');
    });
  });
});
