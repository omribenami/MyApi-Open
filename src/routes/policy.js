// Portions of this file are derived from onecli/onecli (apps/gateway/src/approval.rs)
// Copyright 2025 ChartDB, Inc. — Apache License 2.0
// See NOTICES file at the project root for full attribution.

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

const VALID_ACTIONS = ['block', 'manual_approval', 'rate_limit', 'allow'];

// POST /api/v1/policy/rules — create a policy rule
router.post('/rules', (req, res) => {
  const { tokenId, hostPattern, pathPattern, method, action, rateLimitCount, rateLimitWindowMs, workspaceId } = req.body;

  if (!hostPattern || !pathPattern || !action) {
    return res.status(400).json({ error: 'hostPattern, pathPattern, and action are required' });
  }
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
  }
  if (action === 'rate_limit' && (!rateLimitCount || !rateLimitWindowMs)) {
    return res.status(400).json({ error: 'rateLimitCount and rateLimitWindowMs required for rate_limit action' });
  }

  const db = getDatabase();
  const id = uuidv4();
  const now = Date.now();

  try {
    db.prepare(`
      INSERT INTO policy_rules
        (id, token_id, host_pattern, path_pattern, method, action, rate_limit_count, rate_limit_window_ms, workspace_id, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tokenId || null,
      hostPattern,
      pathPattern,
      (method || '*').toUpperCase(),
      action,
      rateLimitCount || null,
      rateLimitWindowMs || null,
      workspaceId || null,
      req.tokenData?.id || null,
      now
    );

    logger.info('[Policy] Rule created', { id, action, hostPattern, pathPattern });
    res.status(201).json({ id, tokenId: tokenId || null, hostPattern, pathPattern, method: method || '*', action });
  } catch (e) {
    logger.error('[Policy] Failed to create rule:', e.message);
    res.status(500).json({ error: 'Failed to create policy rule' });
  }
});

// GET /api/v1/policy/rules — list rules (optionally filter by tokenId)
router.get('/rules', (req, res) => {
  const db = getDatabase();
  const { tokenId } = req.query;

  try {
    const rows = tokenId
      ? db.prepare('SELECT * FROM policy_rules WHERE token_id = ? OR token_id IS NULL ORDER BY created_at DESC').all(tokenId)
      : db.prepare('SELECT * FROM policy_rules ORDER BY created_at DESC').all();
    res.json({ rules: rows });
  } catch (e) {
    logger.error('[Policy] Failed to list rules:', e.message);
    res.status(500).json({ error: 'Failed to list policy rules' });
  }
});

// DELETE /api/v1/policy/rules/:id — remove a rule
router.delete('/rules/:id', (req, res) => {
  const db = getDatabase();
  try {
    const result = db.prepare('DELETE FROM policy_rules WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Rule not found' });
    logger.info('[Policy] Rule deleted', { id: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    logger.error('[Policy] Failed to delete rule:', e.message);
    res.status(500).json({ error: 'Failed to delete policy rule' });
  }
});

// GET /api/v1/policy/approvals/pending — list pending approvals for the authed token's workspace
router.get('/approvals/pending', (req, res) => {
  const db = getDatabase();
  try {
    const rows = db.prepare(`
      SELECT * FROM pending_approvals
      WHERE status = 'pending' AND expires_at > ?
      ORDER BY created_at DESC
      LIMIT 100
    `).all(Date.now());
    res.json({ approvals: rows.map(row => ({
      ...row,
      headers: row.headers ? JSON.parse(row.headers) : {},
    })) });
  } catch (e) {
    logger.error('[Policy] Failed to list approvals:', e.message);
    res.status(500).json({ error: 'Failed to list pending approvals' });
  }
});

// POST /api/v1/policy/approvals/:id/decision — approve or deny a pending request
router.post('/approvals/:id/decision', (req, res) => {
  const { action } = req.body;
  if (!['approve', 'deny'].includes(action)) {
    return res.status(400).json({ error: 'action must be "approve" or "deny"' });
  }

  const db = getDatabase();
  const now = Date.now();
  const newStatus = action === 'approve' ? 'approved' : 'denied';

  try {
    const approval = db.prepare('SELECT * FROM pending_approvals WHERE id = ?').get(req.params.id);
    if (!approval) return res.status(404).json({ error: 'Approval not found' });
    if (approval.status !== 'pending') {
      return res.status(409).json({ error: `Approval already ${approval.status}` });
    }
    if (approval.expires_at < now) {
      db.prepare("UPDATE pending_approvals SET status = 'expired' WHERE id = ?").run(req.params.id);
      return res.status(410).json({ error: 'Approval has expired' });
    }

    db.prepare(`
      UPDATE pending_approvals SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?
    `).run(newStatus, now, req.tokenData?.id || null, req.params.id);

    logger.info('[Policy] Approval decision', { id: req.params.id, action, decidedBy: req.tokenData?.id });
    res.json({ ok: true, status: newStatus });
  } catch (e) {
    logger.error('[Policy] Failed to process decision:', e.message);
    res.status(500).json({ error: 'Failed to process approval decision' });
  }
});

module.exports = router;
