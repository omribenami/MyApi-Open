const express = require('express');
const request = require('supertest');

jest.mock('../database', () => ({
  getEmailQueueStats: jest.fn(() => ({ pending: 1, sent: 2, failed: 0, total: 3, lastFailure: null })),
  getRecentEmailJobs: jest.fn(() => []),
}));

jest.mock('../services/emailService', () => ({
  testConnection: jest.fn(async () => ({ success: true, config: { configured: true, missing: [] } })),
  processPendingEmails: jest.fn(async () => ({ sent: 1, failed: 0 })),
  sendTestEmail: jest.fn(async (to) => ({ success: true, to, messageId: 'msg_1' })),
  getConfigStatus: jest.fn(() => ({ provider: 'smtp', configured: true, missing: [], authType: 'smtp' })),
}));

const emailRoutes = require('../routes/email');

function createApp(scope = 'full') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tokenMeta = { scope, ownerId: 'owner' };
    next();
  });
  app.use('/api/v1/email', emailRoutes);
  return app;
}

describe('email routes (outbound only)', () => {
  test('GET /api/v1/email/status returns queue and provider metadata for admin', async () => {
    const app = createApp('full');
    const res = await request(app).get('/api/v1/email/status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.outboundOnly).toBe(true);
    expect(res.body.queue).toBeDefined();
    expect(res.body.provider).toBeDefined();
  });

  test('POST /api/v1/email/send-test validates recipient email', async () => {
    const app = createApp('full');
    const res = await request(app)
      .post('/api/v1/email/send-test')
      .send({ to: 'invalid-email' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Valid "to" email address/i);
  });

  test('GET /api/v1/email/jobs requires admin', async () => {
    const app = createApp('read:services');
    const res = await request(app).get('/api/v1/email/jobs');

    expect(res.status).toBe(403);
  });
});
