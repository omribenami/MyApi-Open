const express = require('express');
const request = require('supertest');

jest.mock('../database', () => ({
  createServicePreference: jest.fn(),
  getServicePreference: jest.fn(),
  getServicePreferences: jest.fn(() => []),
  updateServicePreference: jest.fn(() => ({})),
  deleteServicePreference: jest.fn(() => true),
  createAuditLog: jest.fn(),
  getOAuthToken: jest.fn(() => null),
}));

jest.mock('../services/emailService', () => ({
  getConfigStatus: jest.fn(() => ({ configured: false, missing: ['SMTP_HOST'], authType: 'smtp' })),
}));

const createServicesRoutes = require('../routes/services');

describe('services route email status semantics', () => {
  test('email service uses non-oauth config readiness status', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.tokenMeta = { ownerId: 'owner', scope: 'full' };
      next();
    });
    app.use('/api/v1/services', createServicesRoutes());

    const res = await request(app).get('/api/v1/services');
    expect(res.status).toBe(200);

    const emailService = (res.body.data || []).find((s) => s.id === 'email');
    expect(emailService).toBeDefined();
    expect(emailService.auth_type).toBe('smtp');
    expect(emailService.status).toBe('error');
    expect(emailService.connectedAt).toBeNull();
    expect(emailService.configMissing).toContain('SMTP_HOST');
  });
});
