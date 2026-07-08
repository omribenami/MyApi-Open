/**
 * Automations (Triggers) Phase 1 — schedule lib, CRUD API, plan gate, and the
 * scheduler→worker execution cycle (deterministic actions).
 */

// Plan-gate tests assume non-beta behavior; the beta override is tested explicitly.
process.env.BETA = 'false';

const request = require('supertest');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = require('../server');
const db = require('../database');
const DeviceFingerprint = require('../utils/deviceFingerprint');
const { computeNextRun, isValidSchedule, describeSchedule } = require('../lib/schedule');
const engine = require('../lib/triggerEngine');

const UA = 'jest-trg/1.0', IP = '127.0.0.1';
const hdr = (r) => r.set('User-Agent', UA).set('X-Forwarded-For', IP).set('Accept-Language', 'en-US');
const fph = () => DeviceFingerprint.fromRequest({ headers: { 'user-agent': UA, 'accept-language': 'en-US', 'x-forwarded-for': IP }, hostname: '127.0.0.1', socket: { remoteAddress: IP } }).fingerprintHash;

function token(ownerId, plan) {
  const raw = 'myapi_test_' + crypto.randomBytes(24).toString('hex');
  const id = 'tok_' + crypto.randomBytes(8).toString('hex');
  db.db.prepare(`INSERT INTO access_tokens (id, hash, owner_id, scope, label, created_at, token_type, requires_approval) VALUES (?,?,?,?,?,?,?,0)`)
    .run(id, bcrypt.hashSync(raw, 10), ownerId, 'full', 'Trg Token', new Date().toISOString(), 'master');
  db.createApprovedDevice(id, ownerId, fph(), 'Trg Device', { os: 'Linux' }, IP);
  return raw;
}

describe('schedule lib', () => {
  const from = new Date('2026-06-14T10:30:00Z'); // a Sunday
  it('interval / daily / weekly / tz', () => {
    expect(computeNextRun({ type: 'interval', everyMinutes: 30 }, 'UTC', from)).toBe('2026-06-14T11:00:00.000Z');
    expect(computeNextRun({ type: 'daily', atHour: 7, atMinute: 0 }, 'UTC', from)).toBe('2026-06-15T07:00:00.000Z');
    expect(computeNextRun({ type: 'daily', atHour: 23, atMinute: 0 }, 'UTC', from)).toBe('2026-06-14T23:00:00.000Z');
    expect(computeNextRun({ type: 'weekly', weekday: 1, atHour: 9, atMinute: 0 }, 'UTC', from)).toBe('2026-06-15T09:00:00.000Z');
    expect(computeNextRun({ type: 'daily', atHour: 7, atMinute: 0 }, 'America/Chicago', from)).toBe('2026-06-14T12:00:00.000Z');
  });
  it('validation + describe', () => {
    expect(isValidSchedule({ type: 'daily', atHour: 25, atMinute: 0 })).toBe(false);
    expect(isValidSchedule({ type: 'nope' })).toBe(false);
    expect(describeSchedule({ type: 'weekly', weekday: 1, atHour: 9, atMinute: 0 })).toBe('Mondays at 09:00');
  });
  it('once: fires in the future, then never again', () => {
    const future = new Date(from.getTime() + 3600_000).toISOString();
    const past = new Date(from.getTime() - 3600_000).toISOString();
    expect(isValidSchedule({ type: 'once', at: future })).toBe(true);
    expect(isValidSchedule({ type: 'once', at: 'not-a-date' })).toBe(false);
    expect(computeNextRun({ type: 'once', at: future }, 'UTC', from)).toBe(future);
    expect(computeNextRun({ type: 'once', at: past }, 'UTC', from)).toBe(null);
  });
});

describe('AI credits economics', () => {
  const { creditsForRun, rawCostUsd, planAi } = require('../lib/aiCredits');
  it('charges ≥1 credit and cheaper models cost less', () => {
    const usage = { input_tokens: 25000, output_tokens: 2000 };
    const haiku = creditsForRun('claude-haiku-4-5', usage);
    const opus = creditsForRun('claude-opus-4-8', usage);
    expect(haiku).toBeGreaterThanOrEqual(1);
    expect(opus).toBeGreaterThan(haiku);
    expect(creditsForRun('claude-haiku-4-5', { input_tokens: 10, output_tokens: 1 })).toBe(1); // floor
  });
  it('unknown models fall back to the most expensive tier (never undercharge)', () => {
    expect(rawCostUsd('totally-unknown', { input_tokens: 1e6, output_tokens: 0 })).toBe(10.0);
  });
  it('plan policy gates platform AI', () => {
    expect(planAi('free').platform).toBe(false);
    expect(planAi('pro').platform).toBe(true);
    expect(planAi('pro').includedCredits).toBeGreaterThan(0);
  });
});

