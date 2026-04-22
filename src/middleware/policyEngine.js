// Portions of this file are derived from onecli/onecli (apps/gateway/src/policy.rs)
// Copyright 2025 ChartDB, Inc. — Apache License 2.0
// See NOTICES file at the project root for full attribution.

const { getDatabase } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// In-memory sliding-window rate limit counters: Map<`${ruleId}:${tokenId}:${windowId}`, count>
const rateLimitCounters = new Map();

// Clean stale counter windows every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key] of rateLimitCounters) {
    const windowId = parseInt(key.split(':')[2], 10);
    // keep windows from the last 2 minutes as buffer
    if (now - windowId > 120_000) rateLimitCounters.delete(key);
  }
}, 5 * 60 * 1000).unref();

const SENSITIVE_BODY_KEYS = new Set([
  'password', 'passwd', 'secret', 'token', 'key', 'api_key', 'apikey',
  'authorization', 'credentials', 'credit_card', 'card_number', 'cvv',
  'ssn', 'private_key', 'access_token', 'refresh_token', 'client_secret',
  'private', 'auth', 'signature', 'hash',
]);

function scrubBodyForPreview(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const result = {};
  for (const [k, v] of Object.entries(body)) {
    result[k] = SENSITIVE_BODY_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return result;
}

function matchPattern(pattern, value) {
  if (pattern === '*') return true;
  if (pattern.endsWith('/*')) return value.startsWith(pattern.slice(0, -1));
  if (pattern.endsWith('*')) return value.startsWith(pattern.slice(0, -1));
  return pattern === value;
}

function ruleMatches(rule, method, host, path) {
  const methodOk = rule.method === '*' || rule.method.toUpperCase() === method.toUpperCase();
  const hostOk = matchPattern(rule.host_pattern, host);
  const pathOk = matchPattern(rule.path_pattern, path);
  return methodOk && hostOk && pathOk;
}

function getRulesForToken(tokenId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM policy_rules
    WHERE token_id = ? OR token_id IS NULL
    ORDER BY created_at ASC
  `).all(tokenId);
}

// Returns the most recent non-expired approval for a token+rule combo, or null.
function getLatestApproval(tokenId, ruleId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, status, expires_at FROM pending_approvals
    WHERE token_id = ? AND rule_id = ? AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(tokenId, ruleId, Date.now());
}

function createPendingApproval(tokenId, ruleId, req) {
  const db = getDatabase();
  const id = uuidv4();
  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000; // 5 minutes

  // Strip auth headers before storing
  const safeHeaders = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (!['authorization', 'cookie', 'x-api-key', 'x-vault-token'].includes(k.toLowerCase())) {
      safeHeaders[k] = v;
    }
  }

  // Scrub sensitive fields from body before storing
  const scrubbed = scrubBodyForPreview(req.body);
  const bodyPreview = scrubbed
    ? JSON.stringify(scrubbed).substring(0, 500)
    : null;

  db.prepare(`
    INSERT INTO pending_approvals
      (id, token_id, rule_id, method, host, path, headers, body_preview, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    id, tokenId, ruleId,
    req.method,
    // Use server-configured hostname if available to prevent Host-header spoofing
    process.env.SERVER_HOSTNAME || req.hostname || (req.headers.host || '').split(':')[0],
    req.path,
    JSON.stringify(safeHeaders),
    bodyPreview,
    now, expiresAt
  );

  return id;
}

function checkRateLimit(rule, tokenId) {
  const windowMs = rule.rate_limit_window_ms || 60_000;
  const maxCount = rule.rate_limit_count || 60;
  const windowId = Math.floor(Date.now() / windowMs) * windowMs;
  const key = `${rule.id}:${tokenId}:${windowId}`;

  const current = (rateLimitCounters.get(key) || 0) + 1;
  rateLimitCounters.set(key, current);

  if (current > maxCount) {
    const retryAfterMs = windowId + windowMs - Date.now();
    return { limited: true, retryAfterMs };
  }
  return { limited: false };
}

// Expire pending approvals older than their expires_at
function cleanupExpiredApprovals() {
  try {
    const db = getDatabase();
    const expired = db.prepare(`
      UPDATE pending_approvals SET status = 'expired'
      WHERE status = 'pending' AND expires_at < ?
    `).run(Date.now());
    if (expired.changes > 0) {
      logger.debug(`[PolicyEngine] Expired ${expired.changes} pending approvals`);
    }
  } catch (e) {
    logger.error('[PolicyEngine] Cleanup error:', e.message);
  }
}

// Middleware factory — call after authenticate() so req.tokenData is set
function policyEngine() {
  return async (req, res, next) => {
    // Support both TokenManager (req.tokenData) and legacy local-auth (req.tokenMeta) token formats
    const token = req.tokenData || req.tokenMeta;
    if (!token) return next(); // unauthenticated requests skip policy checks

    const tokenId = token.id || token.tokenId;
    const method = req.method;
    // Use server-configured hostname to prevent Host-header spoofing attacks
    const host = process.env.SERVER_HOSTNAME || (req.hostname || (req.headers.host || '').split(':')[0]);
    const path = req.path;

    let rules;
    try {
      rules = getRulesForToken(tokenId);
    } catch (e) {
      logger.error('[PolicyEngine] Failed to load rules:', e.message);
      // Fail closed — block requests when policy state is unknown
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Policy engine temporarily unavailable',
      });
    }

    // Priority 0: EXPLICIT ALLOW (whitelist — takes precedence over block/rate_limit)
    for (const rule of rules) {
      if (rule.action === 'allow' && ruleMatches(rule, method, host, path)) {
        logger.debug('[PolicyEngine] Request explicitly allowed by policy', { tokenId, ruleId: rule.id, path });
        return next();
      }
    }

    // Priority 1: BLOCK
    for (const rule of rules) {
      if (rule.action === 'block' && ruleMatches(rule, method, host, path)) {
        logger.info('[PolicyEngine] Request blocked by policy', { tokenId, ruleId: rule.id, path });
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Request blocked by security policy',
          ruleId: rule.id,
        });
      }
    }

    // Priority 2: MANUAL_APPROVAL
    for (const rule of rules) {
      if (rule.action === 'manual_approval' && ruleMatches(rule, method, host, path)) {
        let existing;
        try {
          existing = getLatestApproval(tokenId, rule.id);
        } catch (e) {
          logger.error('[PolicyEngine] Failed to check existing approval:', e.message);
          return res.status(503).json({ error: 'Service Unavailable', message: 'Policy engine temporarily unavailable' });
        }

        if (existing?.status === 'approved') {
          logger.info('[PolicyEngine] Request allowed via prior approval', { tokenId, ruleId: rule.id, approvalId: existing.id });
          continue; // Prior approval grants passage
        }

        if (existing?.status === 'denied') {
          logger.info('[PolicyEngine] Request denied by prior decision', { tokenId, ruleId: rule.id, approvalId: existing.id });
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Request was denied by security policy',
            approvalId: existing.id,
          });
        }

        if (existing?.status === 'pending') {
          // Already waiting — return existing approval ID instead of creating a duplicate
          const retryAfter = Math.ceil((existing.expires_at - Date.now()) / 1000);
          return res.status(202).json({
            message: 'Request is pending manual approval',
            approvalId: existing.id,
            retryAfter,
          });
        }

        // No usable approval exists — create a new pending one
        let approvalId;
        try {
          approvalId = createPendingApproval(tokenId, rule.id, req);
        } catch (e) {
          logger.error('[PolicyEngine] Failed to create pending approval:', e.message);
          return res.status(500).json({ error: 'Failed to queue approval request' });
        }
        logger.info('[PolicyEngine] Request held for approval', { tokenId, ruleId: rule.id, approvalId });
        return res.status(202).json({
          message: 'Request requires manual approval before it can proceed',
          approvalId,
          retryAfter: 300,
        });
      }
    }

    // Priority 3: RATE_LIMIT
    for (const rule of rules) {
      if (rule.action === 'rate_limit' && ruleMatches(rule, method, host, path)) {
        const { limited, retryAfterMs } = checkRateLimit(rule, tokenId);
        if (limited) {
          const retryAfterSec = Math.ceil((retryAfterMs || 60_000) / 1000);
          res.set('Retry-After', String(retryAfterSec));
          logger.info('[PolicyEngine] Rate limit hit', { tokenId, ruleId: rule.id });
          return res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded for this token',
            retryAfter: retryAfterSec,
          });
        }
      }
    }

    // Default: no matching rule — allow
    next();
  };
}

module.exports = { policyEngine, cleanupExpiredApprovals };
