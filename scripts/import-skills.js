#!/usr/bin/env node

/**
 * Import Skills from Workspace to MyApi Database
 * 
 * Usage:
 *   node scripts/import-skills.js
 * 
 * This script:
 * 1. Scans ~/skills/ for SKILL.md files
 * 2. Parses skill metadata
 * 3. Inserts/updates skills in the database
 * 4. Makes them visible in the frontend
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Resolve database path
const dbPath = process.env.DB_PATH || path.join(__dirname, '../src/data/myapi.db');
console.log(`[Import] Using database: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);

// Skill directory - check multiple locations
let skillsDir = process.env.SKILLS_DIR;
if (!skillsDir) {
  const candidates = [
    path.join(__dirname, '../../skills'), // workspace/skills
    path.join(__dirname, '../../../skills'), // one level up
    path.join(process.cwd(), 'skills'), // project root skills
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      skillsDir = candidate;
      break;
    }
  }
}
console.log(`[Import] Scanning skills directory: ${skillsDir}`);

if (!fs.existsSync(skillsDir)) {
  console.error(`❌ Skills directory not found: ${skillsDir}`);
  process.exit(1);
}

// Find all SKILL.md files
const skillDirs = fs.readdirSync(skillsDir).filter(name => {
  const fullPath = path.join(skillsDir, name);
  return fs.statSync(fullPath).isDirectory();
});

console.log(`[Import] Found ${skillDirs.length} skill directories`);

let importedCount = 0;
let errorCount = 0;

for (const skillDirName of skillDirs) {
  const skillPath = path.join(skillsDir, skillDirName);
  const skillMdPath = path.join(skillPath, 'SKILL.md');

  if (!fs.existsSync(skillMdPath)) {
    console.warn(`⚠️  No SKILL.md found in ${skillDirName}`);
    continue;
  }

  try {
    const content = fs.readFileSync(skillMdPath, 'utf8');
    const lines = content.split('\n');
    
    // Parse skill name: prefer directory name, fallback to first markdown header
    let title = skillDirName;
    for (const line of lines) {
      if (line.startsWith('#') && !line.startsWith('##')) {
        title = line.replace(/^#+\s+/, '').trim();
        if (title && title !== '---') break;
      }
    }
    
    // Extract description: skip YAML front matter and get first paragraph
    let description = '';
    let inYaml = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (i === 0 && line === '---') {
        inYaml = true;
        continue;
      }
      if (inYaml && line === '---') {
        inYaml = false;
        continue;
      }
      if (inYaml) continue; // Skip YAML content
      
      if (line.trim() && !line.startsWith('#')) {
        description = line.trim().substring(0, 200); // First 200 chars
        break;
      }
    }

    const now = new Date().toISOString();

    // Insert into database (id is auto-generated)
    const stmt = db.prepare(`
      INSERT INTO skills (
        name, description, version, author, category, 
        script_content, config_json, repo_url, active, 
        created_at, updated_at, owner_id, workspace_id, origin_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      title,
      description,
      '1.0.0',
      'OpenClaw Workspace',
      'custom',
      content.substring(0, 5000), // Store first 5KB of SKILL.md
      JSON.stringify({ path: skillPath }),
      `local://${skillPath}`,
      1, // active
      now,
      now,
      null, // owner_id
      null, // workspace_id
      'local'
    );

    console.log(`✅ Imported: ${title}`);
    importedCount++;
  } catch (err) {
    console.error(`❌ Error importing ${skillDirName}:`, err.message);
    errorCount++;
  }
}

console.log(`\n[Import] Complete: ${importedCount} imported, ${errorCount} errors`);
process.exit(errorCount > 0 ? 1 : 0);
