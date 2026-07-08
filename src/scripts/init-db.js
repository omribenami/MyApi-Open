require('dotenv').config();
const { initDatabase } = require('../config/database');
const TokenManager = require('../gateway/tokens');

async function initialize() {
  console.log('🔧 Initializing MyApi Platform...\n');

  // Initialize database
  const dbPath = process.env.DB_PATH || './data/myapi.db';
  console.log(`📁 Database: ${dbPath}`);
  initDatabase(dbPath);
  console.log('✓ Database initialized\n');

  // Initialize components
  const tokenManager = new TokenManager();

  // Create initial personal token
  console.log('🔑 Creating initial personal token...');
  const personalToken = await tokenManager.createToken(
    'Initial Personal Token',
    'personal',
    { identity: '*', preferences: '*', connectors: '*' },
    null, // No expiration
    { created_by: 'init-script' }
  );

  console.log('✓ Personal token created!\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                                                               ║');
  console.log('║   🔐 SAVE THIS TOKEN - IT WILL ONLY BE SHOWN ONCE!           ║');
  console.log('║                                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`Token: ${personalToken.token}\n`);
  console.log('Copy this token and use it to access the dashboard and API.\n');

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                                                               ║');
  console.log('║   ✅ MyApi Platform Initialized Successfully!                ║');
  console.log('║                                                               ║');
  console.log('║   Next steps:                                                 ║');
  console.log('║   1. npm start                                                ║');
  console.log('║   2. Open http://localhost:3001                               ║');
  console.log('║   3. Login with your personal token                           ║');
  console.log('║                                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
}

initialize().catch(error => {
  console.error('❌ Initialization failed:', error);
  process.exit(1);
});
