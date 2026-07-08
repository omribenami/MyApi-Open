'use strict';

/**
 * Per-agent usage limits.
 *
 * An "agent" is whatever identity the auth layer resolves into
 * req.tokenMeta.tokenId — an access token id (Bearer) or an ASC key
 * fingerprint. Limits are owner-configured quotas on how much API traffic an
 * agent may generate:
 *
 *   {
 *     "period": "day" | "month",          // rolling window, default "month" (calendar)
 *     "maxCalls": 1000,                    // total API calls across everything
 *     "maxTokens": 500000,                 // total tokens across all services
 *     "perService": {
 *       "gmail":  { "maxCalls": 200, "maxTokens": 50000 },
 *       "monday": { "maxCalls": 50 }
 *     }
 *   }
 *
 * "Tokens" are LLM-context tokens the agent pulls through the gateway,
 * estimated from request+response payload size (~4 chars/token) — the metric
 * that matters for budgeting what an AI agent can ingest/emit per service.
 *
 * Usage is accumulated in agent_usage_counters per UTC day per service, so a
 * daily window reads one day and a monthly window sums the calendar month.
 * Enforcement fails OPEN on DB errors (a broken quota table must not take the
 * whole gateway down) but a configured, readable limit is enforced strictly.
 */

const { db } = require('../database');

const VALID_PERIODS = new Set(['day', 'month']);
const MAX_LIMIT_VALUE = 1e12;

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// First day of the current window (inclusive, YYYY-MM-DD).
function periodStartDay(period) {
  const now = new Date();
  if (period === 'day') return utcDay(now);
  return now.toISOString().slice(0, 8) + '01'; // calendar month
}

function toPositiveIntOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), MAX_LIMIT_VALUE);
}

/**
 * Validate + canonicalize a limits object from user input.
 * Returns null when the input contains no effective limit (treat as "no limits").
 * Throws Error with a user-facing message on malformed input.
 */
function normalizeLimits(input) {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('limits must be an object');
  }
  const out = {};
  const period = input.period === undefined || input.period === null ? 'month' : String(input.period);
  if (!VALID_PERIODS.has(period)) {
    throw new Error("limits.period must be 'day' or 'month'");
  }
  out.period = period;

  const maxCalls = toPositiveIntOrNull(input.maxCalls);
  const maxTokens = toPositiveIntOrNull(input.maxTokens);
  if (maxCalls) out.maxCalls = maxCalls;
  if (maxTokens) out.maxTokens = maxTokens;

  if (input.perService !== undefined && input.perService !== null) {
    if (typeof input.perService !== 'object' || Array.isArray(input.perService)) {
      throw new Error('limits.perService must be an object keyed by service name');
    }
    const perService = {};
    for (const [service, cfg] of Object.entries(input.perService)) {
      if (!/^[a-z0-9_-]+$/i.test(service)) {
        throw new Error(`limits.perService: invalid service name '${service}'`);
      }
      if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
        throw new Error(`limits.perService.${service} must be an object`);
      }
      const svc = {};
      const svcCalls = toPositiveIntOrNull(cfg.maxCalls);
      const svcTokens = toPositiveIntOrNull(cfg.maxTokens);
      if (svcCalls) svc.maxCalls = svcCalls;
      if (svcTokens) svc.maxTokens = svcTokens;
      if (Object.keys(svc).length > 0) perService[service.toLowerCase()] = svc;
    }
    if (Object.keys(perService).length > 0) out.perService = perService;
  }

  const hasAnyLimit = out.maxCalls || out.maxTokens || out.perService;
  return hasAnyLimit ? out : null;
}

function getAgentLimits(agentId) {
  if (!agentId) return null;
  try {
    const row = db.prepare('SELECT limits FROM agent_limits WHERE agent_id = ?').get(String(agentId));
    if (!row?.limits) return null;
    const parsed = JSON.parse(row.limits);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    console.error('[AgentLimits] read failed:', e.message);
    return null;
  }
}

// Pass limits=null to clear. Input is normalized (throws on malformed input).
function setAgentLimits(agentId, limits) {
  const normalized = normalizeLimits(limits);
  if (!normalized) {
    db.prepare('DELETE FROM agent_limits WHERE agent_id = ?').run(String(agentId));
    return null;
  }
  db.prepare(`
    INSERT INTO agent_limits (agent_id, limits, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET limits = excluded.limits, updated_at = excluded.updated_at
  `).run(String(agentId), JSON.stringify(normalized), new Date().toISOString());
  return normalized;
}

