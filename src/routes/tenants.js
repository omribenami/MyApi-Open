/**
 * Tenant Management Routes
 * Multi-tenant provisioning and management API
 * Requires admin authentication
 */

const express = require('express');
const router = express.Router();
const TenantManager = require('../lib/tenant-manager');

/**
 * Tenant Routes Factory
 * @param {Object} db - Database instance (must have .db for raw connection)
 * @returns {Router} Express router
 */
function createTenantRoutes(db) {
  const rawDb = db.db || db;
  const manager = new TenantManager(rawDb);

  // Initialize tenant tables on first use
  try {
    manager.initTenantTables();
  } catch {
    // Tables may already exist
  }

  /**
   * POST /tenants
   * Create a new tenant
   * Body: { name, slug, plan?, domain? }
   */
  router.post('/', (req, res) => {
    try {
      const { name, slug, plan, domain } = req.body || {};
      const ownerId = req.tokenData?.userId || req.session?.userId;

      if (!name || !slug) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'name and slug are required'
        });
      }

      const tenant = manager.createTenant({
        name,
        slug,
        plan: plan || 'free',
        domain: domain || null,
        ownerId
      });

      res.status(201).json({
        status: 'success',
        tenant
      });
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('Slug must be')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create tenant'
      });
    }
  });

  /**
   * GET /tenants
   * List tenants
   * Query: ?status=active&limit=50&offset=0
   */
  router.get('/', (req, res) => {
    try {
      const status = req.query.status || null;
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = parseInt(req.query.offset || '0', 10);

      const tenants = manager.listTenants({ status, limit, offset });

      res.json({
        status: 'success',
        total: tenants.length,
        tenants
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to list tenants'
      });
    }
  });

  /**
   * GET /tenants/:id
   * Get tenant details
   */
  router.get('/:id', (req, res) => {
    try {
      const { id } = req.params;
      const tenant = id.startsWith('ten_')
        ? manager.getTenant(id)
        : manager.getTenantBySlug(id);

      if (!tenant) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Tenant not found'
        });
      }

      res.json({ status: 'success', tenant });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get tenant'
      });
    }
  });

  /**
   * PATCH /tenants/:id
   * Update tenant details
   * Body: { name?, plan?, domain?, settings? }
   */
  router.patch('/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body || {};

      const tenant = manager.updateTenant(id, updates);
      if (!tenant) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Tenant not found or no valid updates'
        });
      }

      res.json({ status: 'success', tenant });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update tenant'
      });
    }
  });

  /**
   * POST /tenants/:id/suspend
   * Suspend a tenant
   * Body: { reason? }
   */
  router.post('/:id/suspend', (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};

      const tenant = manager.suspendTenant(id, reason);
      if (!tenant) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Tenant not found'
        });
      }

      res.json({
        status: 'success',
        message: 'Tenant suspended',
        tenant
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to suspend tenant'
      });
    }
  });

  /**
   * POST /tenants/:id/reactivate
   * Reactivate a suspended tenant
   */
  router.post('/:id/reactivate', (req, res) => {
    try {
      const { id } = req.params;
      const tenant = manager.reactivateTenant(id);

      if (!tenant) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Tenant not found'
        });
      }

      res.json({
        status: 'success',
        message: 'Tenant reactivated',
        tenant
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to reactivate tenant'
      });
    }
  });

  /**
   * DELETE /tenants/:id
   * Soft-delete a tenant
   */
  router.delete('/:id', (req, res) => {
    try {
      const { id } = req.params;
      const result = manager.deleteTenant(id);

      res.json({
        status: 'success',
        message: 'Tenant deleted',
        ...result
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete tenant'
      });
    }
  });

  /**
   * GET /tenants/:id/stats
   * Get tenant usage statistics
   */
  router.get('/:id/stats', (req, res) => {
    try {
      const { id } = req.params;
      const stats = manager.getTenantStats(id);

      if (!stats) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Tenant not found'
        });
      }

      res.json({ status: 'success', ...stats });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get tenant stats'
      });
    }
  });

  /**
   * POST /tenants/:id/environments
   * Create an environment for a tenant
   * Body: { name, slug, type? }
   */
  router.post('/:id/environments', (req, res) => {
    try {
      const { id } = req.params;
      const { name, slug, type } = req.body || {};

      if (!name || !slug) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'name and slug are required'
        });
      }

      const env = manager.createEnvironment(id, {
        name,
        slug,
        type: type || 'production'
      });

      res.status(201).json({
        status: 'success',
        environment: env
      });
    } catch (error) {
      if (error.message && error.message.includes('UNIQUE constraint')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Environment slug already exists for this tenant'
        });
      }
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create environment'
      });
    }
  });

  /**
   * GET /tenants/:id/environments
   * List environments for a tenant
   */
  router.get('/:id/environments', (req, res) => {
    try {
      const { id } = req.params;
      const environments = manager.listEnvironments(id);

      res.json({
        status: 'success',
        total: environments.length,
        environments
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to list environments'
      });
    }
  });

  /**
   * POST /tenants/:id/api-keys
   * Generate an API key for a tenant
   * Body: { label, expiresInDays? }
   */
  router.post('/:id/api-keys', (req, res) => {
    try {
      const { id } = req.params;
      const { label, expiresInDays, environmentId } = req.body || {};

      if (!label) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'label is required'
        });
      }

      const result = manager.generateApiKey(id, {
        label,
        expiresInDays: expiresInDays || null,
        environmentId: environmentId || null
      });

      res.status(201).json({
        status: 'success',
        apiKey: result
      });
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to generate API key'
      });
    }
  });

  return router;
}

module.exports = createTenantRoutes;
