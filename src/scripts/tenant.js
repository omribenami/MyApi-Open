#!/usr/bin/env node

/**
 * MyApi Tenant Management CLI
 * 
 * Usage:
 *   node src/scripts/tenant.js create --name "Acme Corp" --slug acme-corp [--plan starter]
 *   node src/scripts/tenant.js list
 *   node src/scripts/tenant.js info <tenant-id|slug>
 *   node src/scripts/tenant.js update <tenant-id> --plan business
 *   node src/scripts/tenant.js suspend <tenant-id> [--reason "reason"]
 *   node src/scripts/tenant.js reactivate <tenant-id>
 *   node src/scripts/tenant.js delete <tenant-id>
 *   node src/scripts/tenant.js env:create <tenant-id> --name Staging --slug staging --type staging
 *   node src/scripts/tenant.js env:list <tenant-id>
 *   node src/scripts/tenant.js apikey:create <tenant-id> --label "Production API Key"
 *   node src/scripts/tenant.js stats <tenant-id>
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const Database = require('better-sqlite3');
const TenantManager = require('../lib/tenant-manager');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/myapi.db');

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

function parseFlags(args) {
  const flags = { _positional: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      flags[key] = args[i + 1] || true;
      i++;
    } else {
      flags._positional.push(args[i]);
    }
  }
  return flags;
}

function printUsage() {
  console.log(`
MyApi Tenant Management CLI

Usage:
  node src/scripts/tenant.js <command> [options]

Commands:
  create                Create a new tenant
    --name <name>       Tenant name (required)
    --slug <slug>       URL-safe identifier (required)
    --plan <plan>       Plan: free, starter, business, enterprise (default: free)
    --domain <domain>   Custom domain

  list                  List all tenants
    --status <status>   Filter by status: active, suspended

  info <id|slug>        Get tenant details

  update <id>           Update tenant
    --name <name>       New name
    --plan <plan>       New plan

  suspend <id>          Suspend a tenant
    --reason <reason>   Suspension reason

  reactivate <id>       Reactivate a suspended tenant

  delete <id>           Soft-delete a tenant

  env:create <id>       Create environment for tenant
    --name <name>       Environment name
    --slug <slug>       Environment slug
    --type <type>       Type: production, staging, development

  env:list <id>         List tenant environments

  apikey:create <id>    Generate API key for tenant
    --label <label>     Key label (required)
    --expires <days>    Expiry in days

  stats <id>            Show tenant usage statistics
`);
}

const db = getDb();
const manager = new TenantManager(db);
manager.initTenantTables();

const command = process.argv[2];
const flags = parseFlags(process.argv.slice(3));

try {
  switch (command) {
    case 'create': {
      if (!flags.name || !flags.slug) {
        console.error('❌ --name and --slug are required');
        process.exit(1);
      }

      console.log('\n🏢 Creating tenant...');
      const tenant = manager.createTenant({
        name: flags.name,
        slug: flags.slug,
        plan: flags.plan || 'free',
        domain: flags.domain || null
      });

      console.log(`\n✅ Tenant created:`);
      console.log(`   ID:     ${tenant.id}`);
      console.log(`   Name:   ${tenant.name}`);
      console.log(`   Slug:   ${tenant.slug}`);
      console.log(`   Plan:   ${tenant.plan}`);
      console.log(`   Status: ${tenant.status}`);
      if (tenant.domain) console.log(`   Domain: ${tenant.domain}`);
      console.log(`   Limits: ${tenant.max_users} users, ${tenant.max_workspaces} workspaces`);
      console.log('');
      break;
    }

    case 'list': {
      console.log('\n📋 Tenants');
      console.log('═'.repeat(70));

      const tenants = manager.listTenants({ status: flags.status || null });

      if (tenants.length === 0) {
        console.log('\n  No tenants found.');
      } else {
        console.log('');
        console.log('  ID                           | Plan       | Status   | Name');
        console.log('  ' + '-'.repeat(66));

        for (const t of tenants) {
          console.log(`  ${t.id.padEnd(30)} | ${t.plan.padEnd(10)} | ${t.status.padEnd(8)} | ${t.name}`);
        }
      }
      console.log(`\n  Total: ${tenants.length}`);
      console.log('');
      break;
    }

    case 'info': {
      const identifier = flags._positional[0];
      if (!identifier) {
        console.error('❌ Tenant ID or slug required');
        process.exit(1);
      }

      const tenant = identifier.startsWith('ten_')
        ? manager.getTenant(identifier)
        : manager.getTenantBySlug(identifier);

      if (!tenant) {
        console.error(`❌ Tenant not found: ${identifier}`);
        process.exit(1);
      }

      console.log('\n🏢 Tenant Details');
      console.log('═'.repeat(50));
      console.log(`   ID:         ${tenant.id}`);
      console.log(`   Name:       ${tenant.name}`);
      console.log(`   Slug:       ${tenant.slug}`);
      console.log(`   Plan:       ${tenant.plan}`);
      console.log(`   Status:     ${tenant.status}`);
      console.log(`   Domain:     ${tenant.domain || 'none'}`);
      console.log(`   Users max:  ${tenant.max_users === -1 ? 'unlimited' : tenant.max_users}`);
      console.log(`   WS max:     ${tenant.max_workspaces === -1 ? 'unlimited' : tenant.max_workspaces}`);
      console.log(`   Created:    ${tenant.created_at}`);

      if (tenant.environments && tenant.environments.length > 0) {
        console.log(`\n   Environments:`);
        for (const env of tenant.environments) {
          console.log(`     - ${env.name} (${env.type}) [${env.status}]`);
        }
      }
      console.log('');
      break;
    }

    case 'update': {
      const tenantId = flags._positional[0];
      if (!tenantId) {
        console.error('❌ Tenant ID required');
        process.exit(1);
      }

      const updates = {};
      if (flags.name) updates.name = flags.name;
      if (flags.plan) updates.plan = flags.plan;
      if (flags.domain) updates.domain = flags.domain;

      const updated = manager.updateTenant(tenantId, updates);
      if (updated) {
        console.log(`\n✅ Tenant updated: ${updated.name}`);
      } else {
        console.error('❌ No valid updates provided');
      }
      break;
    }

    case 'suspend': {
      const tenantId = flags._positional[0];
      if (!tenantId) {
        console.error('❌ Tenant ID required');
        process.exit(1);
      }

      const suspended = manager.suspendTenant(tenantId, flags.reason);
      console.log(`\n⏸️  Tenant suspended: ${suspended.name}`);
      break;
    }

    case 'reactivate': {
      const tenantId = flags._positional[0];
      if (!tenantId) {
        console.error('❌ Tenant ID required');
        process.exit(1);
      }

      const reactivated = manager.reactivateTenant(tenantId);
      console.log(`\n▶️  Tenant reactivated: ${reactivated.name}`);
      break;
    }

    case 'delete': {
      const tenantId = flags._positional[0];
      if (!tenantId) {
        console.error('❌ Tenant ID required');
        process.exit(1);
      }

      const result = manager.deleteTenant(tenantId);
      console.log(`\n🗑️  Tenant deleted: ${result.tenantId}`);
      break;
    }

    case 'env:create': {
      const tenantId = flags._positional[0];
      if (!tenantId || !flags.name || !flags.slug) {
        console.error('❌ Tenant ID, --name, and --slug are required');
        process.exit(1);
      }

      const env = manager.createEnvironment(tenantId, {
        name: flags.name,
        slug: flags.slug,
        type: flags.type || 'production'
      });

      console.log(`\n✅ Environment created: ${env.name} (${env.type})`);
      break;
    }

    case 'env:list': {
      const tenantId = flags._positional[0];
      if (!tenantId) {
        console.error('❌ Tenant ID required');
        process.exit(1);
      }

      const envs = manager.listEnvironments(tenantId);
      console.log('\n🌍 Environments');
      console.log('═'.repeat(50));

      for (const env of envs) {
        console.log(`   ${env.name} (${env.type}) - ${env.status}`);
      }
      console.log('');
      break;
    }

    case 'apikey:create': {
      const tenantId = flags._positional[0];
      if (!tenantId || !flags.label) {
        console.error('❌ Tenant ID and --label are required');
        process.exit(1);
      }

      const result = manager.generateApiKey(tenantId, {
        label: flags.label,
        expiresInDays: flags.expires ? parseInt(flags.expires, 10) : null
      });

      console.log('\n🔑 API Key Generated');
      console.log('═'.repeat(50));
      console.log(`   Label:   ${result.label}`);
      console.log(`   Key:     ${result.key}`);
      console.log(`   Expires: ${result.expiresAt || 'Never'}`);
      console.log(`\n   ⚠️  Save this key — it will only be shown once!`);
      console.log('');
      break;
    }

    case 'stats': {
      const tenantId = flags._positional[0];
      if (!tenantId) {
        console.error('❌ Tenant ID required');
        process.exit(1);
      }

      const stats = manager.getTenantStats(tenantId);
      if (!stats) {
        console.error(`❌ Tenant not found: ${tenantId}`);
        process.exit(1);
      }

      console.log('\n📊 Tenant Statistics');
      console.log('═'.repeat(50));
      console.log(`   Plan:          ${stats.plan}`);
      console.log(`   Workspaces:    ${stats.workspaces.current} / ${stats.workspaces.max === -1 ? '∞' : stats.workspaces.max}`);
      console.log(`   Users:         ${stats.users.current} / ${stats.users.max === -1 ? '∞' : stats.users.max}`);
      console.log(`   API Keys:      ${stats.apiKeys}`);
      console.log(`   Environments:  ${stats.environments}`);
      console.log('');
      break;
    }

    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(`\n❌ Error: ${error.message}`);
  process.exit(1);
}

db.close();
