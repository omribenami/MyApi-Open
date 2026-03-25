/**
 * Multi-Tenancy Middleware
 * Phase 1: Teams & Multi-Tenancy
 * Ensures all requests are scoped to the user's current workspace
 * Enhanced with tenant-level isolation and API key support
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
  // Resolve the effective user ID — works for both session auth (req.user.id)
  // and Bearer token auth (req.tokenMeta.ownerId).
  const userId = req.user?.id || req.tokenMeta?.ownerId;

  if (!userId) {
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
    // Get user's workspaces and use the first one (owner workspace).
    // For legacy 'owner' tokens (bootstrap), skip the DB lookup to avoid
    // spurious "user not found" errors.
    if (userId !== 'owner') {
      const userWorkspaces = getWorkspaces(String(userId));
      if (userWorkspaces && userWorkspaces.length > 0) {
        workspaceId = userWorkspaces[0].id;
      }
    }
  }

  if (workspaceId) {
    const workspace = getWorkspaces(null, workspaceId);
    if (workspace) {
      const member = getWorkspaceMember(workspaceId, String(userId));
      const isOwner = String(workspace.ownerId) === String(userId);

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
 * Extract tenant context from API key or header
 * Supports tenant identification via:
 * 1. X-Tenant-ID header
 * 2. Tenant API key (myapi_xxx prefix)
 * 3. Subdomain parsing (tenant-slug.api.example.com)
 */
function extractTenantContext(tenantManager) {
  return (req, res, next) => {
    let tenantId = null;

    // 1. Check X-Tenant-ID header
    if (req.headers['x-tenant-id']) {
      tenantId = req.headers['x-tenant-id'];
    }

    // 2. Check for tenant API key in Authorization header
    const authHeader = req.headers.authorization;
    if (!tenantId && authHeader && authHeader.startsWith('Bearer myapi_')) {
      const apiKey = authHeader.substring(7);
      try {
        const tenantContext = tenantManager.validateApiKey(apiKey);
        if (tenantContext) {
          req.tenantContext = tenantContext;
          req.tenantId = tenantContext.tenantId;
          return next();
        }
      } catch {
        // Invalid key — continue without tenant context
      }
    }

    // 3. Check subdomain (only for expected domain patterns)
    if (!tenantId) {
      const host = req.hostname || req.headers.host || '';
      // Strip port if present
      const hostWithoutPort = host.split(':')[0];
      const parts = hostWithoutPort.split('.');
      // Only parse subdomains from hosts with 3+ parts (sub.domain.tld)
      // and validate the host looks like a real domain (not IP addresses)
      if (parts.length >= 3 && !/^\d+\.\d+\.\d+\.\d+$/.test(hostWithoutPort)) {
        const subdomain = parts[0];
        // Only treat as tenant slug if not common subdomains
        if (!['www', 'api', 'app', 'admin', 'mail', 'localhost'].includes(subdomain)) {
          try {
            const tenant = tenantManager.getTenantBySlug(subdomain);
            if (tenant) {
              tenantId = tenant.id;
            }
          } catch {
            // Tenant lookup failed — continue
          }
        }
      }
    }

    // Set tenant context if found
    if (tenantId) {
      try {
        const tenant = tenantManager.getTenant(tenantId);
        if (tenant && tenant.status === 'active') {
          req.tenantId = tenant.id;
          req.tenantContext = {
            tenantId: tenant.id,
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            plan: tenant.plan
          };
        }
      } catch {
        // Tenant lookup failed — continue without tenant context
      }
    }

    next();
  };
}

/**
 * Require tenant context
 * Rejects requests that don't have a valid tenant context
 */
function requireTenantContext(req, res, next) {
  if (!req.tenantId && !req.tenantContext) {
    return res.status(400).json({
      error: 'Tenant context required',
      message: 'Provide X-Tenant-ID header, tenant API key, or use a tenant subdomain'
    });
  }

  next();
}

/**
 * Check tenant plan limits
 * Verifies the tenant hasn't exceeded their plan limits
 */
function checkTenantLimits(tenantManager, resource) {
  return (req, res, next) => {
    if (!req.tenantId) {
      return next();
    }

    try {
      const stats = tenantManager.getTenantStats(req.tenantId);
      if (!stats) return next();

      if (resource === 'users' && stats.users.max !== -1 && stats.users.current >= stats.users.max) {
        return res.status(403).json({
          error: 'Plan limit reached',
          message: `User limit (${stats.users.max}) reached for your plan. Upgrade to add more users.`,
          currentPlan: stats.plan
        });
      }

      if (resource === 'workspaces' && stats.workspaces.max !== -1 && stats.workspaces.current >= stats.workspaces.max) {
        return res.status(403).json({
          error: 'Plan limit reached',
          message: `Workspace limit (${stats.workspaces.max}) reached for your plan. Upgrade to add more workspaces.`,
          currentPlan: stats.plan
        });
      }
    } catch {
      // Non-fatal — allow request to proceed
    }

    next();
  };
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
  extractTenantContext,
  requireTenantContext,
  checkTenantLimits,
  switchWorkspaceHandler
};
