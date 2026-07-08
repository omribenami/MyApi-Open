/**
 * Per-agent usage limits + service resource sub-scopes.
 *
 *   1. Total call limits block requests with 429 once exhausted
 *   2. Per-service call limits count only that service's traffic
 *   3. Limits CRUD via POST/PUT /tokens and GET /tokens/:id/usage
 *   4. Resource sub-scopes (allowed_resources.service_resources) deny
 *      out-of-list resources and fail closed on indeterminate requests
 *   5. Extractor unit coverage (Monday GraphQL, Slack, Discord, GitHub)
 */

const request = require('supertest');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = require('../server');
const db = require('../database');
const DeviceFingerprint = require('../utils/deviceFingerprint');
const { createUser, createApprovedDevice } = db;
const agentLimits = require('../lib/agent-limits');
const { extractResourceRefs, enforceServiceResources } = require('../lib/service-resource-scopes');

const TEST_UA = 'jest-agent-limits/1.0';
const TEST_IP = '127.0.0.1';

function withTestHeaders(req) {
  return req
    .set('User-Agent', TEST_UA)
    .set('X-Forwarded-For', TEST_IP)
    .set('Accept-Language', 'en-US');
}

function expectedFingerprintHash() {
  return DeviceFingerprint.fromRequest({
    headers: {
      'user-agent': TEST_UA,
      'accept-language': 'en-US',
      'x-forwarded-for': TEST_IP,
    },
    hostname: '127.0.0.1',
    socket: { remoteAddress: TEST_IP },
  }).fingerprintHash;
}

function seedTestUser() {
  const suffix = crypto.randomBytes(4).toString('hex');
  const user = createUser(
    'agentlim_' + suffix,
    'Agent Limits Tester',
    `agentlim+${suffix}@example.com`,
    'UTC',
    'Password123!'
  );
  return user.id;
}

function insertToken({ ownerId, scopeValue, tokenType = 'guest', label = 'test', allowedResources = null }) {
  const raw = 'myapi_test_' + crypto.randomBytes(32).toString('hex');
  const hash = bcrypt.hashSync(raw, 10);
  const id = 'tok_' + crypto.randomBytes(8).toString('hex');
  db.db.prepare(`
    INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval, allowed_resources)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id, hash, ownerId, scopeValue, label, new Date().toISOString(), tokenType,
    allowedResources ? JSON.stringify(allowedResources) : null
  );
  return { id, raw };
}

describe('Per-agent usage limits', () => {
  let userId;
  let masterToken;

  beforeAll(() => {
    userId = seedTestUser();
    masterToken = insertToken({ ownerId: userId, scopeValue: 'full', tokenType: 'master', label: 'Agent Limits Master' });
    createApprovedDevice(masterToken.id, userId, expectedFingerprintHash(), 'Test Master Device', { os: 'Linux', browser: 'jest' }, TEST_IP);
  });

  test('total call limit returns 429 once exhausted', async () => {
    const limited = insertToken({ ownerId: userId, scopeValue: JSON.stringify(['services:gmail:read']), label: 'Two Calls Only' });
    agentLimits.setAgentLimits(limited.id, { period: 'month', maxCalls: 2 });

    for (let i = 0; i < 2; i++) {
      const res = await withTestHeaders(request(app).get('/api/v1/tokens/me/capabilities'))
        .set('Authorization', `Bearer ${limited.raw}`);
      expect(res.status).toBe(200);
    }
    const blocked = await withTestHeaders(request(app).get('/api/v1/tokens/me/capabilities'))
      .set('Authorization', `Bearer ${limited.raw}`);
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('AGENT_LIMIT_EXCEEDED');
    expect(blocked.body.metric).toBe('calls');
    expect(blocked.body.scope).toBe('total');

    // Blocked requests must not inflate the counters.
    const usage = agentLimits.getAgentUsage(limited.id, 'month');
    expect(usage.calls).toBe(2);
  });

  test('per-service call limit only gates that service', async () => {
    const svcLimited = insertToken({ ownerId: userId, scopeValue: JSON.stringify(['services:gmail:read']), label: 'Gmail One Call' });
    agentLimits.setAgentLimits(svcLimited.id, { period: 'month', perService: { gmail: { maxCalls: 1 } } });

    const first = await withTestHeaders(request(app).get('/api/v1/services/gmail/preferences'))
      .set('Authorization', `Bearer ${svcLimited.raw}`);
    expect([200, 404]).toContain(first.status); // counted regardless of outcome

    const second = await withTestHeaders(request(app).get('/api/v1/services/gmail/preferences'))
      .set('Authorization', `Bearer ${svcLimited.raw}`);
    expect(second.status).toBe(429);
    expect(second.body.scope).toBe('gmail');

    // Non-service endpoints are still fine — only gmail is capped.
    const other = await withTestHeaders(request(app).get('/api/v1/tokens/me/capabilities'))
      .set('Authorization', `Bearer ${svcLimited.raw}`);
    expect(other.status).toBe(200);
  });

  test('token budget blocks proxy calls once exhausted', async () => {
    const tokLimited = insertToken({ ownerId: userId, scopeValue: JSON.stringify(['services:slack:write']), label: 'Token Budget' });
    agentLimits.setAgentLimits(tokLimited.id, { period: 'day', maxTokens: 10 });
    agentLimits.recordAgentUsage(tokLimited.id, { service: 'slack', calls: 1, tokens: 11 });

    const res = await withTestHeaders(request(app).post('/api/v1/services/slack/proxy'))
      .set('Authorization', `Bearer ${tokLimited.raw}`)
      .send({ path: '/chat.postMessage', method: 'POST', body: { channel: 'C0AAA', text: 'hi' } });
    expect(res.status).toBe(429);
    expect(res.body.metric).toBe('tokens');
  });

  test('limits CRUD through the tokens API', async () => {
    // Invalid limits are rejected before creation.
    const bad = await withTestHeaders(request(app).post('/api/v1/tokens'))
      .set('Authorization', `Bearer ${masterToken.raw}`)
      .send({ label: 'Bad', scopes: ['services:gmail:read'], limits: { period: 'week' } });
    expect(bad.status).toBe(400);

    const created = await withTestHeaders(request(app).post('/api/v1/tokens'))
      .set('Authorization', `Bearer ${masterToken.raw}`)
      .send({
        label: 'Limited Agent',
        scopes: ['services:gmail:read'],
        limits: { period: 'day', maxCalls: 100, maxTokens: 5000, perService: { gmail: { maxCalls: 10 } } },
      });
    expect(created.status).toBe(201);
    expect(created.body.data.limits).toEqual({
      period: 'day', maxCalls: 100, maxTokens: 5000, perService: { gmail: { maxCalls: 10 } },
    });
    const tokenId = created.body.data.id;

    const detail = await withTestHeaders(request(app).get(`/api/v1/tokens/${tokenId}`))
      .set('Authorization', `Bearer ${masterToken.raw}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.limits.maxCalls).toBe(100);

    const usage = await withTestHeaders(request(app).get(`/api/v1/tokens/${tokenId}/usage`))
      .set('Authorization', `Bearer ${masterToken.raw}`);
    expect(usage.status).toBe(200);
    expect(usage.body.data.period).toBe('day');
    expect(usage.body.data.usage.calls).toBe(0);

    // PUT with limits: null clears them.
    const cleared = await withTestHeaders(request(app).put(`/api/v1/tokens/${tokenId}`))
      .set('Authorization', `Bearer ${masterToken.raw}`)
      .send({ limits: null });
    expect(cleared.status).toBe(200);
    expect(agentLimits.getAgentLimits(tokenId)).toBeNull();
  });
});

