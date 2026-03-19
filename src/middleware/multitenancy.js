/**
 * Multi-Tenancy Middleware
 * Phase 1: Teams & Multi-Tenancy
 * Ensures all requests are scoped to the user's current workspace
 */

const { getWorkspaceMember, getWorkspaces } = require('../database');

/**
 * Require workspace authorization
 * Verifies that the user belongs to the specified workspace
 */
function requireWorkspaceAuth(workspaceId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const workspace = getWorkspaces(null, workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is owner or member
    const member = getWorkspaceMember(workspaceId, req.user.id);
    const isOwner = workspace.ownerId === req.user.id;
    const isMember = member !== null;

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Set workspace context on request
    req.workspace = workspace;
    req.workspaceMember = member;
    req.workspaceId = workspaceId;

    next();
  };
}

/**
 * Require minimum role
 * Verifies that the user has at least the specified role in the workspace
 * Roles: 'viewer' < 'member' < 'admin' < 'owner'
 */
function requireRole(minRole) {
  const roleHierarchy = {
    'viewer': 0,
    'member': 1,
    'admin': 2,
    'owner': 3
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.workspace) {
      return res.status(400).json({ error: 'Workspace context required' });
    }

    // Owner check
    const isOwner = req.workspace.ownerId === req.user.id;
    if (isOwner) {
      next();
      return;
    }

    // Member check
    const member = req.workspaceMember;
    if (!member) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const minRoleLevel = roleHierarchy[minRole] || 0;
    const userRoleLevel = roleHierarchy[member.role] || 0;

    if (userRoleLevel < minRoleLevel) {
      return res.status(403).json({ 
        error: `This action requires ${minRole} or higher role` 
      });
    }

    next();
  };
}

/**
 * Extract workspace context from request
 * Checks for workspace in:
 * 1. Query param: ?workspace=ws_xxx
 * 2. Header: X-Workspace-ID: ws_xxx
 * 3. Request body: { workspace_id: 'ws_xxx' }
 * 4. Session: req.session.currentWorkspace
 * 5. Default to user's primary workspace
 */
function extractWorkspaceContext(req, res, next) {
  if (!req.user) {
    return next();
  }

  let workspaceId = null;

  // Check various sources
  if (req.query.workspace) {
    workspaceId = req.query.workspace;
  } else if (req.headers['x-workspace-id']) {
    workspaceId = req.headers['x-workspace-id'];
  } else if (req.body && req.body.workspace_id) {
    workspaceId = req.body.workspace_id;
  } else if (req.session && req.session.currentWorkspace) {
    workspaceId = req.session.currentWorkspace;
  }

  if (!workspaceId) {
    // Get user's workspaces and use the first one (owner workspace)
    const userWorkspaces = getWorkspaces(req.user.id);
    if (userWorkspaces && userWorkspaces.length > 0) {
      workspaceId = userWorkspaces[0].id;
    }
  }

  if (workspaceId) {
    const workspace = getWorkspaces(null, workspaceId);
    if (workspace) {
      const member = getWorkspaceMember(workspaceId, req.user.id);
      const isOwner = workspace.ownerId === req.user.id;

      if (isOwner || member) {
        req.workspace = workspace;
        req.workspaceMember = member;
        req.workspaceId = workspaceId;
      }
    }
  }

  next();
}

/**
 * Enforce multi-tenancy filter
 * Auto-appends workspace_id filter to database queries
 * This is a request-level marker; actual filtering happens at the query level
 */
function enforceMultiTenancy(req, res, next) {
  if (!req.user || !req.workspaceId) {
    return next();
  }

  // Store workspace context for use in handlers
  req.multiTenancyContext = {
    workspaceId: req.workspaceId,
    userId: req.user.id,
    role: req.workspaceMember ? req.workspaceMember.role : 'owner'
  };

  next();
}

/**
 * Switch workspace
 * POST /api/v1/workspace-switch/:workspaceId
 * Allows user to switch their current workspace
 */
function switchWorkspaceHandler(req, res) {
  const workspaceId = req.params.workspaceId;
  
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const workspace = getWorkspaces(null, workspaceId);
  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  const member = getWorkspaceMember(workspaceId, req.user.id);
  const isOwner = workspace.ownerId === req.user.id;

  if (!isOwner && !member) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Store in session
  if (req.session) {
    req.session.currentWorkspace = workspaceId;
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to switch workspace' });
      }
      res.json({
        success: true,
        workspace: workspace,
        message: 'Workspace switched successfully'
      });
    });
  } else {
    res.json({
      success: true,
      workspace: workspace,
      message: 'Workspace context set successfully'
    });
  }
}

module.exports = {
  requireWorkspaceAuth,
  requireRole,
  extractWorkspaceContext,
  enforceMultiTenancy,
  switchWorkspaceHandler
};
