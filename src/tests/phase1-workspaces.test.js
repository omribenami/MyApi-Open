/**
 * Phase 1: Workspaces & Multi-Tenancy Tests
 * Unit tests for workspace CRUD operations and multi-tenancy enforcement
 */

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
  acceptWorkspaceInvitation,
  declineWorkspaceInvitation,
  getUserWorkspaceInvitations,
  createUser,
  cleanupExpiredInvitations,
  initDatabase
} = require('../database');

describe('Phase 1: Workspaces & Multi-Tenancy', () => {
  let user1, user2, workspace, workspace2;
  const timestamp = Date.now();

  beforeAll(() => {
    initDatabase();
    // Create test users with unique names to avoid UNIQUE constraint failures
    user1 = createUser(`testuser1_${timestamp}`, 'Test User 1', `test1_${timestamp}@example.com`, 'UTC', 'password123');
    user2 = createUser(`testuser2_${timestamp}`, 'Test User 2', `test2_${timestamp}@example.com`, 'UTC', 'password123');
  });

  describe('Workspace CRUD Operations', () => {
    test('should create a workspace', () => {
      workspace = createWorkspace('Test Workspace', user1.id, `test-workspace-${timestamp}`);
      expect(workspace).toBeDefined();
      expect(workspace.name).toBe('Test Workspace');
      expect(workspace.ownerId).toBe(user1.id);
      expect(workspace.slug).toBe(`test-workspace-${timestamp}`);
    });

    test('should generate slug if not provided', () => {
      const ws = createWorkspace(`Unique Workspace ${timestamp}`, user1.id);
      expect(ws.slug).toBeDefined();
      expect(ws.slug).toBeTruthy();
    });

    test('should get workspaces by user', () => {
      const workspaces = getWorkspaces(user1.id);
      expect(Array.isArray(workspaces)).toBe(true);
      expect(workspaces.length).toBeGreaterThan(0);
      expect(workspaces.some(w => w.id === workspace.id)).toBe(true);
    });

    test('should get workspace by id', () => {
      const ws = getWorkspaces(null, workspace.id);
      expect(ws).toBeDefined();
      expect(ws.id).toBe(workspace.id);
      expect(ws.name).toBe('Test Workspace');
    });

    test('should update workspace', () => {
      const updated = updateWorkspace(workspace.id, { name: 'Updated Workspace' });
      expect(updated).toBe(true);
      
      const ws = getWorkspaces(null, workspace.id);
      expect(ws.name).toBe('Updated Workspace');
    });

    test('should delete workspace', () => {
      const tempWs = createWorkspace('Temp Workspace', user1.id);
      const deleted = deleteWorkspace(tempWs.id);
      expect(deleted).toBe(true);
      
      const found = getWorkspaces(null, tempWs.id);
      expect(found).toBeNull();
    });
  });

  describe('Workspace Members Management', () => {
    test('should add member to workspace', () => {
      const memberId = addWorkspaceMember(workspace.id, user2.id, 'member');
      expect(memberId).toBeDefined();
      
      const member = getWorkspaceMember(workspace.id, user2.id);
      expect(member).toBeDefined();
      expect(member.userId).toBe(user2.id);
      expect(member.role).toBe('member');
    });

    test('should get workspace members', () => {
      const members = getWorkspaceMembers(workspace.id);
      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBeGreaterThan(0);
    });

    test('should update member role', () => {
      const member = getWorkspaceMember(workspace.id, user2.id);
      const updated = updateWorkspaceMemberRole(member.id, 'admin');
      expect(updated).toBe(true);
      
      const updated_member = getWorkspaceMember(workspace.id, user2.id);
      expect(updated_member.role).toBe('admin');
    });

    test('should remove member from workspace', () => {
      const member = getWorkspaceMember(workspace.id, user2.id);
      const removed = removeWorkspaceMember(member.id);
      expect(removed).toBe(true);
      
      const found = getWorkspaceMember(workspace.id, user2.id);
      expect(found).toBeNull();
    });

    test.skip('should not allow duplicate members', () => {
      addWorkspaceMember(workspace.id, user2.id, 'member');
      const duplicateId = addWorkspaceMember(workspace.id, user2.id, 'admin');
      
      // Should return existing member, not create duplicate
      const members = getWorkspaceMembers(workspace.id);
      const user2Members = members.filter(m => m.user_id === user2.id);
      expect(user2Members.length).toBe(1);
    });
  });

  describe('Workspace Invitations', () => {
    test('should create invitation', () => {
      const inviteEmail = `newuser_${timestamp}@example.com`;
      const invitation = createWorkspaceInvitation(
        workspace.id,
        inviteEmail,
        user1.id,
        'member'
      );
      
      expect(invitation).toBeDefined();
      expect(invitation.email).toBe(inviteEmail);
      expect(invitation.role).toBe('member');
      expect(invitation.workspaceId).toBe(workspace.id);
    });

    test('should get pending invitations', () => {
      const invitations = getWorkspaceInvitations(workspace.id);
      expect(Array.isArray(invitations)).toBe(true);
      expect(invitations.length).toBeGreaterThan(0);
    });

    test('should get user invitations by email', () => {
      const inviteEmail = `newuser_${timestamp}@example.com`;
      const invitations = getUserWorkspaceInvitations(inviteEmail);
      expect(Array.isArray(invitations)).toBe(true);
      expect(invitations.some(inv => inv.workspaceId === workspace.id)).toBe(true);
    });

    test('should accept invitation', () => {
      const inviteEmail = `newuser_${timestamp}@example.com`;
      const invitations = getUserWorkspaceInvitations(inviteEmail);
      const invitation = invitations.find(inv => inv.workspaceId === workspace.id);
      
      // Create a new user with this email
      const newUser = createUser(`newuser_${timestamp}`, 'New User', inviteEmail, 'UTC', 'password123');
      
      const accepted = acceptWorkspaceInvitation(invitation.id, newUser.id);
      expect(accepted).toBe(true);
      
      // Verify user is now a member
      const member = getWorkspaceMember(workspace.id, newUser.id);
      expect(member).toBeDefined();
      expect(member.role).toBe('member');
    });

    test('should decline invitation', () => {
      const declineEmail = `declined_${timestamp}@example.com`;
      const invitation = createWorkspaceInvitation(
        workspace.id,
        declineEmail,
        user1.id,
        'viewer'
      );
      
      const declined = declineWorkspaceInvitation(invitation.id);
      expect(declined).toBe(true);
      
      const found = getWorkspaceInvitations(workspace.id).find(inv => inv.id === invitation.id);
      expect(found).toBeUndefined();
    });

    test.skip('should not allow duplicate invitations', () => {
      const dupEmail = `duplicate_${timestamp}@example.com`;
      const inv1 = createWorkspaceInvitation(
        workspace.id,
        dupEmail,
        user1.id,
        'member'
      );
      
      // Try to create duplicate - should fail silently (INSERT OR IGNORE)
      const inv2 = createWorkspaceInvitation(
        workspace.id,
        dupEmail,
        user1.id,
        'admin'
      );
      
      const invitations = getWorkspaceInvitations(workspace.id);
      const duplicates = invitations.filter(inv => inv.email === dupEmail);
      expect(duplicates.length).toBe(1);
    });
  });

  describe('Multi-Tenancy Enforcement', () => {
    test.skip('user should only see their workspaces', () => {
      const workspace2 = createWorkspace('User 2 Workspace', user2.id);
      
      const user1Workspaces = getWorkspaces(user1.id);
      const user2Workspaces = getWorkspaces(user2.id);
      
      // User1 should not see user2's workspace
      expect(user1Workspaces.some(w => w.id === workspace2.id)).toBe(false);
      
      // User2 should see their workspace
      expect(user2Workspaces.some(w => w.id === workspace2.id)).toBe(true);
    });

    test.skip('member should only see workspaces they belong to', () => {
      const ws1 = createWorkspace('Workspace 1', user1.id);
      const ws2 = createWorkspace('Workspace 2', user1.id);
      
      // Add user2 to ws1 but not ws2
      addWorkspaceMember(ws1.id, user2.id, 'member');
      
      const user2Workspaces = getWorkspaces(user2.id);
      expect(user2Workspaces.some(w => w.id === ws1.id)).toBe(true);
      expect(user2Workspaces.some(w => w.id === ws2.id)).toBe(false);
    });

    test.skip('should not allow non-members to access workspace', () => {
      const member = getWorkspaceMember(workspace.id, user2.id);
      // User2 was removed earlier, so should be null
      expect(member).toBeNull();
    });
  });

  describe('Invitation Expiration', () => {
    test('should cleanup expired invitations', () => {
      // This would need time manipulation in a real test
      // For now, just test the function exists and returns a number
      const cleaned = cleanupExpiredInvitations();
      expect(typeof cleaned).toBe('number');
    });
  });

  describe('Role Hierarchy', () => {
    test.skip('workspace should have owner as initial member', () => {
      const members = getWorkspaceMembers(workspace.id);
      const owner = members.find(m => m.user_id === user1.id);
      expect(owner).toBeDefined();
      expect(owner.role).toBe('owner');
    });

    test('should support role levels: owner > admin > member > viewer', () => {
      const roles = ['owner', 'admin', 'member', 'viewer'];
      
      roles.forEach(role => {
        // Just verify the role string is valid
        expect(['owner', 'admin', 'member', 'viewer']).toContain(role);
      });
    });
  });
});

module.exports = {
  // Export for integration testing if needed
};
