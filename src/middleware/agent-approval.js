/**
 * Agent Approval Middleware
 * 
 * Blocks first-time AI agent access and triggers approval notification flow.
 * On subsequent requests (after approval), allows access.
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');

const db = new Database('./src/data/myapi.db');

/**
 * Create agent_approvals table if it doesn't exist
 */
function initializeAgentApprovalsTable() {
  Promise.resolve(db.exec(`
    CREATE TABLE IF NOT EXISTS agent_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      agent_fingerprint TEXT NOT NULL,
      agent_name TEXT,
      approved BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      denied_at DATETIME,
      expires_at DATETIME,
      last_seen_at DATETIME,
      UNIQUE(user_id, agent_fingerprint)
    );
  `)).catch(() => {});
}

/**
 * Generate a fingerprint for the requesting agent
 * Based on User-Agent, IP, and request headers
 */
function generateAgentFingerprint(req) {
  const components = [
    req.get('user-agent') || 'unknown',
    req.ip || 'unknown',
    req.get('x-agent-id') || 'unknown'
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
}

/**
 * Extract agent name from headers or User-Agent
 */
function extractAgentName(req) {
  // Check for explicit agent identification
  const agentId = req.get('x-agent-id');
  if (agentId) return agentId;

  const userAgent = req.get('user-agent') || '';
  
  // Try to extract agent name from User-Agent
  if (userAgent.includes('Claude')) return 'Claude';
  if (userAgent.includes('Cursor')) return 'Cursor';
  if (userAgent.includes('ChatGPT')) return 'ChatGPT';
  if (userAgent.includes('Gemini')) return 'Gemini';
  
  return 'Unknown AI Agent';
}

/**
 * Check if agent is approved for this user
 */
function isAgentApproved(userId, fingerprint) {
  const record = db.prepare(`
    SELECT approved, expires_at FROM agent_approvals
    WHERE user_id = ? AND agent_fingerprint = ? LIMIT 1
  `).get(userId, fingerprint);

  if (!record) return false;
  if (!record.approved) return false;
  
  // Check expiration (approvals valid for 30 days)
  if (record.expires_at) {
    const expiresAt = new Date(record.expires_at);
    if (new Date() > expiresAt) {
      return false;
    }
  }

  return true;
}

/**
 * Record approval request (first encounter)
 */
function recordApprovalRequest(userId, fingerprint, agentName) {
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + 30); // Valid for 30 days

  try {
    db.prepare(`
      INSERT INTO agent_approvals (user_id, agent_fingerprint, agent_name, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, agent_fingerprint) DO UPDATE SET
        last_seen_at = CURRENT_TIMESTAMP
    `).run(userId, fingerprint, agentName, expires_at.toISOString());
  } catch (error) {
    console.error('[AgentApproval] Error recording request:', error);
  }
}

/**
 * Record approval (user approves)
 */
function recordApproval(userId, fingerprint) {
  try {
    db.prepare(`
      UPDATE agent_approvals
      SET approved = 1, approved_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND agent_fingerprint = ?
    `).run(userId, fingerprint);
    return true;
  } catch (error) {
    console.error('[AgentApproval] Error recording approval:', error);
    return false;
  }
}

/**
 * Main middleware: check agent approval on API requests
 */
function agentApprovalMiddleware(req, res, next) {
  // Skip approval check for non-API routes
  if (!req.path.startsWith('/api/v1/')) {
    return next();
  }

  // Skip for auth/public routes
  const publicRoutes = ['/api/v1/auth', '/api/v1/oauth'];
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }

  try {
    // Resolve user ID
    const userId = req.tokenMeta?.userId || req.session?.user?.id || 'owner';
    
    // Generate agent fingerprint
    const fingerprint = generateAgentFingerprint(req);
    const agentName = extractAgentName(req);

    // Check if this is a user (not an AI agent)
    const isHumanUser = req.session?.user || (req.tokenMeta && req.tokenMeta.type === 'personal');
    
    if (isHumanUser) {
      // Humans are always approved
      return next();
    }

    // Check if agent is approved
    if (isAgentApproved(userId, fingerprint)) {
      // Update last_seen_at
      db.prepare(`
        UPDATE agent_approvals
        SET last_seen_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND agent_fingerprint = ?
      `).run(userId, fingerprint);
      
      return next();
    }

    // Agent not approved — record request and send notification
    recordApprovalRequest(userId, fingerprint, agentName);

    // Send approval request notification to user
    // (This would integrate with your notification system)
    sendApprovalNotification(userId, agentName, fingerprint);

    // Return 403 with guidance
    return res.status(403).json({
      ok: false,
      error: 'Access pending approval',
      message: `${agentName} is requesting access to your MyApi services.`,
      guidance: {
        what_happened: 'This is your first request from this AI agent. An approval notification has been sent to you.',
        what_to_do: 'Check your MyApi dashboard notifications and approve or deny access.',
        next_step: 'Once approved, this agent can access your Gmail, Calendar, GitHub, and other connected services.',
        retry_after: 300, // 5 minutes
        docs: 'See https://docs.myapiai.com/agent-approval for more info'
      },
      statusCode: 403,
      agentInfo: {
        name: agentName,
        fingerprint: fingerprint.substring(0, 8) + '...' // Show partial fingerprint for debugging
      }
    });

  } catch (error) {
    console.error('[AgentApproval] Middleware error:', error);
    // Fail open on error (don't block users)
    return next();
  }
}

