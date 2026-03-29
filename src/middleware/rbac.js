/**
 * RBAC Middleware - Role-Based Access Control
 * Phase 6B: Enforces role-based access control and auditLogs all permission checks
 */

const { v4: uuid } = require('uuid');

/**
 * RBAC Middleware Factory - creates middleware with database reference
 * @param {Database} db - Database instance
 * @returns {Object} Middleware functions
 */
function createRBACMiddleware(db) {
  /**
   * Middleware: Check user has required role
   * Admin role bypasses all checks
   * @param {Array<string>} requiredRoles - Array of role names
   * @returns {Function} Express middleware
   */
  function requireRole(requiredRoles = []) {
    return async (req, res, next) => {
      try {
        // Extract user from token/session
        const userId = req.tokenData?.userId || req.session?.userId;
        const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

        if (!userId) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User ID not found in session'
          });
        }

        if (!workspaceId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Workspace ID not found in session'
          });
        }

        // Get user roles in this workspace
        const userRoles = await db.all(
          `SELECT r.name, r.id FROM roles r
           INNER JOIN user_roles ur ON r.id = ur.role_id
           WHERE ur.user_id = ? AND ur.workspace_id = ?`,
          [userId, workspaceId]
        );

        const roleNames = userRoles.map(r => r.name);

        // Check if user has 'admin' role - admin bypasses all checks
        if (roleNames.includes('admin')) {
          // Log successful access
          await createAuditLog(db, {
            userId,
            action: 'role_check',
            resource: req.path,
            requiredRoles: requiredRoles.join(','),
            userRoles: roleNames.join(','),
            granted: true,
            ipAddress: req.ip,
            workspaceId
          });
          return next();
        }

        // Check if user has any of the required roles
        const hasRequiredRole = requiredRoles.some(role => roleNames.includes(role));

        if (!hasRequiredRole) {
          // Log failed access
          await createAuditLog(db, {
            userId,
            action: 'role_check',
            resource: req.path,
            requiredRoles: requiredRoles.join(','),
            userRoles: roleNames.join(','),
            granted: false,
            ipAddress: req.ip,
            workspaceId
          });

          return res.status(403).json({
            error: 'Forbidden',
            message: `User does not have required role(s): ${requiredRoles.join(', ')}`
          });
        }

        // Log successful access
        await createAuditLog(db, {
          userId,
          action: 'role_check',
          resource: req.path,
          requiredRoles: requiredRoles.join(','),
          userRoles: roleNames.join(','),
          granted: true,
          ipAddress: req.ip,
          workspaceId
        });

        next();
      } catch (error) {
        console.error('RBAC: Error in requireRole middleware', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Role check failed'
        });
      }
    };
  }

  /**
   * Middleware: Check user has specific permission
   * @param {string} permission - Permission in format "resource:action" (e.g., "code:review")
   * @returns {Function} Express middleware
   */
  function requirePermission(permission) {
    return async (req, res, next) => {
      try {
        const userId = req.tokenData?.userId || req.session?.userId;
        const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

        if (!userId || !workspaceId) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'User not authenticated'
          });
        }

        // Parse permission: "resource:action"
        const [resource, action] = permission.split(':');

        // Get permission ID
        const perm = await db.get(
          `SELECT id FROM permissions WHERE resource = ? AND action = ?`,
          [resource, action]
        );

        if (!perm) {
          // Permission doesn't exist yet
          await createAuditLog(db, {
            userId,
            action: 'permission_check',
            resource: req.path,
            permission,
            granted: false,
            ipAddress: req.ip,
            workspaceId,
            details: 'Permission not defined'
          });

          return res.status(403).json({
            error: 'Forbidden',
            message: 'Permission not defined'
          });
        }

        // Get user roles in workspace
        const userRoles = await db.all(
          `SELECT ur.role_id FROM user_roles ur
           WHERE ur.user_id = ? AND ur.workspace_id = ?`,
          [userId, workspaceId]
        );

        const roleIds = userRoles.map(r => r.role_id);

        if (roleIds.length === 0) {
          await createAuditLog(db, {
            userId,
            action: 'permission_check',
            resource: req.path,
            permission,
            granted: false,
            ipAddress: req.ip,
            workspaceId,
            details: 'No roles assigned'
          });

          return res.status(403).json({
            error: 'Forbidden',
            message: 'User has no roles in this workspace'
          });
        }

        // Check if any user role has this permission
        const hasPermission = await db.get(
          `SELECT rp.id FROM role_permissions rp
           WHERE rp.role_id IN (${roleIds.map(() => '?').join(',')})
           AND rp.permission_id = ?`,
          [...roleIds, perm.id]
        );

        if (!hasPermission) {
          await createAuditLog(db, {
            userId,
            action: 'permission_check',
            resource: req.path,
            permission,
            granted: false,
            ipAddress: req.ip,
            workspaceId
          });

          return res.status(403).json({
            error: 'Forbidden',
            message: `User does not have permission: ${permission}`
          });
        }

        // Log successful permission check
        await createAuditLog(db, {
          userId,
          action: 'permission_check',
          resource: req.path,
          permission,
          granted: true,
          ipAddress: req.ip,
          workspaceId
        });

        next();
      } catch (error) {
        console.error('RBAC: Error in requirePermission middleware', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Permission check failed'
        });
      }
    };
  }

  /**
   * Middleware: Log all RBAC checks to audit_logs
   * @param {string} action - Action being audited
   * @returns {Function} Express middleware
   */
  function auditLog(action) {
    return async (req, res, next) => {
      try {
        const userId = req.tokenData?.userId || req.session?.userId;
        const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

        // Store audit log entry
        await createAuditLog(db, {
          userId,
          action,
          resource: req.path,
          method: req.method,
          ipAddress: req.ip,
          workspaceId,
          userAgent: req.get('user-agent')
        });

        next();
      } catch (error) {
        console.error('RBAC: Error in auditLog middleware', error);
        next(); // Continue even if audit fails
      }
    };
  }

  return {
    requireRole,
    requirePermission,
    auditLog
  };
}

