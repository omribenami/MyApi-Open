const path = require('path');
const fs = require('fs');
const request = require('supertest');

describe('OAuth security hardening', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DB_PATH = path.join(__dirname, 'tmp-oauth-security-hardening.sqlite');
    process.env.SESSION_DB_PATH = path.join(__dirname, 'tmp-oauth-security-hardening-sessions.sqlite');

    process.env.GOOGLE_CLIENT_ID = 'test-google-client';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4500/api/v1/oauth/callback/google';

    process.env.GITHUB_CLIENT_ID = 'test-github-client';
    process.env.GITHUB_CLIENT_SECRET = 'test-github-secret';
    process.env.GITHUB_REDIRECT_URI = 'http://localhost:4500/api/v1/oauth/callback/github';

    process.env.FACEBOOK_CLIENT_ID = 'test-facebook-client';
    process.env.FACEBOOK_CLIENT_SECRET = 'test-facebook-secret';
    process.env.FACEBOOK_REDIRECT_URI = 'http://localhost:4500/api/v1/oauth/callback/facebook';

    [process.env.DB_PATH, process.env.SESSION_DB_PATH].forEach((p) => {
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    });

    ({ app } = require('../index'));
  });

  afterAll(() => {
    [process.env.DB_PATH, process.env.SESSION_DB_PATH].forEach((p) => {
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    });
  });

  test('google login defaults to forcePrompt and includes select_account + max_age', async () => {
    const res = await request(app)
      .get('/api/v1/oauth/authorize/google?mode=login&json=1');

    expect(res.status).toBe(200);
    const authUrl = new URL(res.body.authUrl);

    expect(authUrl.searchParams.get('prompt')).toBe('select_account');
    expect(authUrl.searchParams.get('max_age')).toBe('0');
  });

  test('google login can disable forcePrompt explicitly', async () => {
    const res = await request(app)
      .get('/api/v1/oauth/authorize/google?mode=login&forcePrompt=0&json=1');

    expect(res.status).toBe(200);
    const authUrl = new URL(res.body.authUrl);

    expect(authUrl.searchParams.get('prompt')).toBeNull();
    expect(authUrl.searchParams.get('max_age')).toBeNull();
  });

  test('facebook login forcePrompt adds reauthenticate hint', async () => {
    const res = await request(app)
      .get('/api/v1/oauth/authorize/facebook?mode=login&forcePrompt=1&json=1');

    expect(res.status).toBe(200);
    const authUrl = new URL(res.body.authUrl);

    expect(authUrl.searchParams.get('auth_type')).toBe('reauthenticate');
  });

  test('github login forcePrompt adds deterministic flag-compatible auth param', async () => {
    const res = await request(app)
      .get('/api/v1/oauth/authorize/github?mode=login&forcePrompt=1&json=1');

    expect(res.status).toBe(200);
    const authUrl = new URL(res.body.authUrl);

    expect(authUrl.searchParams.get('allow_signup')).toBe('true');
  });

  test('logout clears auth cookies aggressively', async () => {
    const agent = request.agent(app);

    await agent.get('/api/v1/oauth/authorize/google?mode=login&json=1');
    const res = await agent.post('/api/v1/auth/logout');

    expect(res.status).toBe(200);
    const setCookies = res.headers['set-cookie'] || [];

    expect(setCookies.some((c) => c.startsWith('myapi.sid='))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('myapi_user='))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('myapi_master_token='))).toBe(true);
  });
});
