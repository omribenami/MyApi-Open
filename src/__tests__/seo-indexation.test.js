const request = require('supertest');
const app = require('../server');

describe('SEO indexation safeguards', () => {
  test('homepage stays canonical HTML for generic clients', async () => {
    const res = await request(app)
      .get('/')
      .set('User-Agent', 'python-requests/2.32.0')
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<!doctype html>');
    expect(res.text).toContain('<title>MyApi');
  });

  test('discovery endpoints remain reachable but marked non-indexable', async () => {
    const discovery = await request(app).get('/api/v1/');
    const openapi = await request(app).get('/openapi.json');
    const llms = await request(app).get('/llms.txt');

    for (const res of [discovery, openapi, llms]) {
      expect(res.status).toBe(200);
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    }
  });

  test('sitemap advertises only canonical HTML pages', async () => {
    const res = await request(app).get('/sitemap.xml');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);

    expect(res.text).toMatch(/<loc>https:\/\/127\.0\.0\.1(?::\d+)?\/privacy<\/loc>/);
    expect(res.text).toMatch(/<loc>https:\/\/127\.0\.0\.1(?::\d+)?\/terms<\/loc>/);
    expect(res.text).toMatch(/<loc>https:\/\/127\.0\.0\.1(?::\d+)?\/chatgpt-privacy<\/loc>/);
    expect(res.text).not.toContain('/openapi.json');
    expect(res.text).not.toContain('/api/v1/');
    expect(res.text).not.toContain('/.well-known/ai-plugin.json');
    expect(res.text).not.toContain('/.well-known/openapi.json');
    expect(res.text).not.toContain('/llms.txt');
  });
});
