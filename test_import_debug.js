#!/usr/bin/env node

/**
 * test_import_debug.js
 * 
 * Test the import functionality with logging to diagnose the "personas: 0, skills: 0" issue
 */

const { createPersona, createSkill, getPersonas, getSkills, db } = require('./src/database');

const userId = 'usr_test_import_' + Date.now();
const testOwnerId = userId;

console.log(`\n========================================`);
console.log(`IMPORT DEBUG TEST`);
console.log(`========================================\n`);

console.log(`[TEST] Using user ID: ${testOwnerId}\n`);

// Test 1: Direct createPersona call (outside transaction)
console.log(`[TEST 1] Testing createPersona() outside transaction...`);
try {
  const persona1 = createPersona(
    'Test Persona 1',
    'This is a test soul',
    'Test Description',
    { test: true },
    testOwnerId
  );
  console.log(`✓ Persona created:`, persona1);
} catch (e) {
  console.error(`✗ Error creating persona:`, e.message);
}

// Test 2: Direct createSkill call (outside transaction)
console.log(`\n[TEST 2] Testing createSkill() outside transaction...`);
try {
  const skill1 = createSkill(
    'Test Skill 1',
    'Test Skill Description',
    '1.0.0',
    'TestAuthor',
    'testing',
    'console.log("test");',
    { test: true },
    null,
    testOwnerId
  );
  console.log(`✓ Skill created:`, skill1);
} catch (e) {
  console.error(`✗ Error creating skill:`, e.message);
}

// Test 3: Verify they exist in database
console.log(`\n[TEST 3] Verifying personas in database...`);
try {
  const personas = getPersonas(testOwnerId);
  console.log(`Found ${personas.length} personas for user ${testOwnerId}`);
  personas.forEach(p => {
    console.log(`  - ${p.name} (ID: ${p.id})`);
  });
} catch (e) {
  console.error(`✗ Error fetching personas:`, e.message);
}

console.log(`\n[TEST 4] Verifying skills in database...`);
try {
  const skills = getSkills(testOwnerId);
  console.log(`Found ${skills.length} skills for user ${testOwnerId}`);
  skills.forEach(s => {
    console.log(`  - ${s.name} (ID: ${s.id})`);
  });
} catch (e) {
  console.error(`✗ Error fetching skills:`, e.message);
}

// Test 5: Test inside transaction
console.log(`\n[TEST 5] Testing createPersona() inside transaction...`);
try {
  const transactionFn = db.transaction(() => {
    console.log(`  [TX] Inside transaction callback`);
    const persona2 = createPersona(
      'Test Persona 2',
      'Soul in transaction',
      'Description in tx',
      { tx: true },
      testOwnerId
    );
    console.log(`  [TX] createPersona returned:`, persona2);
    return persona2;
  });
  const result = transactionFn();
  console.log(`✓ Transaction completed, returned:`, result);
} catch (e) {
  console.error(`✗ Error in transaction:`, e.message, e.stack);
}

console.log(`\n[TEST 6] Testing createSkill() inside transaction...`);
try {
  const transactionFn = db.transaction(() => {
    console.log(`  [TX] Inside transaction callback`);
    const skill2 = createSkill(
      'Test Skill 2',
      'Skill in transaction',
      '2.0.0',
      'TxAuthor',
      'testing',
      'console.log("tx");',
      { tx: true },
      null,
      testOwnerId
    );
    console.log(`  [TX] createSkill returned:`, skill2);
    return skill2;
  });
  const result = transactionFn();
  console.log(`✓ Transaction completed, returned:`, result);
} catch (e) {
  console.error(`✗ Error in transaction:`, e.message, e.stack);
}

// Test 7: Final verification
console.log(`\n[TEST 7] Final verification - all data for user ${testOwnerId}...`);
try {
  const allPersonas = getPersonas(testOwnerId);
  const allSkills = getSkills(testOwnerId);
  
  console.log(`\nFinal counts:`);
  console.log(`  Personas: ${allPersonas.length}`);
  console.log(`  Skills: ${allSkills.length}`);
  
  console.log(`\nPersonas:`);
  allPersonas.forEach(p => {
    console.log(`  ✓ ${p.name} (owner_id: ${p.owner_id})`);
  });
  
  console.log(`\nSkills:`);
  allSkills.forEach(s => {
    console.log(`  ✓ ${s.name} (owner_id: ${s.owner_id})`);
  });
} catch (e) {
  console.error(`✗ Error:`, e.message);
}

console.log(`\n========================================`);
console.log(`TEST COMPLETE`);
console.log(`========================================\n`);

process.exit(0);