describe('Service resource sub-scopes', () => {
  let userId;

  beforeAll(() => {
    userId = seedTestUser();
  });

  function slackScopedToken(channels) {
    return insertToken({
      ownerId: userId,
      scopeValue: JSON.stringify(['services:slack:write']),
      label: 'Slack Narrow',
      allowedResources: { service_resources: { slack: { channels } } },
    });
  }

  test('proxy denies a channel outside the allow-list', async () => {
    const tok = slackScopedToken(['C0ALLOWED']);
    const res = await withTestHeaders(request(app).post('/api/v1/services/slack/proxy'))
      .set('Authorization', `Bearer ${tok.raw}`)
      .send({ path: '/chat.postMessage', method: 'POST', body: { channel: 'C0FORBIDDEN', text: 'nope' } });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('resource_restricted');
    expect(res.body.kind).toBe('channels');
  });

  test('proxy fails closed when the channel cannot be determined', async () => {
    const tok = slackScopedToken(['C0ALLOWED']);
    const res = await withTestHeaders(request(app).post('/api/v1/services/slack/proxy'))
      .set('Authorization', `Bearer ${tok.raw}`)
      .send({ path: '/chat.postMessage', method: 'POST', body: { text: 'no channel specified' } });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('resource_restricted');
  });

  test('proxy lets an allowed channel through the restriction gate', async () => {
    const tok = slackScopedToken(['C0ALLOWED']);
    const res = await withTestHeaders(request(app).post('/api/v1/services/slack/proxy'))
      .set('Authorization', `Bearer ${tok.raw}`)
      .send({ path: '/chat.postMessage', method: 'POST', body: { channel: 'C0ALLOWED', text: 'hi' } });
    // Passes the restriction; fails later only because slack isn't connected in tests.
    expect(res.status).not.toBe(429);
    expect(res.body.error).not.toBe('resource_restricted');
  });

  test('Monday GraphQL extractor finds board ids and flags indeterminate queries', () => {
    const withIds = extractResourceRefs('monday', {
      apiPath: '/v2', method: 'POST',
      body: { query: 'query { boards (ids: [1234567890, 987654321]) { id name } }' },
    });
    expect(withIds.refs).toEqual(expect.arrayContaining([
      { kind: 'boards', id: '1234567890' },
      { kind: 'boards', id: '987654321' },
    ]));
    expect(withIds.indeterminate.size).toBe(0);

    const mutation = extractResourceRefs('monday', {
      apiPath: '/v2', method: 'POST',
      body: { query: 'mutation { create_item (board_id: 555500001, item_name: "x") { id } }' },
    });
    expect(mutation.refs).toEqual([{ kind: 'boards', id: '555500001' }]);

    const noIds = extractResourceRefs('monday', {
      apiPath: '/v2', method: 'POST',
      body: { query: 'query { boards (limit: 10) { id name } }' },
    });
    expect(noIds.indeterminate.has('boards')).toBe(true);
  });

  test('enforceServiceResources semantics', () => {
    const restrictions = { boards: ['1234567890'] };
    const allowed = enforceServiceResources(restrictions, 'monday', {
      apiPath: '/v2', body: { query: 'query { boards (ids: [1234567890]) { id } }' },
    });
    expect(allowed.allowed).toBe(true);

    const denied = enforceServiceResources(restrictions, 'monday', {
      apiPath: '/v2', body: { query: 'query { boards (ids: [999999999]) { id } }' },
    });
    expect(denied.allowed).toBe(false);

    // Request that doesn't touch boards at all is unaffected.
    const unrelated = enforceServiceResources(restrictions, 'monday', {
      apiPath: '/v2', body: { query: 'query { me { name } }' },
    });
    expect(unrelated.allowed).toBe(true);
  });

  test('generic registry covers calendar, jira, dropbox, telegram semantics', () => {
    // Google Calendar: id in path or query
    const cal = extractResourceRefs('googlecalendar', { apiPath: '/calendars/team%40group.calendar.google.com/events', body: {} });
    expect(cal.refs).toEqual([{ kind: 'calendars', id: 'team@group.calendar.google.com' }]);

    // Jira: issue key carries its project prefix
    const jira = extractResourceRefs('jira', { apiPath: '/rest/api/3/issue/OPS-142', body: {} });
    expect(jira.refs).toEqual([{ kind: 'projects', id: 'OPS' }]);
    const jiraCreate = extractResourceRefs('jira', { apiPath: '/rest/api/3/issue', body: { fields: { project: { key: 'OPS' } } } });
    expect(jiraCreate.refs).toEqual([{ kind: 'projects', id: 'OPS' }]);

    // Dropbox: folder restriction is a path PREFIX match
    const inside = enforceServiceResources({ folders: ['/Team/Reports'] }, 'dropbox', {
      apiPath: '/2/files/upload', body: { path: '/Team/Reports/2026/q2.pdf' },
    });
    expect(inside.allowed).toBe(true);
    const outside = enforceServiceResources({ folders: ['/Team/Reports'] }, 'dropbox', {
      apiPath: '/2/files/upload', body: { path: '/Private/secrets.txt' },
    });
    expect(outside.allowed).toBe(false);

    // Telegram: sendMessage without chat_id fails closed under a chats restriction
    const tg = enforceServiceResources({ chats: ['12345678'] }, 'telegram', {
      apiPath: '/sendMessage', body: { text: 'hi' },
    });
    expect(tg.allowed).toBe(false);
    const tgOk = enforceServiceResources({ chats: ['12345678'] }, 'telegram', {
      apiPath: '/sendMessage', body: { chat_id: 12345678, text: 'hi' },
    });
    expect(tgOk.allowed).toBe(true);

    // Asana: dotted body paths with arrays
    const asana = extractResourceRefs('asana', { apiPath: '/tasks', body: { data: { projects: ['120001', '120002'] } } });
    expect(asana.refs).toEqual(expect.arrayContaining([
      { kind: 'projects', id: '120001' },
      { kind: 'projects', id: '120002' },
    ]));
  });

  test('resource-capabilities endpoint lists sub-scopable services', async () => {
    const master = insertToken({ ownerId: userId, scopeValue: 'full', tokenType: 'master', label: 'Caps Master' });
    createApprovedDevice(master.id, userId, expectedFingerprintHash(), 'Caps Device', { os: 'Linux', browser: 'jest' }, TEST_IP);
    const res = await withTestHeaders(request(app).get('/api/v1/services/resource-capabilities'))
      .set('Authorization', `Bearer ${master.raw}`);
    expect(res.status).toBe(200);
    const caps = res.body.data || {};
    for (const svc of ['monday', 'slack', 'github', 'googlecalendar', 'jira', 'dropbox', 'notion', 'airtable']) {
      expect(caps[svc]).toBeDefined();
    }
    expect(caps.monday[0]).toMatchObject({ kind: 'boards', hasLister: true });
  });

  test('Discord + GitHub extractors read path resources', () => {
    const discord = extractResourceRefs('discord', { apiPath: '/channels/111222333444/messages', body: {} });
    expect(discord.refs).toEqual([{ kind: 'channels', id: '111222333444' }]);

    const github = extractResourceRefs('github', { apiPath: '/repos/acme/api/issues', body: {} });
    expect(github.refs).toEqual([{ kind: 'repos', id: 'acme/api' }]);

    const verdict = enforceServiceResources({ repos: ['acme/api'] }, 'github', { apiPath: '/repos/acme/other/issues' });
    expect(verdict.allowed).toBe(false);
  });
});
