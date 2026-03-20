# Database Migrations

This directory contains all database schema migrations for MyApi.

## Overview

MyApi uses a file-based migration system that:
- Tracks applied migrations in the `migrations` table
- Automatically runs pending migrations on startup
- Supports manual migration execution
- Uses pure SQL for compatibility

## Migration File Naming

Migrations follow this naming convention:

```
NNN_description_of_migration.sql
```

Where:
- `NNN` is a zero-padded 3-digit sequential number (001, 002, 003, etc.)
- `description` is a brief, snake_case description of the migration
- `.sql` is the file extension

Examples:
- `001_create_sso_rbac_schema.sql`
- `002_add_saml_metadata_endpoint.sql`
- `003_add_oidc_token_tables.sql`

## Creating a New Migration

### 1. Create the Migration File

```bash
# Create migration in src/migrations/
touch src/migrations/002_your_migration_name.sql
```

### 2. Write SQL

```sql
-- Migration NNN: Brief description
-- Date: 2026-03-20
-- Purpose: Clear description of what this migration does

-- Add new columns
ALTER TABLE table_name ADD COLUMN new_column TEXT;

-- Create index
CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);

-- etc.
```

### 3. Keep Migrations Idempotent

Always use `IF NOT EXISTS` and `IF NOT EXISTS` clauses:

```sql
-- Good: Safe to run multiple times
CREATE TABLE IF NOT EXISTS table_name (...)
CREATE INDEX IF NOT EXISTS idx_name ON table_name(column)
ALTER TABLE existing_table ADD COLUMN IF NOT EXISTS new_column TEXT

-- Bad: Will fail if run twice
CREATE TABLE table_name (...)
ALTER TABLE table_name ADD COLUMN new_column TEXT
```

### 4. Handle Existing Data

When modifying existing tables, plan for data migrations:

```sql
-- Example: Add new column with default and constraints
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
-- Then add constraint after data is set
-- (in a follow-up migration if needed)

-- Example: Rename column
ALTER TABLE users RENAME COLUMN old_name TO new_name;

-- Example: Create new table from existing data
CREATE TABLE new_table AS SELECT * FROM old_table;
```

## Running Migrations

### Automatic on Startup

Migrations run automatically during application startup:

```javascript
// src/index.js
initDatabase();
runMigrations(); // Called automatically
```

### Manual Execution

```javascript
const { runMigrations } = require('./database');

const result = runMigrations();
console.log(result);
// {
//   success: true,
//   applied: ['001_create_sso_rbac_schema.sql'],
//   failed: [],
//   message: 'Applied 1 migration(s)'
// }
```

### Check Status

```javascript
const MigrationRunner = require('./lib/migrationRunner');
const runner = new MigrationRunner(db);

const status = runner.getStatus();
console.log('Applied:', status.applied);
console.log('Pending:', status.pending);
```

## Best Practices

### 1. Keep Migrations Small

- One logical change per migration
- Easier to review and debug
- Can be reverted if needed (future feature)

### 2. Test Migrations

Before committing:

```bash
# Clear database
rm src/db.sqlite*

# Run migrations
npm run init

# Verify schema
sqlite3 src/db.sqlite ".schema"
```

### 3. Document Your Changes

Include clear comments explaining:
- What problem the migration solves
- What data it creates/modifies
- Any assumptions about existing data

```sql
-- Migration 005: Add user status column
-- Purpose: Track user account status (active, suspended, deleted)
-- Assumptions: All existing users are assumed 'active'
-- Impact: May add slight delay to user queries due to index creation

ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
CREATE INDEX idx_users_status ON users(status);
```

### 4. Never Delete Production Data

```sql
-- OK: Add columns, create tables, add indexes
ALTER TABLE users ADD COLUMN new_field TEXT;

-- DANGEROUS: Always backup before deleting
DELETE FROM old_table; -- AVOID

-- SAFER: Archive before deleting
CREATE TABLE old_table_archive AS SELECT * FROM old_table;
DROP TABLE old_table;
```

### 5. Be Careful with Constraints

```sql
-- Adding constraints can fail if existing data violates them
-- Add constraint carefully:

-- Option 1: Add without constraint, then add constraint
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0;
-- Later: UPDATE users SET email_verified = 1 WHERE email IS NOT NULL;

-- Option 2: Update existing data in migration
ALTER TABLE users ADD COLUMN role TEXT;
UPDATE users SET role = CASE 
  WHEN is_admin = 1 THEN 'admin'
  ELSE 'user'
END;
-- Then add constraint:
ALTER TABLE users ADD CONSTRAINT chk_role CHECK (role IN ('admin', 'user'));
```

## Testing Migrations

### Local Testing

```bash
# Start fresh database
rm -f src/db.sqlite*

# Run app (migrations run automatically)
npm run dev

# Check that migrations applied
sqlite3 src/db.sqlite "SELECT * FROM migrations;"
```

### Reverting Migrations (Future)

Current version doesn't support rollbacks. If needed:

1. Delete entry from `migrations` table
2. Fix the migration file
3. Re-run migrations

```javascript
db.prepare('DELETE FROM migrations WHERE filename = ?').run('002_bad_migration.sql');
// Fix 002_bad_migration.sql
runMigrations(); // Re-run
```

## Migration Status

### Check Applied Migrations

```sql
SELECT * FROM migrations ORDER BY id;
```

Output:
```
id | filename                               | executed_at
1  | 001_create_sso_rbac_schema.sql         | 2026-03-20T18:00:00.000Z
```

### Monitor Migration Logs

Check `console.log` output during startup:

```
[Migration] Applied: 001_create_sso_rbac_schema.sql
[Migration] No pending migrations
```

## Common Issues

### "Table already exists"

The migration runner handles `IF NOT EXISTS` automatically. If you see this error:
1. Use `CREATE TABLE IF NOT EXISTS`
2. Check the migrations table to see which migrations have run
3. Delete duplicate migrations if they exist

### "Column already exists"

Similar to tables:
1. Use `ADD COLUMN IF NOT EXISTS`
2. This is already handled by safeMigration in database.js

### "Index already exists"

Use `CREATE INDEX IF NOT EXISTS`:

```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### Migrations Not Running

1. Check that `src/migrations/` directory exists
2. Check migration file names follow the pattern: `NNN_description.sql`
3. Check database logs for error messages
4. Verify `runMigrations()` is called in `src/index.js`

## References

- Migration Runner: `src/lib/migrationRunner.js`
- Database Module: `src/database.js`
- Schema Documentation: `docs/DATABASE_SCHEMA_PHASE4.md`
