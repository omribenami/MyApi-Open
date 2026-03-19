const Database = require('better-sqlite3');
const path = require('path');

// Use the src/db.sqlite path
const dbPath = path.join(__dirname, 'src', 'db.sqlite');
const db = new Database(dbPath);

// Check if the marketplace_listings table exists and query it
try {
  const count = db.prepare("SELECT COUNT(*) as total FROM marketplace_listings WHERE type='skill'").get();
  console.log('Total skills in DB:', count.total);
  
  // Check for official skills
  const official = db.prepare(`
    SELECT COUNT(*) as total FROM marketplace_listings 
    WHERE type='skill' AND (content LIKE '%official%' OR content LIKE '%verified_source%')
  `).get();
  console.log('Official skills in DB:', official.total);
  
  // List all skills with their status
  const skills = db.prepare(`
    SELECT id, title, status, created_at
    FROM marketplace_listings
    WHERE type='skill'
    ORDER BY id ASC
  `).all();
  
  console.log('\nAll skills:');
  skills.forEach(s => {
    console.log(`ID ${s.id}: ${s.title} | status: ${s.status}`);
  });
  
  // Check specifically for the official-seed-2026-03-19 tag
  const seeded = db.prepare(`
    SELECT id, title, tags, status
    FROM marketplace_listings
    WHERE type='skill' AND tags LIKE '%official-seed-2026-03-19%'
    ORDER BY id ASC
  `).all();
  
  console.log('\n\nOfficial seeded skills (tag: official-seed-2026-03-19):');
  console.log('Count:', seeded.length);
  seeded.forEach(s => {
    console.log(`ID ${s.id}: ${s.title} | status: ${s.status} | tags: ${s.tags}`);
  });
  
} catch (err) {
  console.error('Error:', err.message);
  console.error(err);
}

db.close();
