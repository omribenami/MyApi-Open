const Database = require('better-sqlite3');
const { Pool } = require('pg');

const SQLITE_PATH = process.env.SQLITE_PATH || './myapi-backup.db';
const PG_URL = process.env.DATABASE_URL;
if (!PG_URL) { console.error('DATABASE_URL env var required'); process.exit(1); }
const BATCH_SIZE = 100;

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pool = new Pool({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });

const TABLES = [
  'users', 'workspaces', 'workspace_members', 'workspace_invitations',
  'permissions', 'scope_definitions',
  'vault_tokens', 'access_tokens',
  'personas', 'handshakes',
  'kb_documents', 'skills', 'skill_licenses',
  'marketplace_listings', 'services', 'service_categories', 'service_preferences', 'service_api_methods',
  'oauth_tokens', 'oauth_pending_logins', 'oauth_status',
  'notifications', 'notification_preferences', 'notification_queue', 'email_queue',
  'billing_customers', 'billing_subscriptions', 'pricing_plans', 'usage_daily',
  'approved_devices', 'device_approvals_pending',
  'audit_log', 'activity_log', 'compliance_audit_logs',
  'rate_limits', 'encryption_keys', 'key_versions', 'data_retention_policies',
  'user_pii_secure', 'user_roles', 'code_reviews', 'migration_queue',
];

async function getTableColumns(client, tableName) {
  const res = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [tableName]
  );
  return res.rows.map(r => r.column_name);
}

async function tableExists(client, tableName) {
  const res = await client.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
    [tableName]
  );
  return res.rows[0].exists;
}

async function migrateTable(client, tableName) {
  const exists = await tableExists(client, tableName);
  if (!exists) {
    console.log(`  [SKIP] ${tableName} — not in Supabase`);
    return { skipped: true };
  }

  let rows;
  try {
    rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
  } catch (e) {
    console.log(`  [SKIP] ${tableName} — not in SQLite: ${e.message}`);
    return { skipped: true };
  }

  if (rows.length === 0) {
    console.log(`  [SKIP] ${tableName} — empty`);
    return { inserted: 0 };
  }

  const pgCols = await getTableColumns(client, tableName);
  const sqliteCols = Object.keys(rows[0]);
  const cols = sqliteCols.filter(c => pgCols.includes(c));

  if (cols.length === 0) {
    console.log(`  [SKIP] ${tableName} — no overlapping columns`);
    return { skipped: true };
  }

  const colList = cols.map(c => `"${c}"`).join(', ');
  let inserted = 0;
  let skippedCount = 0;

  // Batch insert
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const allValues = [];
    const rowPlaceholders = batch.map((row, ri) => {
      const ph = cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', ');
      cols.forEach(c => {
        let v = row[c];
        if (v === undefined) v = null;
        allValues.push(v);
      });
      return `(${ph})`;
    }).join(', ');

    // First check if the table already has data (avoid re-running migration)
    if (i === 0) {
      const countRes = await client.query(`SELECT COUNT(*) as n FROM ${tableName}`);
      if (parseInt(countRes.rows[0].n) >= rows.length) {
        console.log(`  [SKIP] ${tableName} — already has ${countRes.rows[0].n} rows`);
        return { inserted: 0, skipped: rows.length };
      }
    }
    const sql = `INSERT INTO ${tableName} (${colList}) VALUES ${rowPlaceholders}`;

    try {
      const res = await client.query(sql, allValues);
      inserted += res.rowCount;
      skippedCount += batch.length - res.rowCount;
    } catch (e) {
      // Fallback: row by row for this batch
      for (const row of batch) {
        const values = cols.map(c => row[c] === undefined ? null : row[c]);
        const ph = cols.map((_, ci) => `$${ci + 1}`).join(', ');
        try {
          const res = await client.query(`INSERT INTO ${tableName} (${colList}) VALUES (${ph}) ON CONFLICT DO NOTHING`, values);
          inserted += res.rowCount;
          if (res.rowCount === 0) skippedCount++;
        } catch (e2) {
          console.warn(`    [WARN] row: ${e2.message.split('\n')[0]}`);
          skippedCount++;
        }
      }
    }
  }

  console.log(`  [OK] ${tableName}: ${inserted} inserted, ${skippedCount} skipped`);
  return { inserted, skipped: skippedCount };
}

async function main() {
  const client = await pool.connect();
  console.log('[Migration] Connected to Supabase');
  await client.query('SET session_replication_role = replica');

  let totalInserted = 0;

  for (const table of TABLES) {
    process.stdout.write(`Migrating ${table}... `);
    try {
      const result = await migrateTable(client, table);
      if (result.inserted) totalInserted += result.inserted;
    } catch (e) {
      console.error(`\n  [ERROR] ${table}: ${e.message}`);
    }
  }

  await client.query('SET session_replication_role = DEFAULT');
  client.release();
  await pool.end();

  console.log(`\n[Migration] Complete. Total rows inserted: ${totalInserted}`);
  sqlite.close();
}

main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
