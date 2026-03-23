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
      // Allow deletion if email matches (self decline without auth)
      canDelete = req.query.email && req.query.email.toLowerCase() === invitation.email.toLowerCase();
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
 */
router.get('/', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { getUserWorkspaceInvitations } = require('../database');
    const invitations = getUserWorkspaceInvitations(req.user.email);

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
