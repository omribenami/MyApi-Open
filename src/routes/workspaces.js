/**
 * Workspace Management Routes
 * Phase 1: Teams & Multi-Tenancy
 * Handles workspace CRUD, team member management, and team-scoped invitations
 * 
 * Note: User-scoped invitation routes (accept, decline, view) are in invitations.js
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

function buildInvitationEmailHtml({ workspaceName, role, invitationId, inviterName }) {
  const appUrl = process.env.APP_BASE_URL || 'https://www.myapiai.com';
  const acceptUrl = `${appUrl}/accept-invite/${invitationId}`;
  const logoUrl = `${appUrl}/dashboard/myapi-logo.svg`;

  return `
  <!doctype html>
  <html>
    <body style="margin:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 25px rgba(2,6,23,0.08);">
              <tr>
                <td style="background:linear-gradient(120deg,#2563eb 0%,#7c3aed 100%);padding:20px 24px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="vertical-align:middle;">
                        <img src="${logoUrl}" alt="MyApi" width="28" height="28" style="display:inline-block;vertical-align:middle;border-radius:6px;background:#fff;padding:2px;" />
                        <span style="display:inline-block;vertical-align:middle;margin-left:10px;color:#fff;font-size:18px;font-weight:700;letter-spacing:0.2px;">MyApi</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:30px 28px 12px 28px;">
                  <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.25;color:#0f172a;">You’re invited to join <span style="color:#2563eb;">${workspaceName}</span></h1>
                  <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">
                    ${inviterName || 'A team admin'} invited you to collaborate on MyApi as a <strong>${role}</strong>.
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:16px 28px 8px 28px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                    <tr>
                      <td style="padding:14px 16px;font-size:14px;color:#334155;line-height:1.7;">
                        <strong>What you’ll get access to:</strong>
                        <ul style="margin:8px 0 0 18px;padding:0;">
                          <li>Workspace resources and team settings based on your role</li>
                          <li>Shared services, integrations, and activity context</li>
                          <li>Collaboration on the same organization data</li>
                        </ul>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:20px 28px 28px 28px;">
                  <a href="${acceptUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:10px;">Accept Invitation</a>
                  <p style="margin:12px 0 0 0;font-size:12px;color:#64748b;">If the button doesn’t work, copy this URL into your browser:<br><span style="color:#334155;word-break:break-all;">${acceptUrl}</span></p>
                </td>
              </tr>

              <tr>
                <td style="padding:14px 28px 22px 28px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                    This invitation was sent from MyApi. If you weren’t expecting this, you can ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}


const {
  createWorkspace,
  getWorkspaces,
  updateWorkspace,
  deleteWorkspace,
  addWorkspaceMember,
  getWorkspaceMembers,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  removeWorkspaceMemberByUserId,
  getWorkspaceMember,
  createWorkspaceInvitation,
  getWorkspaceInvitations,
  getInvitationByEmailAndWorkspace,
  deleteInvitationByEmailAndWorkspace,
  queueEmail,
  getUserById,
  getUserByEmail,
} = require('../database');

const { enforcePlanLimit } = require('../lib/planEnforcement');

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

    // Enforce team member plan limit
    const currentMembers = getWorkspaceMembers(workspace.id);
    const memberLimitErr = enforcePlanLimit(req, 'teamMembers', currentMembers.length, 1);
    if (memberLimitErr) return res.status(403).json(memberLimitErr);

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

    const success = removeWorkspaceMemberByUserId(workspace.id, req.params.userId);
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

    // Check if already invited or already a member
    const existingInvitation = getInvitationByEmailAndWorkspace(workspace.id, email);
    if (existingInvitation) {
      // If the invitation is pending, don't allow re-inviting
      if (!existingInvitation.acceptedAt) {
        return res.status(400).json({ error: 'This email has already been invited. They can accept the pending invitation.' });
      }
      
      // If the invitation was accepted, check if they're still a member
      // (they could have been revoked after accepting)
      const inviteeUser = getUserByEmail(email);
      if (inviteeUser) {
        const isMember = getWorkspaceMember(workspace.id, inviteeUser.id);
        if (isMember) {
          return res.status(400).json({ error: 'This person is already a member of this workspace' });
        }
      }
      
      // If the invitation was accepted but they're no longer a member,
      // delete the old invitation to allow re-inviting (they were revoked)
      try {
        deleteInvitationByEmailAndWorkspace(workspace.id, email);
      } catch (err) {
        console.error('Failed to delete old invitation:', err.message);
        return res.status(500).json({ error: 'Failed to clean up old invitation' });
      }
    }

    // Enforce team member plan limit (pending invitations count toward the cap)
    const currentMembers = getWorkspaceMembers(workspace.id);
    const inviteLimitErr = enforcePlanLimit(req, 'teamMembers', currentMembers.length, 1);
    if (inviteLimitErr) return res.status(403).json(inviteLimitErr);

    const invitation = createWorkspaceInvitation(
      workspace.id,
      email,
      req.user.id,
      role
    );

    // Queue branded invitation email
    try {
      const inviter = getUserById(req.user.id);
      const inviterName = inviter?.displayName || inviter?.email || null;
      const appUrl = process.env.APP_BASE_URL || 'https://www.myapiai.com';
      const acceptUrl = `${appUrl}/accept-invite/${invitation.id}`;
      const subject = `You’ve been invited to join ${workspace.name} on MyApi`;
      const textBody = `${inviterName || 'A team admin'} invited you to join "${workspace.name}" as ${role}.\n\nAccept invitation: ${acceptUrl}`;
      const htmlBody = buildInvitationEmailHtml({
        workspaceName: workspace.name,
        role,
        invitationId: invitation.id,
        inviterName,
      });

      queueEmail(
        req.user.id,
        email,
        subject,
        textBody,
        { htmlBody }
      );
    } catch (err) {
      console.error('Failed to queue invitation email:', err.message);
      // Don't fail the API call if email queueing fails
    }

    // Trigger notification for the invitee
    const NotificationDispatcher = require('../lib/notificationDispatcher');
    try {
      const inviteeUser = getUserByEmail(email);
      const inviter = getUserById(req.user.id);
      const inviterName = inviter?.displayName || inviter?.email || 'A team member';
      if (inviteeUser) {
        NotificationDispatcher.onTeamInvitationReceived(
          workspace.id,
          inviteeUser.id,
          inviterName,
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
    console.error('Send invitation error:', error.message || error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Failed to send invitation' });
  }
});
module.exports = router;
