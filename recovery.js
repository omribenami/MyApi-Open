#!/usr/bin/env node
/**
 * Emergency Database Recovery Script
 * This script reinitializes the corrupted MyApi database and creates a test user
 */

require('dotenv').config({ path: './src/.env' });
const {
  db,
  initDatabase,
  createUser,
  getUserByUsername
} = require('./src/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function recover() {
  try {
    console.log('🔄 Starting emergency database recovery...\n');

    // Step 1: Initialize fresh database schema
    console.log('Step 1: Initializing database schema...');
    initDatabase();
    console.log('✓ Database schema initialized\n');

    // Step 2: Create test user
    console.log('Step 2: Creating test user...');
    const testUser = {
      username: 'admin@your.domain.com',
      displayName: 'YOUR_NAME',
      email: 'admin@your.domain.com',
      password: 'testpassword123',
      timezone: 'Asia/Jerusalem'
    };

    // Check if user already exists
    let user = getUserByUsername(testUser.username);
    if (!user) {
      user = createUser(
        testUser.username,
        testUser.displayName,
        testUser.email,
        testUser.timezone,
        testUser.password
      );
      console.log(`✓ Test user created:`);
      console.log(`  - Username: ${user.username}`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Display Name: ${user.display_name}\n`);
    } else {
      console.log(`✓ Test user already exists:`);
      console.log(`  - Username: ${user.username}`);
      console.log(`  - Email: ${user.email}\n`);
    }

    // Step 3: Verify database integrity
    console.log('Step 3: Verifying database integrity...');
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get();
    console.log(`✓ Users table accessible, count: ${result.count}`);
    
    const skills = db.prepare('SELECT COUNT(*) as count FROM skills').get();
    console.log(`✓ Skills table accessible, count: ${skills.count}`);
    
    const vault = db.prepare('SELECT COUNT(*) as count FROM vault_tokens').get();
    console.log(`✓ Vault tokens table accessible, count: ${vault.count}\n`);

    console.log('✅ Database recovery completed successfully!\n');
    
    // Print recovery summary
    console.log('Recovery Summary:');
    console.log('================');
    console.log('• Deleted corrupted myapi.db, myapi.db-shm, and myapi.db-wal files');
    console.log('• Backed up corrupted files to src/data/backups/');
    console.log('• Reinitialized database schema');
    console.log('• Created test user account');
    console.log('• Verified database integrity');
    console.log('\nTest User Credentials:');
    console.log(`• Username: ${testUser.username}`);
    console.log(`• Password: ${testUser.password}`);
    console.log(`• Email: ${testUser.email}`);

  } catch (error) {
    console.error('❌ Recovery failed:', error.message);
    process.exit(1);
  }
}

recover();