/**
 * Usage within the current window of `period`.
 * Returns { calls, tokens, perService: { name: { calls, tokens } } }.
 */
function getAgentUsage(agentId, period = 'month') {
  const start = periodStartDay(VALID_PERIODS.has(period) ? period : 'month');
  const usage = { calls: 0, tokens: 0, perService: {} };
  try {
    const rows = db.prepare(`
      SELECT service, SUM(calls) AS calls, SUM(tokens_used) AS tokens
      FROM agent_usage_counters
      WHERE agent_id = ? AND day >= ?
      GROUP BY service
    `).all(String(agentId), start);
    for (const row of rows) {
      const calls = Number(row.calls || 0);
      const tokens = Number(row.tokens || 0);
      usage.calls += calls;
      usage.tokens += tokens;
      if (row.service) usage.perService[row.service] = { calls, tokens };
    }
  } catch (e) {
    console.error('[AgentLimits] usage read failed:', e.message);
  }
  return usage;
}

/**
 * Check whether one more request (optionally against `service`, optionally
 * consuming `tokens` more context tokens) fits within the agent's limits.
 * Returns { allowed: true } or
 * { allowed: false, reason, metric: 'calls'|'tokens', scope: 'total'|service, limit, used, period }.
 */
function checkAgentLimits(agentId, service = null, { tokens = 0, enforceTokens = true } = {}) {
  const limits = getAgentLimits(agentId);
  if (!limits) return { allowed: true };
  const period = VALID_PERIODS.has(limits.period) ? limits.period : 'month';
  const usage = getAgentUsage(agentId, period);

  const deny = (metric, scope, limit, used) => ({
    allowed: false,
    metric, scope, limit, used, period,
    reason: `Agent ${metric} limit reached for ${scope === 'total' ? 'this agent' : `service '${scope}'`}: ${used}/${limit} per ${period}`,
  });

  if (limits.maxCalls && usage.calls + 1 > limits.maxCalls) {
    return deny('calls', 'total', limits.maxCalls, usage.calls);
  }
  if (enforceTokens && limits.maxTokens && usage.tokens + tokens > limits.maxTokens) {
    return deny('tokens', 'total', limits.maxTokens, usage.tokens);
  }
  if (service && limits.perService) {
    const svc = limits.perService[String(service).toLowerCase()];
    if (svc) {
      const svcUsage = usage.perService[String(service).toLowerCase()] || { calls: 0, tokens: 0 };
      if (svc.maxCalls && svcUsage.calls + 1 > svc.maxCalls) {
        return deny('calls', String(service), svc.maxCalls, svcUsage.calls);
      }
      if (enforceTokens && svc.maxTokens && svcUsage.tokens + tokens > svc.maxTokens) {
        return deny('tokens', String(service), svc.maxTokens, svcUsage.tokens);
      }
    }
  }
  return { allowed: true };
}

// Accumulate usage. service='' rows hold non-service API traffic.
function recordAgentUsage(agentId, { service = '', calls = 1, tokens = 0 } = {}) {
  if (!agentId) return;
  try {
    db.prepare(`
      INSERT INTO agent_usage_counters (agent_id, day, service, calls, tokens_used)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(agent_id, day, service) DO UPDATE SET
        calls = calls + excluded.calls,
        tokens_used = tokens_used + excluded.tokens_used
    `).run(String(agentId), utcDay(), String(service || '').toLowerCase(), Math.max(0, calls), Math.max(0, Math.floor(tokens)));
  } catch (e) {
    console.error('[AgentLimits] usage write failed:', e.message);
  }
}

// ~4 chars per LLM token — the standard cheap estimate; exactness doesn't
// matter for quota purposes, consistency does.
function estimateTokens(payload) {
  if (payload === null || payload === undefined) return 0;
  const str = typeof payload === 'string' ? payload : (() => {
    try { return JSON.stringify(payload); } catch { return ''; }
  })();
  return Math.ceil((str || '').length / 4);
}

module.exports = {
  normalizeLimits,
  getAgentLimits,
  setAgentLimits,
  getAgentUsage,
  checkAgentLimits,
  recordAgentUsage,
  estimateTokens,
  periodStartDay,
};
