/**
 * Invitation Management Routes
 * Handles user-specific invitation operations (accept, decline, view)
 */

const express = require('express');
const router = express.Router();

const {
  getInvitationById,
  acceptWorkspaceInvitation,
  declineWorkspaceInvitation,
  getWorkspaces,
  getWorkspaceMember,
} = require('../database');

/**
 * GET /api/v1/invitations/:id
 * Get a specific invitation by ID
 * Auth: Optional
 */
router.get('/:id', (req, res) => {
  try {
    const invitation = getInvitationById(req.params.id);
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if expired
    if (new Date(invitation.expiresAt) < new Date()) {
      declineWorkspaceInvitation(req.params.id);
      return res.status(410).json({ error: 'Invitation has expired' });
    }

    res.json({
      success: true,
      invitation: invitation
    });
  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({ error: 'Failed to fetch invitation' });
  }
});

/**
 * POST /api/v1/invitations/:id/accept
 * Accept an invitation
 * Auth: Must be logged in
 */
router.post('/:id/accept', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const invitation = getInvitationById(req.params.id);
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if expired
    if (new Date(invitation.expiresAt) < new Date()) {
      declineWorkspaceInvitation(req.params.id);
      return res.status(410).json({ error: 'Invitation has expired' });
    }

    // Check if email matches
    if (req.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(403).json({ error: 'Invitation email does not match user email' });
    }

    const success = acceptWorkspaceInvitation(req.params.id, req.user.id);
    if (!success) {
      return res.status(400).json({ error: 'Failed to accept invitation' });
    }

    const workspace = getWorkspaces(null, invitation.workspaceId);

    res.json({
      success: true,
      workspace: workspace,
      message: 'Invitation accepted successfully'
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

/**
 * DELETE /api/v1/invitations/:id
 * Decline/delete an invitation (revoke by admin or self-decline)
 * Auth: Optional - can be deleted by:
 * 1. Authenticated admin/owner of the workspace
 * 2. Unauthenticated with matching email (?email= query param)
 */
router.delete('/:id', (req, res) => {
  try {
    const invitation = getInvitationById(req.params.id);
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Can delete if:
    // 1. User is admin/owner of workspace
    // 2. User email matches invitation email (self decline)
    const workspace = getWorkspaces(null, invitation.workspaceId);
    let canDelete = false;

    if (req.user) {
      const member = getWorkspaceMember(workspace.id, req.user.id);
      canDelete = (member && (member.role === 'admin' || member.role === 'owner')) || 
                  workspace.ownerId === req.user.id ||
                  req.user.email?.toLowerCase() === invitation.email.toLowerCase();
    } else {
      // Require authentication - unauthenticated deletion is not allowed
      return res.status(401).json({ error: 'Authentication required to decline invitation' });
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'Not authorized to revoke this invitation' });
    }

    const success = declineWorkspaceInvitation(req.params.id);
    if (!success) {
      return res.status(400).json({ error: 'Failed to revoke invitation' });
    }

    res.json({
      success: true,
      message: 'Invitation revoked successfully'
    });
  } catch (error) {
    console.error('Revoke invitation error:', error);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
});

/**
 * GET /api/v1/invitations/pending
 * Get all pending invitations for the current user
 * Auth: Must be logged in
 * 
 * MOBILE FIX: On mobile browsers, session cookies might not persist after OAuth redirect.
 * Fallback: Check X-User-Email header as alternative auth source (sent by client after OAuth confirm).
 */
router.get('/', (req, res) => {
  try {
    let userEmail = null;

    // Primary: Check session auth (works on desktop)
    if (req.user && req.user.email) {
      userEmail = req.user.email;
      console.log('[Invitations] Using session auth:', userEmail);
    }
    // Fallback: Check header sent by client (mobile fix for lost session cookie)
    else if (req.headers['x-user-email']) {
      userEmail = req.headers['x-user-email'];
      console.log('[Invitations] Using header fallback auth:', userEmail);
    }
    // Fallback 2: Check if Authorization Bearer token can decode user
    else if (req.headers.authorization) {
      const token = req.headers.authorization.replace('Bearer ', '');
      // Try to extract email from stored sessions/tokens
      try {
        const Database = require('better-sqlite3');
        const db = new Database(require('path').join(__dirname, '../data/myapi.db'));
        // Search for a recent session with this token
        const session = db.prepare(`
          SELECT data FROM sessions 
          WHERE data LIKE ? 
          ORDER BY expires DESC 
          LIMIT 1
        `).get(`%"${userEmail}"%`);
        if (session) {
          const data = JSON.parse(session.data);
          userEmail = data.user?.email;
          console.log('[Invitations] Extracted from session token:', userEmail);
        }
      } catch (e) {
        // Silently fail fallback
      }
    }

    if (!userEmail) {
      console.log('[Invitations] ❌ No auth method available');
      console.log('  - req.user:', req.user ? 'exists' : 'NONE');
      console.log('  - X-User-Email header:', req.headers['x-user-email'] ? 'exists' : 'NONE');
      console.log('  - Authorization:', req.headers.authorization ? 'exists' : 'NONE');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { getUserWorkspaceInvitations } = require('../database');
    const invitations = getUserWorkspaceInvitations(userEmail);

    res.json({
      success: true,
      invitations: invitations,
      count: invitations.length
    });
  } catch (error) {
    console.error('Get user invitations error:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

module.exports = router;
