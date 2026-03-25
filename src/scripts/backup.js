#!/usr/bin/env node

/**
 * MyApi Backup/Restore CLI
 * 
 * Usage:
 *   node src/scripts/backup.js create [--label name] [--type daily|manual|pre-deploy]
 *   node src/scripts/backup.js restore <backup-file>
 *   node src/scripts/backup.js list [--type daily|manual|pre-deploy]
 *   node src/scripts/backup.js verify <backup-file>
 *   node src/scripts/backup.js cleanup
 *   node src/scripts/backup.js status
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const BackupManager = require('../lib/backup-manager');

// Parse arguments
const args = process.argv.slice(2);
const command = args[0];

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      flags[key] = args[i + 1] || true;
      i++;
    } else if (!flags._positional) {
      flags._positional = args[i];
    }
  }
  return flags;
}

const flags = parseFlags(args.slice(1));

// Initialize backup manager
let dbInstance = null;
try {
  const Database = require('better-sqlite3');
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/myapi.db');
  const fs = require('fs');
  if (fs.existsSync(dbPath)) {
    dbInstance = new Database(dbPath, { readonly: command === 'list' || command === 'status' || command === 'verify' });
    dbInstance.pragma('journal_mode = WAL');
  }
} catch {
  // DB not available — that's OK for some commands
}

const manager = new BackupManager({ db: dbInstance });

function printUsage() {
  console.log(`
MyApi Backup/Restore CLI

Usage:
  node src/scripts/backup.js <command> [options]

Commands:
  create                Create a new backup
    --label <name>      Label for the backup
    --type <type>       Backup type: daily, manual (default), pre-deploy

  restore <file>        Restore from a backup file
    --no-safety         Skip creating a pre-restore safety backup
    --no-verify         Skip checksum verification

  list                  List all backups
    --type <type>       Filter by type: daily, manual, pre-deploy
    --limit <n>         Max number of results (default: 50)

  verify <file>         Verify backup file integrity

  cleanup               Apply retention policy (remove old backups)

  status                Show backup system status

Environment Variables:
  BACKUP_DIR            Backup storage directory (default: ./backups)
  BACKUP_RETENTION_DAYS Days to keep backups (default: 30)
  BACKUP_MAX_COUNT      Maximum number of backups (default: 50)
  DB_PATH               Database file path
`);
}

switch (command) {
  case 'create': {
    console.log('\n📦 Creating backup...');
    console.log('═'.repeat(50));

    const result = manager.createBackup({
      type: flags.type || 'manual',
      label: flags.label || ''
    });

    if (result.success) {
      console.log(`\n✅ Backup created successfully`);
      console.log(`   File:     ${result.filename}`);
      console.log(`   Path:     ${result.path}`);
      console.log(`   Size:     ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Checksum: ${result.checksum}`);
      console.log(`   Type:     ${result.type}`);
    } else {
      console.error(`\n❌ Backup failed: ${result.error}`);
      process.exit(1);
    }
    break;
  }

  case 'restore': {
    const backupFile = flags._positional;
    if (!backupFile) {
      console.error('❌ Backup file path required. Usage: backup.js restore <file>');
      process.exit(1);
    }

    const fullPath = path.resolve(backupFile);
    console.log(`\n🔄 Restoring from backup...`);
    console.log('═'.repeat(50));
    console.log(`   Source: ${fullPath}`);

    const result = manager.restoreBackup(fullPath, {
      createPreRestoreBackup: flags['no-safety'] !== true,
      verify: flags['no-verify'] !== true
    });

    if (result.success) {
      console.log(`\n✅ Database restored successfully`);
      console.log(`   Restored from: ${result.restoredFrom}`);
      console.log(`   Restored at:   ${result.restoredAt}`);
      console.log(`\n⚠️  Restart the server to use the restored database.`);
    } else {
      console.error(`\n❌ Restore failed: ${result.error}`);
      process.exit(1);
    }
    break;
  }

  case 'list': {
    console.log('\n📋 Backup List');
    console.log('═'.repeat(70));

    const backups = manager.listBackups({
      type: flags.type,
      limit: parseInt(flags.limit || '50', 10)
    });

    if (backups.length === 0) {
      console.log('\n  No backups found.');
    } else {
      console.log('');
      console.log('  Type       | Size      | Date                 | Filename');
      console.log('  ' + '-'.repeat(66));

      for (const b of backups) {
        const type = b.type.padEnd(10);
        const size = `${b.sizeMB} MB`.padEnd(9);
        const date = b.createdAt.substring(0, 19).padEnd(20);
        console.log(`  ${type} | ${size} | ${date} | ${b.filename}`);
      }
    }

    console.log(`\n  Total: ${backups.length} backup(s)`);
    console.log('');
    break;
  }

  case 'verify': {
    const verifyFile = flags._positional;
    if (!verifyFile) {
      console.error('❌ Backup file path required. Usage: backup.js verify <file>');
      process.exit(1);
    }

    const fullPath = path.resolve(verifyFile);
    console.log(`\n🔍 Verifying backup: ${fullPath}`);
    console.log('═'.repeat(50));

    const result = manager.verifyBackup(fullPath);

    if (result.valid) {
      console.log(`\n✅ Backup is valid`);
      console.log(`   Size:     ${result.sizeMB} MB`);
      console.log(`   SQLite:   ${result.isSQLite ? 'Yes' : 'No'}`);
      if (result.checksumValid !== null) {
        console.log(`   Checksum: ${result.checksumValid ? 'Valid ✓' : 'MISMATCH ✗'}`);
      }
    } else {
      console.error(`\n❌ Backup verification failed: ${result.error}`);
      process.exit(1);
    }
    break;
  }

  case 'cleanup': {
    console.log('\n🧹 Applying retention policy...');
    console.log('═'.repeat(50));

    const result = manager.applyRetention();
    console.log(`\n   Retention: ${result.retentionDays} days`);
    console.log(`   Removed:   ${result.removed} backup(s)`);
    console.log('');
    break;
  }

  case 'status': {
    console.log('\n📊 Backup System Status');
    console.log('═'.repeat(50));

    const status = manager.getStatus();

    console.log(`\n   Backup directory:  ${status.backupDir}`);
    console.log(`   Retention:         ${status.retentionDays} days`);
    console.log(`   Max backups:       ${status.maxBackups}`);
    console.log(`   Total backups:     ${status.totalBackups}`);
    console.log(`   Total size:        ${status.totalSizeMB} MB`);
    console.log(`   Scheduled:         ${status.scheduled ? 'Yes' : 'No'}`);
    console.log(`\n   By type:`);
    console.log(`     Daily:      ${status.byType.daily}`);
    console.log(`     Manual:     ${status.byType.manual}`);
    console.log(`     Pre-deploy: ${status.byType.preDeploy}`);

    if (status.latestBackup) {
      console.log(`\n   Latest backup:`);
      console.log(`     File:    ${status.latestBackup.filename}`);
      console.log(`     Created: ${status.latestBackup.createdAt}`);
      console.log(`     Size:    ${status.latestBackup.sizeMB} MB`);
    }

    console.log('');
    break;
  }

  default:
    printUsage();
    process.exit(command ? 1 : 0);
}

// Cleanup
if (dbInstance) {
  try { dbInstance.close(); } catch { /* ignore */ }
}
