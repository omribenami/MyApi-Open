/**
 * Admin Routes
 * Phase 6B: Protected admin endpoints for role and permission management
 * All endpoints require 'admin' role
 */

const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const logger = require('../utils/logger');

/**
 * Admin Routes Factory
 * @param {Database} db - Database instance
 * @param {Object} rbacMiddleware - RBAC middleware
 * @returns {Function} Express router
 */
function createAdminRoutes(db, rbacMiddleware) {
  /**
   * GET /admin/users
   * List all users with their roles in the workspace
   * Requires: admin role
   */
  router.get('/users', async (req, res) => {
    try {
      const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Workspace ID required'
        });
      }

      // Get all users in workspace
      const users = await db.all(
        `SELECT u.id, u.username, u.email, u.created_at
         FROM users u
         INNER JOIN user_roles ur ON u.id = ur.user_id
         WHERE ur.workspace_id = ?
         GROUP BY u.id
         ORDER BY u.created_at DESC`,
        [workspaceId]
      );

      // Get roles for each user
      const usersWithRoles = await Promise.all(
        users.map(async (user) => {
          const roles = await db.all(
            `SELECT r.id, r.name FROM roles r
             INNER JOIN user_roles ur ON r.id = ur.role_id
             WHERE ur.user_id = ? AND ur.workspace_id = ?`,
            [user.id, workspaceId]
          );
          return {
            ...user,
            roles: roles.map(r => ({ id: r.id, name: r.name }))
          };
        })
      );

      res.json({
        status: 'success',
        workspace: workspaceId,
        users: usersWithRoles,
        total: usersWithRoles.length
      });

    } catch (error) {
      logger.error('Failed to list users:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to list users'
      });
    }
  });

  /**
   * POST /admin/users/:userId/role
   * Assign user to a role
   * Body: { roleId: string }
   * Requires: admin role
   */
  router.post('/users/:userId/role', async (req, res) => {
    try {
      const { userId } = req.params;
      const { roleId } = req.body;
      const adminUserId = req.tokenData?.userId || req.session?.userId;
      const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

      if (!roleId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'roleId required'
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Workspace ID required'
        });
      }

      // Verify user exists
      const user = await db.get(`SELECT id FROM users WHERE id = ?`, [userId]);
      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      // Verify role exists in workspace
      const role = await db.get(
        `SELECT id FROM roles WHERE id = ? AND workspace_id = ?`,
        [roleId, workspaceId]
      );
      if (!role) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Role not found in workspace'
        });
      }

      // Check if user already has this role
      const existing = await db.get(
        `SELECT id FROM user_roles WHERE user_id = ? AND role_id = ? AND workspace_id = ?`,
        [userId, roleId, workspaceId]
      );

      if (existing) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'User already has this role'
        });
      }

      // Assign role
      const id = uuid();
      const createdAt = new Date().toISOString();
      await db.run(
        `INSERT INTO user_roles (id, user_id, role_id, workspace_id, created_at, assigned_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, userId, roleId, workspaceId, createdAt, adminUserId]
      );

      res.json({
        status: 'success',
        message: 'User assigned to role',
        assignment: {
          id,
          userId,
          roleId,
          workspaceId,
          createdAt,
          assignedBy: adminUserId
        }
      });

    } catch (error) {
      logger.error('Failed to assign user to role:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to assign user to role'
      });
    }
  });

  /**
   * DELETE /admin/users/:userId/role/:roleId
   * Remove user from role
   * Requires: admin role
   */
  router.delete('/users/:userId/role/:roleId', async (req, res) => {
    try {
      const { userId, roleId } = req.params;
      const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Workspace ID required'
        });
      }

      // Delete role assignment
      await db.run(
        `DELETE FROM user_roles WHERE user_id = ? AND role_id = ? AND workspace_id = ?`,
        [userId, roleId, workspaceId]
      );

      res.json({
        status: 'success',
        message: 'User removed from role',
        userId,
        roleId
      });

    } catch (error) {
      logger.error('Failed to remove user from role:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to remove user from role'
      });
    }
  });

  /**
   * GET /admin/roles
   * List all roles in workspace with their permissions
   * Requires: admin role
   */
  router.get('/roles', async (req, res) => {
    try {
      const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Workspace ID required'
        });
      }

      // Get all roles
      const roles = await db.all(
        `SELECT id, name, description FROM roles WHERE workspace_id = ? ORDER BY name`,
        [workspaceId]
      );

      // Get permissions for each role
      const rolesWithPermissions = await Promise.all(
        roles.map(async (role) => {
          const permissions = await db.all(
            `SELECT p.id, p.resource, p.action, p.description
             FROM permissions p
             INNER JOIN role_permissions rp ON p.id = rp.permission_id
             WHERE rp.role_id = ?
             ORDER BY p.resource, p.action`,
            [role.id]
          );
          return {
            ...role,
            permissions: permissions.map(p => ({
              id: p.id,
              name: `${p.resource}:${p.action}`,
              description: p.description
            }))
          };
        })
      );

      res.json({
        status: 'success',
        workspace: workspaceId,
        roles: rolesWithPermissions,
        total: rolesWithPermissions.length
      });

    } catch (error) {
      logger.error('Failed to list roles:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to list roles'
      });
    }
  });

  /**
   * POST /admin/roles/:roleId/permissions/:permissionId/grant
   * Grant permission to a role
   * Requires: admin role
   */
  router.post('/roles/:roleId/permissions/:permissionId/grant', async (req, res) => {
    try {
      const { roleId, permissionId } = req.params;
      const workspaceId = req.tokenData?.workspaceId || req.session?.workspaceId;

      if (!workspaceId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Workspace ID required'
        });
      }

      // Verify role exists in workspace
      const role = await db.get(
        `SELECT id FROM roles WHERE id = ? AND workspace_id = ?`,
        [roleId, workspaceId]
      );
      if (!role) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Role not found'
        });
      }

      // Verify permission exists
      const permission = await db.get(
        `SELECT id FROM permissions WHERE id = ?`,
        [permissionId]
      );
      if (!permission) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Permission not found'
        });
      }

      // Check if permission already granted
      const existing = await db.get(
        `SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?`,
        [roleId, permissionId]
      );

      if (existing) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Permission already granted to role'
        });
      }

      // Grant permission
      const id = uuid();
      const createdAt = new Date().toISOString();
      await db.run(
        `INSERT INTO role_permissions (id, role_id, permission_id, created_at)
         VALUES (?, ?, ?, ?)`,
        [id, roleId, permissionId, createdAt]
      );

      res.json({
        status: 'success',
        message: 'Permission granted to role',
        grant: {
          id,
          roleId,
          permissionId,
          createdAt
        }
      });

    } catch (error) {
      logger.error('Failed to grant permission:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to grant permission'
      });
    }
  });

  /**
   * DELETE /admin/roles/:roleId/permissions/:permissionId
   * Revoke permission from role
   * Requires: admin role
   */
  router.delete('/roles/:roleId/permissions/:permissionId', async (req, res) => {
    try {
      const { roleId, permissionId } = req.params;

      await db.run(
        `DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?`,
        [roleId, permissionId]
      );

      res.json({
        status: 'success',
        message: 'Permission revoked from role',
        roleId,
        permissionId
      });

    } catch (error) {
      logger.error('Failed to revoke permission:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to revoke permission'
      });
    }
  });

  /**
   * GET /admin/permissions
   * List all available permissions
   * Requires: admin role
   */
  router.get('/permissions', async (req, res) => {
    try {
      const permissions = await db.all(
        `SELECT id, resource, action, description FROM permissions ORDER BY resource, action`
      );

      res.json({
        status: 'success',
        permissions: permissions.map(p => ({
          id: p.id,
          name: `${p.resource}:${p.action}`,
          description: p.description
        })),
        total: permissions.length
      });

    } catch (error) {
      logger.error('Failed to list permissions:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to list permissions'
      });
    }
  });

  return router;
}

module.exports = createAdminRoutes;