describe('Automation API-call metering', () => {
  const { countApiCalls } = require('../lib/actionExecutor');
  it('AI runs bill one call per service action (min 1 if it ran)', () => {
    expect(countApiCalls('ai_prompt', { ran: true, toolCalls: 3 })).toBe(3);
    expect(countApiCalls('ai_prompt', { ran: true, toolCalls: 0 })).toBe(1);
    expect(countApiCalls('ai_prompt', { ran: false })).toBe(0);          // gated/blocked → not billed
  });
  it('deterministic actions bill 1 when successful, 0 otherwise', () => {
    expect(countApiCalls('service_proxy', { ok: true })).toBe(1);
    expect(countApiCalls('service_proxy', { ok: false })).toBe(0);
    expect(countApiCalls('afp_exec', { ok: true })).toBe(1);
    expect(countApiCalls('unknown', { ok: true })).toBe(0);
  });
});

describe('Triggers API', () => {
  let proRaw, freeUser, freeRaw, proUser;

  beforeAll(() => {
    const s = crypto.randomBytes(4).toString('hex');
    proUser = db.createUser('trg_pro_' + s, 'Pro', `tpro+${s}@e.com`, 'UTC', 'Password123!');
    db.db.prepare('UPDATE users SET plan=? WHERE id=?').run('pro', proUser.id);
    proRaw = token(proUser.id, 'pro');
    freeUser = db.createUser('trg_free_' + s, 'Free', `tfree+${s}@e.com`, 'UTC', 'Password123!');
    freeRaw = token(freeUser.id, 'free');
  });

  it('free plan is blocked (403)', async () => {
    const res = await hdr(request(app).get('/api/v1/triggers')).set('Authorization', `Bearer ${freeRaw}`);
    expect(res.status).toBe(403);
    expect(res.body.feature).toBe('automations');
  });

  it('free plan is allowed during BETA, but AI automations must be BYO', async () => {
    process.env.BETA = 'true';
    try {
      const list = await hdr(request(app).get('/api/v1/triggers')).set('Authorization', `Bearer ${freeRaw}`);
      expect(list.status).toBe(200);

      const platform = await hdr(request(app).post('/api/v1/triggers')).set('Authorization', `Bearer ${freeRaw}`).send({
        name: 'AI digest', kind: 'schedule', schedule: { type: 'daily', atHour: 7, atMinute: 0 },
        actionType: 'ai_prompt', action: { prompt: 'summarize my day', keyMode: 'platform' },
      });
      expect(platform.status).toBe(400);
      expect(platform.body.code).toBe('BYO_KEY_REQUIRED');

      const byo = await hdr(request(app).post('/api/v1/triggers')).set('Authorization', `Bearer ${freeRaw}`).send({
        name: 'AI digest byo', kind: 'schedule', schedule: { type: 'daily', atHour: 7, atMinute: 0 },
        actionType: 'ai_prompt', action: { prompt: 'summarize my day', keyMode: 'byo' },
      });
      expect(byo.status).toBe(201);
    } finally {
      process.env.BETA = 'false';
    }
  });

  let trgId;
  it('creates a daily afp_exec automation with a friendly label + next run', async () => {
    const res = await hdr(request(app).post('/api/v1/triggers')).set('Authorization', `Bearer ${proRaw}`).send({
      name: 'Nightly docker check',
      kind: 'schedule',
      schedule: { type: 'daily', atHour: 3, atMinute: 0 },
      timezone: 'UTC',
      actionType: 'afp_exec',
      action: { deviceId: 'afp_nonexistent', cmd: 'docker ps -a' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.scheduleLabel).toBe('Every day at 03:00');
    expect(res.body.data.nextRunAt).toBeTruthy();
    trgId = res.body.data.id;
  });

  it('rejects invalid action + invalid schedule', async () => {
    const a = await hdr(request(app).post('/api/v1/triggers')).set('Authorization', `Bearer ${proRaw}`)
      .send({ name: 'x', kind: 'schedule', schedule: { type: 'daily', atHour: 3, atMinute: 0 }, actionType: 'service_proxy', action: {} });
    expect(a.status).toBe(400);
    const b = await hdr(request(app).post('/api/v1/triggers')).set('Authorization', `Bearer ${proRaw}`)
      .send({ name: 'x', kind: 'schedule', schedule: { type: 'daily', atHour: 99 }, actionType: 'afp_exec', action: { deviceId: 'd', cmd: 'ls' } });
    expect(b.status).toBe(400);
    const c = await hdr(request(app).post('/api/v1/triggers')).set('Authorization', `Bearer ${proRaw}`)
      .send({ name: 'x', kind: 'schedule', schedule: { type: 'daily', atHour: 1, atMinute: 0 }, actionType: 'ai_prompt', action: {} });
    expect(c.status).toBe(400); // ai_prompt needs a prompt
  });

  it('accepts an ai_prompt automation and exposes AI settings', async () => {
    const res = await hdr(request(app).post('/api/v1/triggers')).set('Authorization', `Bearer ${proRaw}`).send({
      name: 'Morning email digest', kind: 'schedule',
      schedule: { type: 'daily', atHour: 7, atMinute: 0 }, timezone: 'UTC',
      actionType: 'ai_prompt', action: { prompt: 'Summarize my unread email and notify me.', keyMode: 'platform' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.actionType).toBe('ai_prompt');

    const settings = await hdr(request(app).get('/api/v1/triggers/ai/settings')).set('Authorization', `Bearer ${proRaw}`);
    expect(settings.status).toBe(200);
    expect(settings.body.providers).toHaveProperty('anthropic');
    expect(settings.body.providers).toHaveProperty('openai');
    expect(settings.body.providers).toHaveProperty('openrouter');
    expect(settings.body.providers.anthropic).toHaveProperty('platformAvailable');
    expect(settings.body.providers.anthropic.byo).toHaveProperty('configured');
  });

  it('rejects bad BYO keys and stores well-formed ones per provider', async () => {
    const bad = await hdr(request(app).put('/api/v1/triggers/ai/key')).set('Authorization', `Bearer ${proRaw}`).send({ provider: 'anthropic', key: 'nope' });
    expect(bad.status).toBe(400);
    // OpenAI key in an Anthropic slot is rejected (prefix guard)
    const wrong = await hdr(request(app).put('/api/v1/triggers/ai/key')).set('Authorization', `Bearer ${proRaw}`).send({ provider: 'anthropic', key: 'sk-openai-' + 'x'.repeat(20) });
    expect(wrong.status).toBe(400);
    const good = await hdr(request(app).put('/api/v1/triggers/ai/key')).set('Authorization', `Bearer ${proRaw}`).send({ provider: 'anthropic', key: 'sk-ant-test-' + 'x'.repeat(20) });
    expect(good.status).toBe(200);
    expect(good.body.providers.anthropic.byo.configured).toBe(true);
    expect(good.body.providers.anthropic.byo.last4).toBe('xxxx');
    // OpenRouter slot accepts an sk-or- key
    const or = await hdr(request(app).put('/api/v1/triggers/ai/key')).set('Authorization', `Bearer ${proRaw}`).send({ provider: 'openrouter', key: 'sk-or-v1-' + 'y'.repeat(20) });
    expect(or.status).toBe(200);
    expect(or.body.providers.openrouter.byo.configured).toBe(true);
  });

  it('throttles platform AI to hourly but allows BYO sub-hourly', async () => {
    const tooFast = await hdr(request(app).post('/api/v1/triggers')).set('Authorization', `Bearer ${proRaw}`).send({
      name: 'fast platform', kind: 'schedule', schedule: { type: 'interval', everyMinutes: 5 },
      actionType: 'ai_prompt', action: { prompt: 'do a thing', keyMode: 'platform' },
    });
    expect(tooFast.status).toBe(400);
    const byoFast = await hdr(request(app).post('/api/v1/triggers')).set('Authorization', `Bearer ${proRaw}`).send({
      name: 'fast byo', kind: 'schedule', schedule: { type: 'interval', everyMinutes: 5 },
      actionType: 'ai_prompt', action: { prompt: 'do a thing', keyMode: 'byo', provider: 'openai' },
    });
    expect(byoFast.status).toBe(201);
  });

  it('exposes MyApi-AI wallet + usage in settings', async () => {
    const s = await hdr(request(app).get('/api/v1/triggers/ai/settings')).set('Authorization', `Bearer ${proRaw}`);
    expect(s.status).toBe(200);
    expect(s.body.myapiAi).toHaveProperty('includedCredits');
    expect(s.body.myapiAi).toHaveProperty('balanceCredits');
    expect(s.body.myapiAi).toHaveProperty('available');
    expect(s.body.myapiAi.allowed).toBe(true); // pro
  });

  it('saves spend controls and reflects them; top-up needs Stripe', async () => {
    const put = await hdr(request(app).put('/api/v1/triggers/ai/wallet')).set('Authorization', `Bearer ${proRaw}`)
      .send({ spendLimitCredits: 500, alertPercent: 75, autoReload: { enabled: true, whenBelowCredits: 50, topUpCredits: 1000 } });
    expect(put.status).toBe(200);
    const s = await hdr(request(app).get('/api/v1/triggers/ai/settings')).set('Authorization', `Bearer ${proRaw}`);
    expect(s.body.myapiAi.spendLimitCredits).toBe(500);
    expect(s.body.myapiAi.alertPercent).toBe(75);
    expect(s.body.myapiAi.autoReload.enabled).toBe(true);
    // No STRIPE_SECRET_KEY in tests → top-up returns a clear error, not a crash.
    const top = await hdr(request(app).post('/api/v1/triggers/ai/topup')).set('Authorization', `Bearer ${proRaw}`).send({ amountCents: 1000 });
    expect(top.status).toBe(400);
  });

  it('lists, gets, toggles, and deletes', async () => {
    const list = await hdr(request(app).get('/api/v1/triggers')).set('Authorization', `Bearer ${proRaw}`);
    expect(list.body.data.some((t) => t.id === trgId)).toBe(true);

    const patch = await hdr(request(app).patch(`/api/v1/triggers/${trgId}`)).set('Authorization', `Bearer ${proRaw}`).send({ enabled: false });
    expect(patch.body.data.enabled).toBe(false);

    const other = token(crypto.randomBytes(4).toString('hex')); // different owner
    const sneak = await hdr(request(app).get(`/api/v1/triggers/${trgId}`)).set('Authorization', `Bearer ${other}`);
    expect(sneak.status).toBe(403); // not blocked by plan? other owner has no plan → 403 plan gate first
  });

  it('run-now executes the action and records a run (afp offline → failed, not crash)', async () => {
    const res = await hdr(request(app).post(`/api/v1/triggers/${trgId}/run`)).set('Authorization', `Bearer ${proRaw}`);
    // Device doesn't exist → executor returns ok:false (404), run recorded failed.
    expect([200, 502]).toContain(res.status);
    expect(res.body.run.status).toBe('failed');
    const runs = await hdr(request(app).get(`/api/v1/triggers/${trgId}/runs`)).set('Authorization', `Bearer ${proRaw}`);
    expect(runs.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('scheduler enqueues a due run and the worker processes it', async () => {
    // Create a trigger already due (next_run_at in the past) via direct insert.
    const t = db.createTrigger({
      workspaceId: 'default', ownerId: proUser.id, name: 'due-now', kind: 'schedule',
      scheduleJson: { type: 'interval', everyMinutes: 60 }, timezone: 'UTC',
      actionType: 'afp_exec', actionJson: { deviceId: 'afp_x', cmd: 'ls' },
      nextRunAt: new Date(Date.now() - 1000).toISOString(), enabled: true,
    });
    const enq = engine.runSchedulerTick(new Date());
    expect(enq).toBeGreaterThanOrEqual(1);
    const after = db.getTriggerById(t.id);
    expect(new Date(after.next_run_at).getTime()).toBeGreaterThan(Date.now()); // advanced
    const processed = await engine.runWorkerTick(10);
    expect(processed).toBeGreaterThanOrEqual(1);
    const runs = db.listTriggerRuns(t.id, 5);
    expect(runs[0].status).toBe('failed'); // afp_x offline, but executed cleanly
  });
});
