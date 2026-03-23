/**
 * Workspace Management Routes
 * Phase 1: Teams & Multi-Tenancy
 * Handles workspace CRUD, team member management, and invitations
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const {
  createWorkspace,
  getWorkspaces,
  updateWorkspace,
  deleteWorkspace,
  addWorkspaceMember,
  getWorkspaceMembers,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  getWorkspaceMember,
  createWorkspaceInvitation,
  getWorkspaceInvitations,
  getInvitationById,
  acceptWorkspaceInvitation,
  declineWorkspaceInvitation,
  getUserWorkspaceInvitations,
  cleanupExpiredInvitations,
  getUserById,
  getUserByEmail,
} = require('../database');

// ========== WORKSPACE OPERATIONS ==========

/**
 * POST /api/v1/workspaces
 * Create a new workspace
 * Required: name
 * Auth: Must be logged in
 */
router.post('/', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, slug } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const workspace = createWorkspace(name.trim(), req.user.id, slug);
    res.status(201).json({
      success: true,
      workspace: workspace,
      message: 'Workspace created successfully'
    });
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

/**
 * GET /api/v1/workspaces
 * List all workspaces for the current user
 * Auth: Must be logged in
 */
router.get('/', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspaces = getWorkspaces(req.user.id);
    res.json({
      success: true,
      workspaces: workspaces,
      count: workspaces.length
    });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

/**
 * GET /api/v1/workspaces/:id
 * Get workspace details
 * Auth: Must be a member of the workspace
 */
router.get('/:id', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspace = getWorkspaces(null, req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is a member
    const member = getWorkspaceMember(workspace.id, req.user.id);
    if (!member && workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      workspace: workspace
    });
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

/**
 * PUT /api/v1/workspaces/:id
 * Update workspace details
 * Auth: Must be owner
 */
router.put('/:id', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspace = getWorkspaces(null, req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Only owner can update
    if (workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only workspace owner can update' });
    }

    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.slug !== undefined) updates.slug = req.body.slug;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const success = updateWorkspace(req.params.id, updates);
    if (!success) {
      return res.status(400).json({ error: 'Failed to update workspace' });
    }

    const updated = getWorkspaces(null, req.params.id);
    res.json({
      success: true,
      workspace: updated,
      message: 'Workspace updated successfully'
    });
  } catch (error) {
    console.error('Update workspace error:', error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

/**
 * DELETE /api/v1/workspaces/:id
 * Delete a workspace (owner only)
 * Auth: Must be owner
 */
router.delete('/:id', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspace = getWorkspaces(null, req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Only owner can delete
    if (workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only workspace owner can delete' });
    }

    const success = deleteWorkspace(req.params.id);
    if (!success) {
      return res.status(400).json({ error: 'Failed to delete workspace' });
    }

    res.json({
      success: true,
      message: 'Workspace deleted successfully'
    });
  } catch (error) {
    console.error('Delete workspace error:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

// ========== WORKSPACE MEMBER OPERATIONS ==========

/**
 * GET /api/v1/workspaces/:id/members
 * List workspace members
 * Auth: Must be a member of the workspace
 */
router.get('/:id/members', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspace = getWorkspaces(null, req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is a member
    const member = getWorkspaceMember(workspace.id, req.user.id);
    if (!member && workspace.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const members = getWorkspaceMembers(req.params.id);
    res.json({
      success: true,
      members: members,
      count: members.length
    });
  } catch (error) {
    console.error('Get workspace members error:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

/**
 * POST /api/v1/workspaces/:id/members
 * Add a member to workspace (by user ID)
 * Auth: Must be admin or owner
 */
router.post('/:id/members', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspace = getWorkspaces(null, req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is admin or owner
    const member = getWorkspaceMember(workspace.id, req.user.id);
    const isAdmin = (member && (member.role === 'admin' || member.role === 'owner')) || 
                    workspace.ownerId === req.user.id;
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can add members' });
    }

    const { userId, role = 'member' } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Verify user exists
    const targetUser = getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const memberId = addWorkspaceMember(workspace.id, userId, role);
    const members = getWorkspaceMembers(workspace.id);
    const newMember = members.find(m => m.id === memberId);

    res.status(201).json({
      success: true,
      member: newMember,
      message: 'Member added successfully'
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

/**
 * PUT /api/v1/workspaces/:id/members/:userId
 * Update member role
 * Auth: Must be admin or owner
 */
router.put('/:id/members/:userId', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspace = getWorkspaces(null, req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is admin or owner
    const member = getWorkspaceMember(workspace.id, req.user.id);
    const isAdmin = (member && (member.role === 'admin' || member.role === 'owner')) || 
                    workspace.ownerId === req.user.id;
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can update member roles' });
    }

    const targetMember = getWorkspaceMember(workspace.id, req.params.userId);
    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    // Can't change owner role
    if (targetMember.role === 'owner' || role === 'owner') {
      return res.status(400).json({ error: 'Cannot change owner role' });
    }

    const success = updateWorkspaceMemberRole(targetMember.id, role);
    if (!success) {
      return res.status(400).json({ error: 'Failed to update member role' });
    }

    const members = getWorkspaceMembers(workspace.id);
    const updated = members.find(m => m.user_id === req.params.userId);

    res.json({
      success: true,
      member: updated,
      message: 'Member role updated successfully'
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

/**
 * DELETE /api/v1/workspaces/:id/members/:userId
 * Remove a member from workspace
 * Auth: Must be admin or owner
 */
router.delete('/:id/members/:userId', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspace = getWorkspaces(null, req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is admin or owner
    const member = getWorkspaceMember(workspace.id, req.user.id);
    const isAdmin = (member && (member.role === 'admin' || member.role === 'owner')) || 
                    workspace.ownerId === req.user.id;
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    const targetMember = getWorkspaceMember(workspace.id, req.params.userId);
    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Can't remove owner
    if (targetMember.role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove workspace owner' });
    }

    const success = removeWorkspaceMember(targetMember.id);
    if (!success) {
      return res.status(400).json({ error: 'Failed to remove member' });
    }

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ========== WORKSPACE INVITATION OPERATIONS ==========

/**
 * GET /api/v1/workspaces/:id/invitations
 * List pending invitations for workspace
 * Auth: Must be admin or owner
 */
router.get('/:id/invitations', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspace = getWorkspaces(null, req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is admin or owner
    const member = getWorkspaceMember(workspace.id, req.user.id);
    const isAdmin = (member && (member.role === 'admin' || member.role === 'owner')) || 
                    workspace.ownerId === req.user.id;
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can view invitations' });
    }

    const invitations = getWorkspaceInvitations(req.params.id);
    res.json({
      success: true,
      invitations: invitations,
      count: invitations.length
    });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

/**
 * POST /api/v1/workspaces/:id/invitations
 * Send invitation to email
 * Auth: Must be admin or owner
 */
router.post('/:id/invitations', (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspace = getWorkspaces(null, req.params.id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is admin or owner
    const member = getWorkspaceMember(workspace.id, req.user.id);
    const isAdmin = (member && (member.role === 'admin' || member.role === 'owner')) || 
                    workspace.ownerId === req.user.id;
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can send invitations' });
    }

    const { email, role = 'member' } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if already invited
    const existing = getWorkspaceInvitations(workspace.id).find(inv => inv.email === email);
    if (existing) {
      return res.status(400).json({ error: 'This email has already been invited' });
    }

    const invitation = createWorkspaceInvitation(
      workspace.id,
      email,
      req.user.id,
      role
    );

    // Trigger notification for the invitee (when they log in, they'll see it)
    const NotificationDispatcher = require('../lib/notificationDispatcher');
    try {
      // Queue notification (will be shown to invitee once they accept and login)
      const inviteeUser = getUserByEmail(email);
      if (inviteeUser) {
        NotificationDispatcher.onTeamInvitationReceived(
          workspace.id,
          inviteeUser.id,
          req.user.id,
          workspace.name,
          role,
          invitation.id
        );
      }
    } catch (err) {
      console.error('Failed to send invitation notification:', err.message);
      // Don't fail the API call if notification fails
    }

    res.status(201).json({
      success: true,
      invitation: invitation,
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

/**
 * GET /api/v1/invitations/detail/:id
 * Get a specific invitation by ID (renamed route to avoid conflict with workspace delete)
 */
router.get('/detail/:id', (req, res) => {
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
 * Decline/delete an invitation (revoke by admin)
 * Auth: Optional (can be deleted by admin or self)
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
 * GET /api/v1/invitations
 * List invitations for current user's email
 * Auth: Must be logged in
 */
router.get('/', (req, res) => {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Clean up expired invitations
    cleanupExpiredInvitations();

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
