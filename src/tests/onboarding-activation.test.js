const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');
const request = require('supertest');

const tmpFile = path.join(os.tmpdir(), `onboarding-activation-${process.pid}.json`);
process.env.ONBOARDING_ACTIVATION_PATH = tmpFile;
process.env.POWER_USER_EMAIL = 'owner@example.com';

jest.mock('../database', () => ({
  clearUserOnboarding: jest.fn(),
  getUserById: jest.fn((id) => {
    if (id === 'usr_owner') return { id, email: 'owner@example.com' };
    return { id, email: 'user@example.com' };
  }),
  updateUserOAuthProfile: jest.fn(),
  createVaultToken: jest.fn(() => ({ id: 'vt_test' })),
  initDatabase: jest.fn(),
}));

const router = require('../onboard');

function makeApp(userId) {
  const app = express();
  app.use((req, _res, next) => {
    if (userId) req.session = { user: { id: userId } };
    next();
  });
  app.use('/api/v1', router);
  return app;
}

describe('activation onboarding events', () => {
  afterEach(() => {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (_) {}
  });

  test('rejects unauthenticated event posts', async () => {
    const res = await request(makeApp(null))
      .post('/api/v1/onboarding/event')
      .send({ event: 'ai_selected', primaryAi: 'grok' });
    expect(res.status).toBe(401);
  });

  test('rejects unknown events', async () => {
    const res = await request(makeApp('usr_owner'))
      .post('/api/v1/onboarding/event')
      .send({ event: 'not_a_real_event' });
    expect(res.status).toBe(400);
  });

  test('records AI preference and returns owner stats', async () => {
    const agent = request(makeApp('usr_owner'));
    const posted = await agent
      .post('/api/v1/onboarding/event')
      .send({ event: 'ai_selected', primaryAi: 'claude-code', extraAis: ['grok'], services: ['github'] });
    expect(posted.status).toBe(200);
    expect(posted.body.ok).toBe(true);

    await agent.post('/api/v1/onboarding/event').send({ event: 'service_connected', services: ['github'] });
    await agent.post('/api/v1/onboarding/event').send({ event: 'agent_connected', primaryAi: 'claude-code' });
    await agent.post('/api/v1/onboarding/event').send({ event: 'activation_complete', primaryAi: 'claude-code' });

    const stats = await agent.get('/api/v1/onboarding/activation-stats');
    expect(stats.status).toBe(200);
    expect(stats.body.aiCounts['claude-code']).toBe(1);
    expect(stats.body.eventCounts.activation_complete).toBe(1);
    expect(stats.body.totals.uniqueUsers).toBe(1);
    expect(stats.body.serviceCounts.github).toBeGreaterThan(0);
  });

  test('hides stats from non-owners', async () => {
    const res = await request(makeApp('usr_other')).get('/api/v1/onboarding/activation-stats');
    expect(res.status).toBe(403);
  });
});