/**
 * Helper: Create audit log entry
 * @param {Database} db - Database instance
 * @param {Object} entry - Audit log entry
 */
async function createAuditLog(db, entry) {
  try {
    const id = entry.id || uuid();
    const timestamp = new Date().toISOString();

    await db.run(
      `INSERT INTO audit_log (
        id, user_id, action, resource, granted, timestamp, ip_address, 
        method, user_agent, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.userId || null,
        entry.action,
        entry.resource || entry.permission || null,
        entry.granted !== undefined ? (entry.granted ? 1 : 0) : null,
        timestamp,
        entry.ipAddress || null,
        entry.method || null,
        entry.userAgent || null,
        entry.details || JSON.stringify({
          requiredRoles: entry.requiredRoles,
          userRoles: entry.userRoles,
          permission: entry.permission,
          workspaceId: entry.workspaceId
        })
      ]
    );
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    // Don't throw - audit failures shouldn't break the app
  }
}

/**
 * Helper functions for role and permission management
 */
const roleManagement = {
  /**
   * Get all roles in a workspace
   */
  async getRoles(db, workspaceId) {
    return db.all(
      `SELECT id, name, description FROM roles WHERE workspace_id = ? ORDER BY name`,
      [workspaceId]
    );
  },

  /**
   * Get user roles in a workspace
   */
  async getUserRoles(db, userId, workspaceId) {
    return db.all(
      `SELECT r.id, r.name FROM roles r
       INNER JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ? AND ur.workspace_id = ?`,
      [userId, workspaceId]
    );
  },

  /**
   * Assign user to a role
   */
  async assignUserToRole(db, userId, roleId, workspaceId, assignedByUserId) {
    const id = uuid();
    const createdAt = new Date().toISOString();

    await db.run(
      `INSERT INTO user_roles (id, user_id, role_id, workspace_id, created_at, assigned_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, role_id, workspace_id) DO UPDATE SET
         assigned_by_user_id = excluded.assigned_by_user_id`,
      [id, userId, roleId, workspaceId, createdAt, assignedByUserId]
    );

    return { id, userId, roleId, workspaceId, createdAt };
  },

  /**
   * Remove user from role
   */
  async removeUserFromRole(db, userId, roleId, workspaceId) {
    await db.run(
      `DELETE FROM user_roles WHERE user_id = ? AND role_id = ? AND workspace_id = ?`,
      [userId, roleId, workspaceId]
    );
  },

  /**
   * Get all permissions
   */
  async getPermissions(db) {
    return db.all(
      `SELECT id, resource, action, description FROM permissions ORDER BY resource, action`
    );
  },

  /**
   * Get permissions for a role
   */
  async getRolePermissions(db, roleId) {
    return db.all(
      `SELECT p.id, p.resource, p.action FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ? ORDER BY p.resource, p.action`,
      [roleId]
    );
  },

  /**
   * Grant permission to role
   */
  async grantPermissionToRole(db, roleId, permissionId) {
    const id = uuid();
    const createdAt = new Date().toISOString();

    await db.run(
      `INSERT INTO role_permissions (id, role_id, permission_id, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (role_id, permission_id) DO UPDATE SET created_at = excluded.created_at`,
      [id, roleId, permissionId, createdAt]
    );

    return { id, roleId, permissionId, createdAt };
  },

  /**
   * Revoke permission from role
   */
  async revokePermissionFromRole(db, roleId, permissionId) {
    await db.run(
      `DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?`,
      [roleId, permissionId]
    );
  }
};

module.exports = {
  createRBACMiddleware,
  roleManagement,
  createAuditLog
};
