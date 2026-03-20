const request = require('supertest');
const express = require('express');

jest.mock('../database', () => ({
  getUserById: jest.fn(),
  getAccessTokens: jest.fn(),
  getPersonas: jest.fn(),
  getKBDocuments: jest.fn(),
}));

const fs = require('fs');
const db = require('../database');
const exportRoutes = require('../routes/export');

function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.userId = 'usr_test';
    next();
  });
  app.use('/api/v1/export', exportRoutes);
  return app;
}

describe('Export route v2', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    db.getUserById.mockReturnValue({
      id: 'usr_test',
      username: 'test',
      email: 'test@example.com',
      displayName: 'Test User',
      avatarUrl: null,
      createdAt: '2026-03-20T00:00:00.000Z',
      lastLogin: null,
      two_factor_enabled: 0,
    });

    db.getAccessTokens.mockReturnValue([
      {
        tokenId: 'tok_regular_1234567890',
        ownerId: 'usr_test',
        scope: 'identity:read',
        label: 'Main API Token',
        createdAt: '2026-03-01T00:00:00.000Z',
        revokedAt: null,
        expiresAt: null,
        active: true,
        allowedPersonas: null,
      },
      {
        tokenId: 'tok_oauth_session_abcdef',
        ownerId: 'usr_test',
        scope: 'identity:read',
        label: 'OAuth Session Token',
        createdAt: '2026-03-02T00:00:00.000Z',
        revokedAt: null,
        expiresAt: null,
        active: true,
        allowedPersonas: null,
      },
      {
        tokenId: 'tok_dashboard_session_xyz',
        ownerId: 'usr_test',
        scope: 'identity:read',
        label: 'Dashboard Session',
        createdAt: '2026-03-03T00:00:00.000Z',
        revokedAt: '2026-03-04T00:00:00.000Z',
        expiresAt: null,
        active: false,
        allowedPersonas: null,
      },
    ]);

    db.getPersonas.mockReturnValue([]);
    db.getKBDocuments.mockReturnValue([]);

    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults to portable mode and filters ephemeral token labels', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/export?tokens=true&profile=false&personas=false&knowledge=false&settings=false');

    expect(res.status).toBe(200);
    expect(res.body.manifest.exportMode).toBe('portable');
    expect(res.body.manifest.schemaVersion).toBe('2.0');

    expect(res.body.sections.tokens.summary).toEqual({
      totalTokens: 3,
      activeTokens: 2,
      ephemeralFiltered: 2,
      exportedTokens: 1,
    });

    expect(res.body.sections.tokens.tokens).toHaveLength(1);
    expect(res.body.sections.tokens.tokens[0].label).toBe('Main API Token');
    expect(res.body.sections.tokens.tokens[0].tokenId).not.toBe('tok_regular_1234567890');
    expect(res.body.sections.tokens.tokens[0].tokenId).toMatch(/^tok_re\*\*\*/);
  });

  it('forensic mode includes full token ids and internal refs', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/export?mode=forensic&tokens=true&profile=false&personas=false&knowledge=false&settings=false');

    expect(res.status).toBe(200);
    expect(res.body.manifest.exportMode).toBe('forensic');
    expect(res.body.sections.tokens.summary.ephemeralFiltered).toBe(0);
    expect(res.body.sections.tokens.tokens).toHaveLength(3);

    const token = res.body.sections.tokens.tokens[0];
    expect(token.tokenId).toBeTruthy();
    expect(token.ownerId).toBe('usr_test');
    expect(Object.prototype.hasOwnProperty.call(token, 'revokedAt')).toBe(true);
  });

  it('includes manifest safety metadata and checksums', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/export?tokens=true&profile=true&personas=false&knowledge=false&settings=false');

    expect(res.status).toBe(200);
    expect(res.body.exportVersion).toBe('2.0');
    expect(res.body.manifest.generatedBy).toBe('myapi.export.v2');
    expect(res.body.manifest.importSupported).toBe(false);
    expect(res.body.manifest.importRationale).toContain('unsupported');
    expect(res.body.manifest.checksums.profile).toHaveLength(64);
    expect(res.body.manifest.checksums.tokens).toHaveLength(64);
  });
});
