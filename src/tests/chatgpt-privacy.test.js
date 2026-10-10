/**
 * Self-hosted privacy URL behavior.
 * PRIVACY_URL, when set, is the only redirect target for /chatgpt-privacy
 * and the plugin manifest legal_info_url. Unset, the instance stays on its
 * own host and never sends visitors to the hosted MyApi policy.
 */

const request = require('supertest');
const app = require('../server');

const OPERATOR_NOTICE = 'This MyApi instance is operated by its owner. Ask the operator for their privacy policy.';

describe('self-hosted privacy URL', () => {
  const original = process.env.PRIVACY_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.PRIVACY_URL;
    else process.env.PRIVACY_URL = original;
  });

  it('GET /chatgpt-privacy explains that the operator owns the policy when PRIVACY_URL is unset', async () => {
    delete process.env.PRIVACY_URL;
    const res = await request(app).get('/chatgpt-privacy');
    expect(res.status).toBe(200);
    expect(res.headers.location).toBeUndefined();
    expect(res.text).toContain(OPERATOR_NOTICE);
    expect(res.text).not.toMatch(/myapiai\.com/i);
  });

  it('GET /chatgpt-privacy redirects only to PRIVACY_URL when that env var is set', async () => {
    process.env.PRIVACY_URL = 'https://operator.example/privacy';
    const res = await request(app).get('/chatgpt-privacy');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://operator.example/privacy');
  });

  it('plugin legal_info_url stays on this host when PRIVACY_URL is unset', async () => {
    delete process.env.PRIVACY_URL;
    const res = await request(app)
      .get('/.well-known/ai-plugin.json')
      .set('Host', 'selfhost.example')
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    expect(res.body.legal_info_url).toBe('https://selfhost.example/legal');
  });

  it('plugin legal_info_url uses PRIVACY_URL when set', async () => {
    process.env.PRIVACY_URL = 'https://operator.example/privacy';
    const res = await request(app)
      .get('/.well-known/ai-plugin.json')
      .set('Host', 'selfhost.example');
    expect(res.status).toBe(200);
    expect(res.body.legal_info_url).toBe('https://operator.example/privacy');
  });
});
