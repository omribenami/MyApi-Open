const Database = require('better-sqlite3');
const path = require('path');

// Use the src/db.sqlite path
const dbPath = path.join(__dirname, 'src', 'db.sqlite');
const db = new Database(dbPath);

// Simulate the getMarketplaceListings function from database.js
function getMarketplaceListings({ type, sort, search, tags, status = 'active' } = {}) {
  let query = `
    SELECT ml.*, u.username as owner_name, u.display_name as owner_display_name
    FROM marketplace_listings ml
    LEFT JOIN users u ON ml.owner_id = u.id
    WHERE ml.status = ?
  `;
  const params = [status];

  if (type && type !== 'all') {
    query += ' AND ml.type = ?';
    params.push(type);
  }
  if (search) {
    query += ' AND (ml.title LIKE ? OR ml.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (tags) {
    query += ' AND ml.tags LIKE ?';
    params.push(`%${tags}%`);
  }

  if (sort === 'popular') {
    query += ' ORDER BY ml.avg_rating DESC, ml.rating_count DESC';
  } else if (sort === 'most_used') {
    query += ' ORDER BY ml.install_count DESC';
  } else {
    query += ' ORDER BY ml.created_at DESC';
  }

  console.log('Query:', query);
  console.log('Params:', params);
  
  const results = db.prepare(query).all(...params);
  console.log('\nResults count:', results.length);
  return results;
}

// Test API response
console.log('Testing /api/v1/marketplace with type=skill:');
const skills = getMarketplaceListings({ type: 'skill' });
console.log('\nSkills returned:');
skills.forEach(s => {
  console.log(`- ID ${s.id}: ${s.title} (status: ${s.status})`);
});

console.log('\n\nTesting /api/v1/marketplace with no filter (all types):');
const all = getMarketplaceListings({});
console.log('Total returned:', all.length);
all.forEach(s => {
  console.log(`- ID ${s.id}: ${s.title} | type: ${s.type} | status: ${s.status}`);
});

db.close();
