// Portions of this file are derived from onecli/onecli (apps/gateway/src/approval.rs)
// Copyright 2025 ChartDB, Inc. — Apache License 2.0
// See NOTICES file at the project root for full attribution.

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

const VALID_ACTIONS = ['block', 'manual_approval', 'rate_limit', 'allow'];

// All policy management endpoints require admin scope or a personal (master) token
router.use((req, res, next) => {
  const token = req.tokenData;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const isPersonal = token.type === 'personal';
  const hasAdminScope = Array.isArray(token.scope) && (
    token.scope.includes('admin:*') || token.scope.includes('admin:policy')
  );
  if (!isPersonal && !hasAdminScope) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Policy management requires admin:* or admin:policy scope',
    });
  }
  next();
});

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

  const callerWorkspace = req.headers['x-workspace-id'] || null;
  // Use caller's workspace if rule doesn't specify one, preventing cross-workspace rule creation
  const effectiveWorkspace = workspaceId || callerWorkspace || null;

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
      effectiveWorkspace,
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

// GET /api/v1/policy/rules — list rules scoped to caller's workspace
router.get('/rules', (req, res) => {
  const db = getDatabase();
  const { tokenId } = req.query;
  const workspaceId = req.headers['x-workspace-id'] || null;

  try {
    let rows;
    if (tokenId) {
      if (workspaceId) {
        rows = db.prepare(`
          SELECT * FROM policy_rules
          WHERE (token_id = ? OR token_id IS NULL)
          AND (workspace_id = ? OR workspace_id IS NULL)
          ORDER BY created_at DESC
        `).all(tokenId, workspaceId);
      } else {
        rows = db.prepare(`
          SELECT * FROM policy_rules WHERE token_id = ? OR token_id IS NULL ORDER BY created_at DESC
        `).all(tokenId);
      }
    } else if (workspaceId) {
      rows = db.prepare(`
        SELECT * FROM policy_rules
        WHERE workspace_id = ? OR workspace_id IS NULL
        ORDER BY created_at DESC
      `).all(workspaceId);
    } else {
      rows = db.prepare('SELECT * FROM policy_rules ORDER BY created_at DESC').all();
    }
    res.json({ rules: rows });
  } catch (e) {
    logger.error('[Policy] Failed to list rules:', e.message);
    res.status(500).json({ error: 'Failed to list policy rules' });
  }
});

// DELETE /api/v1/policy/rules/:id — remove a rule
router.delete('/rules/:id', (req, res) => {
  const db = getDatabase();
  const callerWorkspace = req.headers['x-workspace-id'] || null;
  const callerId = req.tokenData?.id;

  try {
    const rule = db.prepare('SELECT * FROM policy_rules WHERE id = ?').get(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    // Workspace isolation: caller must own the rule or be in the same workspace
    const ruleWorkspace = rule.workspace_id;
    if (callerWorkspace && ruleWorkspace && ruleWorkspace !== callerWorkspace) {
      return res.status(403).json({ error: 'Forbidden', message: 'Cannot delete rules from other workspaces' });
    }

    const result = db.prepare('DELETE FROM policy_rules WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Rule not found' });
    logger.info('[Policy] Rule deleted', { id: req.params.id, deletedBy: callerId });
    res.json({ ok: true });
  } catch (e) {
    logger.error('[Policy] Failed to delete rule:', e.message);
    res.status(500).json({ error: 'Failed to delete policy rule' });
  }
});

// GET /api/v1/policy/approvals/pending — list pending approvals scoped to caller's workspace
router.get('/approvals/pending', (req, res) => {
  const db = getDatabase();
  const workspaceId = req.headers['x-workspace-id'] || null;

  try {
    let rows;
    if (workspaceId) {
      // Scope to approvals whose triggering rule belongs to the caller's workspace
      rows = db.prepare(`
        SELECT pa.id, pa.token_id, pa.rule_id, pa.method, pa.host, pa.path,
               pa.headers, pa.body_preview, pa.status, pa.created_at, pa.expires_at,
               pa.decided_at, pa.decided_by
        FROM pending_approvals pa
        JOIN policy_rules pr ON pa.rule_id = pr.id
        WHERE pa.status = 'pending' AND pa.expires_at > ?
        AND (pr.workspace_id = ? OR pr.workspace_id IS NULL)
        ORDER BY pa.created_at DESC
        LIMIT 100
      `).all(Date.now(), workspaceId);
    } else {
      rows = db.prepare(`
        SELECT * FROM pending_approvals
        WHERE status = 'pending' AND expires_at > ?
        ORDER BY created_at DESC
        LIMIT 100
      `).all(Date.now());
    }

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
  const callerWorkspace = req.headers['x-workspace-id'] || null;

  try {
    // Join with policy_rules to enforce workspace isolation
    const approval = db.prepare(`
      SELECT pa.*, pr.workspace_id AS rule_workspace_id
      FROM pending_approvals pa
      JOIN policy_rules pr ON pa.rule_id = pr.id
      WHERE pa.id = ?
    `).get(req.params.id);

    if (!approval) return res.status(404).json({ error: 'Approval not found' });

    // Prevent cross-workspace approval tampering
    if (callerWorkspace && approval.rule_workspace_id && approval.rule_workspace_id !== callerWorkspace) {
      logger.warn('[Policy] Cross-workspace approval attempt blocked', {
        approvalId: req.params.id,
        callerWorkspace,
        ruleWorkspace: approval.rule_workspace_id,
        decidedBy: req.tokenData?.id,
      });
      return res.status(403).json({ error: 'Forbidden', message: 'Cannot manage approvals from other workspaces' });
    }

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
