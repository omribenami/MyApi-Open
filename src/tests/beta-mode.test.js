/**
 * BETA mode integration tests: user cap enforcement, waitlist, plan gating,
 * and the public /config/public endpoint.
 */

process.env.BETA = 'true';
process.env.BETA_MAX_USERS = '2';

const request = require('supertest');
const app = require('../server');
const db = require('../database');
const betaMode = require('../lib/betaMode');

describe('BETA mode', () => {
  const suffix = Date.now();

  beforeEach(() => {
    betaMode.invalidateBetaFullCache();
  });

  describe('countTotalUsers', () => {
    it('reflects new users and excludes deleted', () => {
      const before = db.countTotalUsers();
      const u = db.createUser(`count_user_${suffix}`, 'Count User', `count${suffix}@example.com`, 'UTC', 'test-password-only');
      expect(db.countTotalUsers()).toBe(before + 1);
      db.db.prepare("UPDATE users SET status = 'deleted' WHERE id = ?").run(u.id);
      expect(db.countTotalUsers()).toBe(before);
    });
  });

  describe('GET /api/v1/config/public', () => {
    it('returns beta status', async () => {
      const res = await request(app).get('/api/v1/config/public');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(
        expect.objectContaining({
          beta: true,
          betaMaxUsers: expect.any(Number),
          betaFull: expect.any(Boolean),
        })
      );
    });
  });

  describe('GET /api/v1/billing/plans beta_locked annotation', () => {
    it('marks non-free plans as beta_locked in BETA mode', async () => {
      const res = await request(app).get('/api/v1/billing/plans');
      expect(res.status).toBe(200);
      const plans = res.body.data || [];
      const free = plans.find((p) => String(p.id).toLowerCase() === 'free');
      const pro = plans.find((p) => String(p.id).toLowerCase() === 'pro');
      if (free) expect(free.beta_locked).toBe(false);
      if (pro) expect(pro.beta_locked).toBe(true);
    });
  });

  describe('POST /api/v1/waitlist', () => {
    const email = `waitlist_${suffix}@example.com`;

    it('accepts a valid email and is idempotent on duplicate', async () => {
      const first = await request(app).post('/api/v1/waitlist').send({ email });
      expect([200, 201]).toContain(first.status);
      expect(first.body.data.email).toBe(email);
      expect(first.body.data.alreadyOnWaitlist).toBe(false);

      const second = await request(app).post('/api/v1/waitlist').send({ email });
      expect(second.status).toBe(200);
      expect(second.body.data.alreadyOnWaitlist).toBe(true);
    });

    it('rejects malformed emails', async () => {
      const res = await request(app).post('/api/v1/waitlist').send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });
  });

  describe('register cap enforcement', () => {
    it('returns 403 BETA_FULL once cap is reached', async () => {
      // Cap is 2. Seat the DB up to the cap.
      while (db.countTotalUsers() < 2) {
        const n = db.countTotalUsers();
        db.createUser(`beta_seat_${suffix}_${n}`, `Seat ${n}`, `seat${suffix}_${n}@example.com`, 'UTC', 'test-password-only');
      }
      betaMode.invalidateBetaFullCache();

      const res = await request(app).post('/api/v1/auth/register').send({
        username: `capped_${suffix}`,
        password: 'test-password-only',
        email: `capped${suffix}@example.com`,
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('BETA_FULL');
    });
  });
});
