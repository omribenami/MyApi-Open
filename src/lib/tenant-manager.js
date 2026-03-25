/**
 * Tenant Manager
 * Handles tenant provisioning, configuration, and lifecycle management
 * Scales the existing workspace system to full multi-tenant support
 */

const crypto = require('crypto');

class TenantManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Initialize tenant management tables
   */
  initTenantTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        plan TEXT NOT NULL DEFAULT 'free',
        status TEXT NOT NULL DEFAULT 'active',
        owner_id TEXT,
        settings TEXT DEFAULT '{}',
        domain TEXT,
        max_users INTEGER DEFAULT 5,
        max_workspaces INTEGER DEFAULT 3,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        suspended_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tenant_environments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'production',
        config TEXT DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        UNIQUE(tenant_id, slug)
      );

      CREATE TABLE IF NOT EXISTS tenant_api_keys (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        environment_id TEXT,
        key_hash TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        label TEXT NOT NULL,
        scopes TEXT DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        last_used_at TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
      CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
      CREATE INDEX IF NOT EXISTS idx_tenant_environments_tenant ON tenant_environments(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant ON tenant_api_keys(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_hash ON tenant_api_keys(key_hash);
    `);
  }

  /**
   * Generate a unique tenant ID
   */
  _generateId(prefix = 'ten') {
    return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
  }

  /**
   * Create a new tenant
   */
  createTenant({ name, slug, plan = 'free', ownerId = null, domain = null, settings = {} }) {
    if (!name || !slug) {
      throw new Error('Tenant name and slug are required');
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
    if (!slugRegex.test(slug)) {
      throw new Error('Slug must be 3-50 characters, lowercase alphanumeric with hyphens, no leading/trailing hyphens');
    }

    // Check uniqueness
    const existing = this.db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
    if (existing) {
      throw new Error(`Tenant with slug "${slug}" already exists`);
    }

    const id = this._generateId('ten');
    const now = new Date().toISOString();

    const planLimits = {
      free: { maxUsers: 5, maxWorkspaces: 3 },
      starter: { maxUsers: 25, maxWorkspaces: 10 },
      business: { maxUsers: 100, maxWorkspaces: 50 },
      enterprise: { maxUsers: -1, maxWorkspaces: -1 } // unlimited
    };

    const limits = planLimits[plan] || planLimits.free;

    this.db.prepare(`
      INSERT INTO tenants (id, name, slug, plan, status, owner_id, settings, domain, max_users, max_workspaces, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, slug, plan, ownerId,
      JSON.stringify(settings), domain,
      limits.maxUsers, limits.maxWorkspaces,
      now, now
    );

    // Create default production environment
    this.createEnvironment(id, {
      name: 'Production',
      slug: 'production',
      type: 'production'
    });

    return this.getTenant(id);
  }

  /**
   * Get tenant by ID
   */
  getTenant(tenantId) {
    const tenant = this.db.prepare('SELECT * FROM tenants WHERE id = ? AND deleted_at IS NULL').get(tenantId);
    if (!tenant) return null;

    tenant.settings = JSON.parse(tenant.settings || '{}');
    tenant.environments = this.listEnvironments(tenantId);
    return tenant;
  }

  /**
   * Get tenant by slug
   */
  getTenantBySlug(slug) {
    const tenant = this.db.prepare('SELECT * FROM tenants WHERE slug = ? AND deleted_at IS NULL').get(slug);
    if (!tenant) return null;

    tenant.settings = JSON.parse(tenant.settings || '{}');
    tenant.environments = this.listEnvironments(tenant.id);
    return tenant;
  }

  /**
   * List all active tenants
   */
  listTenants({ status = 'active', limit = 50, offset = 0 } = {}) {
    let query = 'SELECT * FROM tenants WHERE deleted_at IS NULL';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const tenants = this.db.prepare(query).all(...params);
    return tenants.map(t => {
      t.settings = JSON.parse(t.settings || '{}');
      return t;
    });
  }

  /**
   * Update tenant details
   */
  updateTenant(tenantId, updates) {
    const allowed = ['name', 'plan', 'status', 'domain', 'settings', 'max_users', 'max_workspaces'];
    const sets = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key)) {
        sets.push(`${key} = ?`);
        params.push(key === 'settings' ? JSON.stringify(value) : value);
      }
    }

    if (sets.length === 0) return null;

    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(tenantId);

    this.db.prepare(`UPDATE tenants SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getTenant(tenantId);
  }

  /**
   * Suspend a tenant
   */
  suspendTenant(tenantId, reason) {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE tenants SET status = 'suspended', suspended_at = ?, 
        settings = json_set(COALESCE(settings, '{}'), '$.suspensionReason', ?),
        updated_at = ?
      WHERE id = ?
    `).run(now, reason || 'Administrative action', now, tenantId);
    return this.getTenant(tenantId);
  }

  /**
   * Reactivate a suspended tenant
   */
  reactivateTenant(tenantId) {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE tenants SET status = 'active', suspended_at = NULL, updated_at = ?
      WHERE id = ?
    `).run(now, tenantId);
    return this.getTenant(tenantId);
  }

  /**
   * Soft-delete a tenant
   */
  deleteTenant(tenantId) {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE tenants SET status = 'deleted', deleted_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, tenantId);
    return { deleted: true, tenantId, deletedAt: now };
  }

  /**
   * Create an environment for a tenant
   */
  createEnvironment(tenantId, { name, slug, type = 'production', config = {} }) {
    const id = this._generateId('env');
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO tenant_environments (id, tenant_id, name, slug, type, config, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(id, tenantId, name, slug, type, JSON.stringify(config), now, now);

    return { id, tenantId, name, slug, type, config, status: 'active', createdAt: now };
  }

  /**
   * List environments for a tenant
   */
  listEnvironments(tenantId) {
    const envs = this.db.prepare(
      'SELECT * FROM tenant_environments WHERE tenant_id = ? AND status != ? ORDER BY type, name'
    ).all(tenantId, 'deleted');

    return envs.map(e => {
      e.config = JSON.parse(e.config || '{}');
      return e;
    });
  }

  /**
   * Delete an environment
   */
  deleteEnvironment(environmentId) {
    const now = new Date().toISOString();
    this.db.prepare(
      'UPDATE tenant_environments SET status = ?, updated_at = ? WHERE id = ?'
    ).run('deleted', now, environmentId);
    return { deleted: true, environmentId };
  }

  /**
   * Generate an API key for a tenant
   */
  generateApiKey(tenantId, { label, scopes = ['*'], environmentId = null, expiresInDays = null }) {
    const rawKey = `myapi_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    const id = this._generateId('key');
    const now = new Date().toISOString();
    let expiresAt = null;

    if (expiresInDays) {
      const exp = new Date();
      exp.setDate(exp.getDate() + expiresInDays);
      expiresAt = exp.toISOString();
    }

    this.db.prepare(`
      INSERT INTO tenant_api_keys (id, tenant_id, environment_id, key_hash, key_prefix, label, scopes, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(id, tenantId, environmentId, keyHash, keyPrefix, label, JSON.stringify(scopes), expiresAt, now);

    return {
      id,
      key: rawKey,
      keyPrefix,
      label,
      scopes,
      expiresAt,
      note: 'Save this key — it will only be shown once'
    };
  }

  /**
   * Validate an API key and return tenant context
   */
  validateApiKey(rawKey) {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = this.db.prepare(`
      SELECT ak.*, t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug, 
             t.status as tenant_status, t.plan as tenant_plan
      FROM tenant_api_keys ak
      JOIN tenants t ON ak.tenant_id = t.id
      WHERE ak.key_hash = ? AND ak.status = 'active'
    `).get(keyHash);

    if (!apiKey) return null;

    // Check expiry
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return null;
    }

    // Check tenant is active
    if (apiKey.tenant_status !== 'active') {
      return null;
    }

    // Update last used
    this.db.prepare('UPDATE tenant_api_keys SET last_used_at = ? WHERE id = ?')
      .run(new Date().toISOString(), apiKey.id);

    return {
      keyId: apiKey.id,
      tenantId: apiKey.tenant_id,
      tenantName: apiKey.tenant_name,
      tenantSlug: apiKey.tenant_slug,
      plan: apiKey.tenant_plan,
      scopes: JSON.parse(apiKey.scopes || '[]'),
      environmentId: apiKey.environment_id,
      label: apiKey.label
    };
  }

  /**
   * Revoke an API key
   */
  revokeApiKey(keyId) {
    this.db.prepare('UPDATE tenant_api_keys SET status = ? WHERE id = ?').run('revoked', keyId);
    return { revoked: true, keyId };
  }

  /**
   * Get tenant usage statistics
   */
  getTenantStats(tenantId) {
    const tenant = this.getTenant(tenantId);
    if (!tenant) return null;

    // Count related resources via workspaces
    let workspaceCount = 0;
    let memberCount = 0;

    try {
      const ws = this.db.prepare(
        'SELECT COUNT(*) as count FROM workspaces WHERE tenant_id = ?'
      ).get(tenantId);
      workspaceCount = ws ? ws.count : 0;
    } catch (err) {
      // Silently handle missing tenant_id column or missing table
      if (!err.message || (!err.message.includes('no such column') && !err.message.includes('no such table'))) {
        console.warn('[TenantManager] Unexpected error counting workspaces:', err.message);
      }
    }

    try {
      const members = this.db.prepare(
        'SELECT COUNT(DISTINCT user_id) as count FROM workspace_members WHERE workspace_id IN (SELECT id FROM workspaces WHERE tenant_id = ?)'
      ).get(tenantId);
      memberCount = members ? members.count : 0;
    } catch (err) {
      // Silently handle missing tables or columns
      if (!err.message || (!err.message.includes('no such column') && !err.message.includes('no such table'))) {
        console.warn('[TenantManager] Unexpected error counting members:', err.message);
      }
    }

    const apiKeys = this.db.prepare(
      'SELECT COUNT(*) as count FROM tenant_api_keys WHERE tenant_id = ? AND status = ?'
    ).get(tenantId, 'active');

    const environments = this.listEnvironments(tenantId);

    return {
      tenantId,
      plan: tenant.plan,
      workspaces: {
        current: workspaceCount,
        max: tenant.max_workspaces
      },
      users: {
        current: memberCount,
        max: tenant.max_users
      },
      apiKeys: apiKeys ? apiKeys.count : 0,
      environments: environments.length
    };
  }
}

module.exports = TenantManager;