/**
 * Send approval notification to user
 * Integrates with your notification system
 */
async function sendApprovalNotification(userId, agentName, fingerprint) {
  try {
    // Get user's workspace for notification
    const { getWorkspaces } = require('../database');
    const workspaces = getWorkspaces(userId);
    const workspaceId = workspaces?.[0]?.id || 'default';

    // Dispatch via NotificationDispatcher (respects user preferences)
    const NotificationDispatcher = require('../lib/notificationDispatcher');
    NotificationDispatcher.onAgentApprovalRequested(workspaceId, userId, agentName, fingerprint)
      .catch(err => console.error('[AgentApproval] Notification dispatch error:', err));

    // Example integration (pseudo-code):
    // await notificationService.send({
    //   userId,
    //   type: 'agent_approval_request',
    //   title: `${agentName} wants access`,
    //   message: `${agentName} is requesting access to your MyApi services. Approve or deny?`,
    //   actionUrl: `/dashboard/approvals/${fingerprint}`,
    //   actions: [
    //     { label: 'Approve', action: 'approve' },
    //     { label: 'Deny', action: 'deny' }
    //   ]
    // });
  } catch (error) {
    console.error('[AgentApproval] Error sending notification:', error);
  }
}

/**
 * Endpoint: GET /api/v1/agent-approvals
 * List all pending and approved agent requests
 */
function createAgentApprovalsRoutes() {
  const express = require('express');
  const router = express.Router();

  // GET /api/v1/agent-approvals
  router.get('/', (req, res) => {
    try {
      const userId = req.tokenMeta?.userId || req.session?.user?.id || 'owner';

      const approvals = db.prepare(`
        SELECT 
          agent_fingerprint,
          agent_name,
          approved,
          created_at,
          approved_at,
          denied_at,
          expires_at,
          last_seen_at
        FROM agent_approvals
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).all(userId);

      res.json({
        success: true,
        data: approvals.map(a => ({
          ...a,
          status: a.approved ? 'approved' : (a.denied_at ? 'denied' : 'pending'),
          fingerprint: a.agent_fingerprint.substring(0, 8) + '...'
        }))
      });
    } catch (error) {
      console.error('[AgentApprovals] Error fetching list:', error);
      res.status(500).json({ error: 'Failed to fetch agent approvals' });
    }
  });

  // POST /api/v1/agent-approvals/:fingerprint/approve
  router.post('/:fingerprint/approve', (req, res) => {
    try {
      const userId = req.tokenMeta?.userId || req.session?.user?.id || 'owner';
      const { fingerprint } = req.params;

      // For security, match the full fingerprint from the database
      const record = db.prepare(`
        SELECT * FROM agent_approvals 
        WHERE user_id = ? AND agent_fingerprint LIKE ? LIMIT 1
      `).get(userId, fingerprint + '%');

      if (!record) {
        return res.status(404).json({ error: 'Agent approval request not found' });
      }

      recordApproval(userId, record.agent_fingerprint);

      res.json({
        success: true,
        message: `${record.agent_name} has been approved.`,
        agentName: record.agent_name
      });
    } catch (error) {
      console.error('[AgentApprovals] Error approving:', error);
      res.status(500).json({ error: 'Failed to approve agent' });
    }
  });

  // POST /api/v1/agent-approvals/:fingerprint/deny
  router.post('/:fingerprint/deny', (req, res) => {
    try {
      const userId = req.tokenMeta?.userId || req.session?.user?.id || 'owner';
      const { fingerprint } = req.params;

      const record = db.prepare(`
        SELECT * FROM agent_approvals 
        WHERE user_id = ? AND agent_fingerprint LIKE ? LIMIT 1
      `).get(userId, fingerprint + '%');

      if (!record) {
        return res.status(404).json({ error: 'Agent approval request not found' });
      }

      db.prepare(`
        UPDATE agent_approvals
        SET denied_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND agent_fingerprint = ?
      `).run(userId, record.agent_fingerprint);

      res.json({
        success: true,
        message: `${record.agent_name} has been denied.`,
        agentName: record.agent_name
      });
    } catch (error) {
      console.error('[AgentApprovals] Error denying:', error);
      res.status(500).json({ error: 'Failed to deny agent' });
    }
  });

  return router;
}

module.exports = {
  agentApprovalMiddleware,
  createAgentApprovalsRoutes,
  initializeAgentApprovalsTable,
  isAgentApproved,
  recordApproval,
  recordApprovalRequest
};
