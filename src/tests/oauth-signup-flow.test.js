const path = require('path');
const fs = require('fs');
const request = require('supertest');

jest.mock('../services/google-adapter', () => {
  return class MockGoogleAdapter {
    constructor() {
      this.clientId = 'test-google-client';
      this.clientSecret = 'test-google-secret';
      this.redirectUri = 'http://localhost:4500/api/v1/oauth/callback/google';
    }
    getAuthorizationUrl(state) {
      return `https://mock-oauth.local/auth?state=${encodeURIComponent(state)}`;
    }
    async exchangeCodeForToken() {
      return { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token', scope: 'email profile', expiresIn: 3600 };
    }
    async verifyToken() {
      return { data: global.__oauthProfile || {} };
    }
  };
});

describe('OAuth-first signup/login flow', () => {
  let app;
  let dbApi;
  const timestamp = Date.now();

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DB_PATH = path.join(__dirname, 'tmp-oauth-signup-flow.sqlite');
    process.env.GOOGLE_CLIENT_ID = 'test-google-client';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4500/api/v1/oauth/callback/google';

    if (fs.existsSync(process.env.DB_PATH)) fs.unlinkSync(process.env.DB_PATH);

    ({ app } = require('../index'));
    dbApi = require('../database');
    dbApi.initDatabase();
  });

  afterAll(() => {
    try { dbApi.db.close(); } catch (_) {}
    if (process.env.DB_PATH && fs.existsSync(process.env.DB_PATH)) fs.unlinkSync(process.env.DB_PATH);
  });

  async function startAndCallback(agent) {
    const authRes = await agent.get('/api/v1/oauth/authorize/google?mode=login&returnTo=/dashboard/').redirects(0);
    expect(authRes.status).toBe(302);
    const authUrl = authRes.headers.location;
    const state = new URL(authUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    return agent.get(`/api/v1/oauth/callback/google?code=abc123&state=${encodeURIComponent(state)}`).redirects(0);
  }

  test('a) existing OAuth user can initiate login flow', async () => {
    dbApi.createUser(`existing_user_${timestamp}`, 'Existing User', `existing_${timestamp}@example.com`, 'UTC', 'Password#123');
    global.__oauthProfile = { email: `existing_${timestamp}@example.com`, name: 'Existing User', sub: `google-existing-${timestamp}` };

    const agent = request.agent(app);
    const cbRes = await startAndCallback(agent);
    expect(cbRes.status).toBe(302);
    // OAuth callback returns confirm_login status for existing users
    expect(cbRes.headers.location).toContain('oauth_status=confirm_login');
  });

  test('b + c) new OAuth identity enters signup wizard, then completion creates account and logs in', async () => {
    global.__oauthProfile = { email: `brandnew_${timestamp}@example.com`, name: 'Brand New', sub: `google-brand-new-${timestamp}` };

    const agent = request.agent(app);
    const cbRes = await startAndCallback(agent);
    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.location).toContain('oauth_status=signup_required');

    const meBefore = await agent.get('/api/v1/auth/me');
    expect(meBefore.status).toBe(401);

    const pending = await agent.get('/api/v1/auth/oauth-signup/pending');
    expect(pending.status).toBe(200);
    expect((pending.body?.data?.email || '').toLowerCase()).toBe(`brandnew_${timestamp}@example.com`.toLowerCase());

    const completeRes = await agent
      .post('/api/v1/auth/oauth-signup/complete')
      .send({
        oauthSignupConfirm: true,
        oauthSignupNonce: pending.body?.data?.nonce,
        displayName: 'Brand New',
        username: `brandnew_${timestamp}`,
        email: `brandnew_${timestamp}@example.com`,
        timezone: 'UTC',
        userMd: 'I build APIs.',
        soulMd: 'I value clarity.',
      });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body?.ok).toBe(true);

    const meAfter = await agent.get('/api/v1/auth/me');
    expect(meAfter.status).toBe(200);
    expect((meAfter.body?.user?.email || '').toLowerCase()).toBe(`brandnew_${timestamp}@example.com`.toLowerCase());
  });

  test('d) skip USER.md and SOUL.md still completes signup', async () => {
    global.__oauthProfile = { email: `skipflow_${timestamp}@example.com`, name: 'Skip Flow', sub: `google-skip-flow-${timestamp}` };

    const agent = request.agent(app);
    const cbRes = await startAndCallback(agent);
    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.location).toContain('oauth_status=signup_required');

    const pending = await agent.get('/api/v1/auth/oauth-signup/pending');
    expect(pending.status).toBe(200);

    const completeRes = await agent
      .post('/api/v1/auth/oauth-signup/complete')
      .send({
        oauthSignupConfirm: true,
        oauthSignupNonce: pending.body?.data?.nonce,
        displayName: 'Skip Flow',
        username: 'skipflow',
        email: 'skipflow@example.com',
        timezone: 'UTC',
      });

    expect(completeRes.status).toBe(200);

    const meAfter = await agent.get('/api/v1/auth/me');
    expect(meAfter.status).toBe(200);
    expect((meAfter.body?.user?.email || '').toLowerCase()).toBe('skipflow@example.com');
  });
});
