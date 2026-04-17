#!/usr/bin/env node

/**
 * Export SQLite database to CSV files (one per table)
 * Usage: node scripts/export-csv.js [output-dir]
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || './src/data/myapi.db';
const outputDir = process.argv[2] || './csv-export';

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found: ${dbPath}`);
  process.exit(1);
}

console.log(`📂 Exporting from: ${dbPath}`);
console.log(`📁 Output directory: ${outputDir}\n`);

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const db = new Database(dbPath);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();

console.log(`📊 Found ${tables.length} tables\n`);

let totalRows = 0;

for (const table of tables) {
  const tableName = table.name;
  const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
  
  if (rows.length === 0) {
    console.log(`⏭️  ${tableName}: (empty)`);
    continue;
  }

  // Get column names from first row
  const columns = Object.keys(rows[0]);
  
  // Create CSV content
  let csv = columns.map(col => `"${col.replace(/"/g, '""')}"`).join(',') + '\n';
  
  for (const row of rows) {
    const values = columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'string') {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return `"${val}"`;
    });
    csv += values.join(',') + '\n';
  }

  // Write CSV file
  const csvPath = path.join(outputDir, `${tableName}.csv`);
  fs.writeFileSync(csvPath, csv);
  
  totalRows += rows.length;
  console.log(`✅ ${tableName}: ${rows.length} rows → ${tableName}.csv`);
}

db.close();

console.log(`\n✨ Export complete!`);
console.log(`📊 Total rows: ${totalRows}`);
console.log(`📁 Files saved to: ${path.resolve(outputDir)}`);
console.log(`\n🎯 Next steps:`);
console.log(`1. Compress the CSV files: tar -czf myapi-export.tar.gz ${outputDir}/`);
console.log(`2. Import to Turso using their dashboard or CLI`);
