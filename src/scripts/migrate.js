#!/usr/bin/env node

/**
 * MyApi Database Migration CLI
 * 
 * Usage:
 *   node src/scripts/migrate.js status         Show migration status
 *   node src/scripts/migrate.js run            Run all pending migrations
 *   node src/scripts/migrate.js rollback       Rollback last batch
 *   node src/scripts/migrate.js create <name>  Create new migration files
 *   node src/scripts/migrate.js verify         Verify migration checksums
 *   node src/scripts/migrate.js history        Show full migration history
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const MigrationRunner = require('../lib/migrationRunner');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/myapi.db');
const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

function getDb() {
  try {
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 10000');
    return db;
  } catch (error) {
    console.error(`❌ Failed to open database at ${DB_PATH}:`, error.message);
    process.exit(1);
  }
}

function printStatus(runner) {
  const status = runner.getStatus();

  console.log('\n📊 Migration Status');
  console.log('═'.repeat(60));

  console.log(`\nCurrent batch: ${status.currentBatch}`);

  if (status.applied.length > 0) {
    console.log(`\n✅ Applied migrations (${status.applied.length}):`);
    for (const detail of status.details) {
      if (!detail.rolled_back_at) {
        console.log(`   ${detail.filename} (batch ${detail.batch}, ${detail.executed_at})`);
      }
    }
  } else {
    console.log('\n  No migrations applied yet.');
  }

  if (status.pending.length > 0) {
    console.log(`\n⏳ Pending migrations (${status.pending.length}):`);
    for (const file of status.pending) {
      console.log(`   ${file}`);
    }
  } else {
    console.log('\n  No pending migrations.');
  }

  // Show rolled back
  const rolledBack = status.details.filter(d => d.rolled_back_at);
  if (rolledBack.length > 0) {
    console.log(`\n↩️  Rolled back migrations (${rolledBack.length}):`);
    for (const detail of rolledBack) {
      console.log(`   ${detail.filename} (rolled back ${detail.rolled_back_at})`);
    }
  }

  console.log('');
}

function runMigrations(runner) {
  console.log('\n🚀 Running pending migrations...');
  console.log('═'.repeat(60));

  const result = runner.runPendingMigrations();

  if (result.applied.length > 0) {
    console.log(`\n✅ Applied ${result.applied.length} migration(s) in batch ${result.batch}:`);
    for (const file of result.applied) {
      console.log(`   ✓ ${file}`);
    }
  }

  if (result.failed && result.failed.length > 0) {
    console.log(`\n❌ Failed migrations:`);
    for (const fail of result.failed) {
      console.log(`   ✗ ${fail.filename}: ${fail.error}`);
    }
  }

  if (result.applied.length === 0 && (!result.failed || result.failed.length === 0)) {
    console.log('\n  No pending migrations to run.');
  }

  console.log('');
  return result.success ? 0 : 1;
}

function rollback(runner) {
  console.log('\n↩️  Rolling back last batch...');
  console.log('═'.repeat(60));

  const result = runner.rollbackLastBatch();

  if (result.rolledBack && result.rolledBack.length > 0) {
    console.log(`\n✅ Rolled back ${result.rolledBack.length} migration(s) from batch ${result.batch}:`);
    for (const file of result.rolledBack) {
      console.log(`   ↩️ ${file}`);
    }
  } else {
    console.log('\n  No migrations to rollback.');
  }

  if (result.failed && result.failed.length > 0) {
    console.log(`\n❌ Rollback failures:`);
    for (const fail of result.failed) {
      console.log(`   ✗ ${fail.filename}: ${fail.error}`);
    }
  }

  console.log('');
  return result.success ? 0 : 1;
}

function createMigration(name) {
  if (!name) {
    console.error('❌ Migration name required. Usage: migrate.js create <name>');
    process.exit(1);
  }

  console.log(`\n📝 Creating migration: ${name}`);
  console.log('═'.repeat(60));

  const result = MigrationRunner.createMigrationFile(MIGRATIONS_DIR, name);

  console.log(`\n✅ Migration files created:`);
  console.log(`   Up:   ${result.upFile}`);
  console.log(`   Down: ${result.downFile}`);
  console.log(`\n   Edit these files in: ${MIGRATIONS_DIR}/`);
  console.log('');
}

function verify(runner) {
  console.log('\n🔍 Verifying migration checksums...');
  console.log('═'.repeat(60));

  const results = runner.verifyChecksums();

  if (results.length === 0) {
    console.log('\n  No applied migrations to verify.');
    console.log('');
    return 0;
  }

  let hasIssues = false;
  for (const result of results) {
    if (result.status === 'ok') {
      console.log(`   ✓ ${result.filename}`);
    } else if (result.status === 'modified') {
      console.log(`   ⚠️ ${result.filename} - MODIFIED (expected: ${result.expected}, got: ${result.actual})`);
      hasIssues = true;
    } else if (result.status === 'missing') {
      console.log(`   ❌ ${result.filename} - ${result.message}`);
      hasIssues = true;
    }
  }

  if (hasIssues) {
    console.log('\n⚠️  Some migrations have been modified or are missing.');
    console.log('   This may indicate tampering or accidental changes.');
  } else {
    console.log('\n✅ All migration checksums verified.');
  }

  console.log('');
  return hasIssues ? 1 : 0;
}

function showHistory(runner) {
  console.log('\n📜 Migration History');
  console.log('═'.repeat(60));

  const details = runner.getAppliedMigrationDetails();

  if (details.length === 0) {
    console.log('\n  No migration history.');
    console.log('');
    return;
  }

  console.log('');
  console.log('  ID  | Batch | Status      | Filename');
  console.log('  ' + '-'.repeat(56));

  for (const d of details) {
    const status = d.rolled_back_at ? 'rolled back' : 'applied    ';
    console.log(`  ${String(d.id).padStart(3)} | ${String(d.batch).padStart(5)} | ${status} | ${d.filename}`);
  }

  console.log('');
}

// Main
const command = process.argv[2];
const args = process.argv.slice(3);

if (command === 'create') {
  // Create doesn't need a DB connection
  createMigration(args.join('_'));
  process.exit(0);
}

const db = getDb();
const runner = new MigrationRunner(db);
runner.initMigrationTable();

let exitCode = 0;

switch (command) {
  case 'status':
    printStatus(runner);
    break;
  case 'run':
    exitCode = runMigrations(runner);
    break;
  case 'rollback':
    exitCode = rollback(runner);
    break;
  case 'verify':
    exitCode = verify(runner);
    break;
  case 'history':
    showHistory(runner);
    break;
  default:
    console.log(`
MyApi Database Migration CLI

Usage:
  node src/scripts/migrate.js <command> [args]

Commands:
  status         Show migration status (applied, pending)
  run            Run all pending migrations
  rollback       Rollback the last batch of migrations
  create <name>  Create new migration files (up + down)
  verify         Verify migration file checksums
  history        Show full migration history
`);
    exitCode = command ? 1 : 0;
}

db.close();
process.exit(exitCode);
