/**
 * Test Suite: Database Migrations
 * 
 * Verifies that:
 * 1. Migration system initializes correctly
 * 2. Pending migrations run successfully
 * 3. Migration tracking works
 * 4. SSO/RBAC tables are created with proper schema
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const MigrationRunner = require('../lib/migrationRunner');

// Use test database
const testDbPath = path.join(__dirname, '../db.test.sqlite');

function cleanup() {
  try {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
    if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
  } catch (e) {}
}

async function testMigrations() {
  console.log('\n=== Testing Database Migrations ===\n');

  cleanup();

  try {
    // 1. Create test database with minimal schema
    console.log('[Test] Creating test database...');
    const db = new Database(testDbPath);
    db.pragma('journal_mode = WAL');

    // Create prerequisite tables that migrations depend on
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // 2. Test MigrationRunner initialization
    console.log('[Test] Initializing migration runner...');
    const runner = new MigrationRunner(db);
    runner.initMigrationTable();

    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'").get();
    if (!tableCheck) {
      throw new Error('Migrations table was not created');
    }
    console.log('✓ Migrations table created successfully');

    // 3. Get pending migrations
    console.log('[Test] Checking for pending migrations...');
    const pending = runner.getPendingMigrations();
    console.log(`✓ Found ${pending.length} pending migration(s):`, pending);

    // 4. Run migrations
    console.log('[Test] Running migrations...');
    const result = runner.runPendingMigrations();
    console.log(`✓ ${result.message}`);

    if (!result.success) {
      console.error('✗ Some migrations failed:');
      result.failed.forEach(f => {
        console.error(`  - ${f.filename}: ${f.error}`);
      });
      throw new Error('Migration execution failed');
    }

    // 5. Verify SSO/RBAC tables exist
    console.log('[Test] Verifying SSO/RBAC tables...');
    const requiredTables = [
      'roles',
      'permissions',
      'role_permissions',
      'user_roles',
      'sso_configurations',
      'sso_sessions',
      'saml_assertions',
      'oidc_tokens'
    ];

    const existingTables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name IN (${requiredTables.map(() => '?').join(',')})
    `).all(...requiredTables);

    const existingTableNames = new Set(existingTables.map(t => t.name));
    for (const table of requiredTables) {
      if (!existingTableNames.has(table)) {
        throw new Error(`Required table '${table}' not found`);
      }
      console.log(`  ✓ Table '${table}' exists`);
    }

    // 6. Verify roles table structure
    console.log('[Test] Verifying roles table schema...');
    const rolesSchema = db.prepare("PRAGMA table_info(roles)").all();
    const roleColumns = new Set(rolesSchema.map(col => col.name));
    const requiredRoleColumns = ['id', 'workspace_id', 'name', 'description', 'created_at', 'updated_at'];
    for (const col of requiredRoleColumns) {
      if (!roleColumns.has(col)) {
        throw new Error(`roles table missing column: ${col}`);
      }
      console.log(`  ✓ Column '${col}' exists`);
    }

    // 7. Verify permissions table structure
    console.log('[Test] Verifying permissions table schema...');
    const permsSchema = db.prepare("PRAGMA table_info(permissions)").all();
    const permColumns = new Set(permsSchema.map(col => col.name));
    const requiredPermColumns = ['id', 'resource', 'action', 'description', 'created_at'];
    for (const col of requiredPermColumns) {
      if (!permColumns.has(col)) {
        throw new Error(`permissions table missing column: ${col}`);
      }
      console.log(`  ✓ Column '${col}' exists`);
    }

    // 8. Verify user_roles table structure
    console.log('[Test] Verifying user_roles table schema...');
    const userRolesSchema = db.prepare("PRAGMA table_info(user_roles)").all();
    const urColumns = new Set(userRolesSchema.map(col => col.name));
    const requiredURColumns = ['id', 'user_id', 'role_id', 'workspace_id', 'created_at'];
    for (const col of requiredURColumns) {
      if (!urColumns.has(col)) {
        throw new Error(`user_roles table missing column: ${col}`);
      }
      console.log(`  ✓ Column '${col}' exists`);
    }

    // 9. Verify SSO configurations table structure
    console.log('[Test] Verifying sso_configurations table schema...');
    const ssoConfigSchema = db.prepare("PRAGMA table_info(sso_configurations)").all();
    const ssoConfigColumns = new Set(ssoConfigSchema.map(col => col.name));
    const requiredSSOColumns = ['id', 'workspace_id', 'provider', 'config', 'active', 'created_at', 'updated_at'];
    for (const col of requiredSSOColumns) {
      if (!ssoConfigColumns.has(col)) {
        throw new Error(`sso_configurations table missing column: ${col}`);
      }
      console.log(`  ✓ Column '${col}' exists`);
    }

    // 10. Verify indexes are created
    console.log('[Test] Verifying indexes...');
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").all();
    console.log(`✓ Found ${indexes.length} indexes created by migrations`);
    const indexNames = indexes.map(idx => idx.name);
    const criticalIndexes = [
      'idx_roles_workspace_id',
      'idx_user_roles_user_id',
      'idx_user_roles_workspace_id',
      'idx_sso_configurations_workspace_id'
    ];
    for (const idx of criticalIndexes) {
      if (!indexNames.includes(idx)) {
        console.warn(`  ⚠ Critical index missing: ${idx}`);
      } else {
        console.log(`  ✓ Index '${idx}' exists`);
      }
    }

    // 11. Verify no pending migrations remain
    console.log('[Test] Checking for remaining pending migrations...');
    const remaining = runner.getPendingMigrations();
    if (remaining.length > 0) {
      throw new Error(`Pending migrations remain: ${remaining.join(', ')}`);
    }
    console.log('✓ No pending migrations');

    // 12. Verify applied migrations were recorded
    console.log('[Test] Verifying migration tracking...');
    const applied = runner.getAppliedMigrations();
    console.log(`✓ Migration record shows ${applied.length} applied migration(s)`);

    db.close();

    console.log('\n✓ All migration tests passed!\n');
    return true;

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    cleanup();
  }
}

// Run tests
if (require.main === module) {
  testMigrations().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { testMigrations };
