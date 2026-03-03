#!/usr/bin/env node

const assert = require('assert');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4789';

async function api(path, opts = {}) {
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { status: res.status, body };
}

(async () => {
  console.log('\n=== Project Phase 12A Discovery + KB Tests ===\n');

  const username = `phase12a_${Date.now()}`;
  const registerRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'phase12a-password', email: `${username}@example.com` }),
  });

  assert.strictEqual(registerRes.status, 200, 'register should return 200');
  const sessionCookie = registerRes.headers.get('set-cookie');
  assert(sessionCookie, 'register should return session cookie');

  const authHeaders = { Cookie: sessionCookie };

  const caps = await api('/api/v1/capabilities', { headers: authHeaders });
  assert.strictEqual(caps.status, 200, 'capabilities should return 200');
  assert(Array.isArray(caps.body.endpoints), 'capabilities should include endpoints array');

  const openapi = await api('/openapi.json');
  assert.strictEqual(openapi.status, 200, 'openapi should return 200');
  assert(openapi.body.paths && openapi.body.paths['/api/v1/capabilities'], 'openapi should document capabilities');

  const discovery = await api('/api/v1/vault/discover-api', {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'github.com' }),
  });
  assert.strictEqual(discovery.status, 200, 'discover-api should accept url alias');

  const fd = new FormData();
  fd.append('kbFile', new Blob(['Phase 12A local test document content.'], { type: 'text/plain' }), 'phase12a-test.txt');

  const upload = await fetch(`${BASE_URL}/api/v1/brain/knowledge-base/upload`, {
    method: 'POST',
    headers: authHeaders,
    body: fd,
  });
  const uploadBody = await upload.json();
  assert.strictEqual(upload.status, 201, 'kb upload should return 201');
  const docId = uploadBody.documents?.[0]?.id;
  assert(docId, 'kb upload should return document id');

  const personaCreate = await api('/api/v1/personas', {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Phase12A Persona ${Date.now()}`, soul_content: '# Persona\n- **Tone**: concise' }),
  });
  assert.strictEqual(personaCreate.status, 201, 'persona create should return 201');

  const personaId = personaCreate.body.data.id;
  const attach = await api(`/api/v1/personas/${personaId}/documents`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: docId }),
  });
  assert.strictEqual(attach.status, 200, 'persona document attach should return 200');

  const context = await api(`/api/v1/brain/context?personaId=${encodeURIComponent(personaId)}`, {
    method: 'GET',
    headers: authHeaders,
  });
  assert.strictEqual(context.status, 200, 'brain context should return 200');
  const docs = context.body?.personaContext?.documents || [];
  assert(docs.some((d) => d.id === docId), 'persona context should include attached uploaded doc');

  console.log('Passed: 5');
  console.log('Failed: 0');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  console.log('Passed: 0');
  console.log('Failed: 1');
  process.exit(1);
});
