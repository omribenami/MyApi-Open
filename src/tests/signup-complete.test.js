const express = require('express');
const request = require('supertest');

jest.mock('../database', () => ({
  getUserById: jest.fn(),
  updateUserOnboardingProfile: jest.fn(),
}));

const db = require('../database');
const authRouter = require('../routes/auth');

describe('POST /api/v1/auth/signup/complete', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.session = { user: { id: 'usr_test_1' }, isFirstLogin: true };
      next();
    });
    app.use('/api/v1/auth', authRouter);

    db.getUserById.mockReset();
    db.updateUserOnboardingProfile.mockReset();
  });

  test('returns 401 when unauthenticated', async () => {
    const unauthApp = express();
    unauthApp.use(express.json());
    unauthApp.use((req, _res, next) => {
      req.session = {};
      next();
    });
    unauthApp.use('/api/v1/auth', authRouter);

    const res = await request(unauthApp).post('/api/v1/auth/signup/complete').send({ displayName: 'Omri' });
    expect(res.status).toBe(401);
  });

  test('validates required displayName', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup/complete')
      .send({ preferredName: 'Omri' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/displayName/i);
  });

  test('marks onboarding completed and saves profile', async () => {
    db.getUserById.mockReturnValue({ id: 'usr_test_1', username: 'omri' });
    db.updateUserOnboardingProfile.mockReturnValue({ id: 'usr_test_1', onboardingCompleted: true });

    const res = await request(app)
      .post('/api/v1/auth/signup/complete')
      .send({
        displayName: 'Omri',
        preferredName: 'Omri',
        timezone: 'America/Chicago',
        bio: 'Builder',
        userMdContent: '# USER',
        soulMdContent: '# SOUL',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(db.updateUserOnboardingProfile).toHaveBeenCalledWith('usr_test_1', expect.objectContaining({
      displayName: 'Omri',
      onboardingCompleted: true,
    }));
  });
});
