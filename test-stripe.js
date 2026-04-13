#!/usr/bin/env node
/**
 * Stripe Integration Dry Test
 * Tests Stripe connectivity, webhook validation, and subscription flow
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const Stripe = require('stripe');

// ANSI colors
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const blue = (s) => `\x1b[34m${s}\x1b[0m`;

console.log(blue('🧪 STRIPE DRY TEST — Test Mode (No Real Charges)\n'));

// Check configuration
// SECURITY FIX (HIGH - CVSS 7.1 + 4.3): Stripe Key Validation and Test/Live Fallback Prevention
const testKey = process.env.STRIPE_SECRET_KEY_TEST;
const liveKey = process.env.STRIPE_SECRET_KEY_LIVE;
const webhookSecretTest = process.env.STRIPE_WEBHOOK_SECRET_TEST;
const webhookSecretLive = process.env.STRIPE_WEBHOOK_SECRET_LIVE;

console.log('📋 Configuration Check:');
console.log(`  Test Secret Key: ${testKey ? green('✓ Found') : red('✗ Missing')}`);
console.log(`  Live Secret Key: ${liveKey ? green('✓ Found') : red('✗ Missing')}`);
console.log(`  Test Webhook Secret: ${webhookSecretTest ? green('✓ Found') : red('✗ Missing')}`);
console.log(`  Live Webhook Secret: ${webhookSecretLive ? green('✓ Found') : red('✗ Missing')}`);

// SECURITY FIX: Require test key in test mode - no fallback to live mode
// This prevents accidental usage of live keys and credentials exposure
if (!testKey) {
  console.log(red('\n❌ STRIPE_SECRET_KEY_TEST is required for test mode!'));
  console.log(red('    For safety, this tool requires explicit test key configuration.'));
  console.log(red('    Do not fall back to live keys in test environments.\n'));
  process.exit(1);
}

// Validate key format
if (!testKey.startsWith('sk_test_')) {
  console.log(red('\n❌ STRIPE_SECRET_KEY_TEST has invalid format (must start with sk_test_)\n'));
  process.exit(1);
}

const useKey = testKey;
const webhookSecret = webhookSecretTest;

if (!useKey) {
  console.log(red('\n❌ Cannot proceed: No Stripe TEST API key configured!\n'));
  process.exit(1);
}

// Initialize Stripe
const stripe = new Stripe(useKey, {
  apiVersion: '2023-10-16',
});

console.log(yellow(`\n🔌 Using TEST mode (key validated - ${useKey.substring(0, 15)}...)\n`))

async function runTests() {
  const results = [];

  // Test 1: Retrieve account info
  try {
    console.log(blue('\n[Test 1] Retrieving Stripe Account Info...'));
    const account = await stripe.account.retrieve();
    console.log(green(`  ✓ Account ID: ${account.id}`));
    console.log(green(`  ✓ Email: ${account.email || 'N/A'}`));
    console.log(green(`  ✓ Country: ${account.country}`));
    results.push({ test: 'Account Retrieval', status: 'PASS' });
  } catch (err) {
    console.log(red(`  ✗ Failed: ${err.message}`));
    results.push({ test: 'Account Retrieval', status: 'FAIL', error: err.message });
  }

  // Test 2: List products
  try {
    console.log(blue('\n[Test 2] Listing Products...'));
    const products = await stripe.products.list({ limit: 10 });
    console.log(green(`  ✓ Found ${products.data.length} product(s)`));
    products.data.forEach((p) => {
      console.log(`    - ${p.name} (${p.id})`);
    });
    results.push({ test: 'Product List', status: 'PASS' });
  } catch (err) {
    console.log(red(`  ✗ Failed: ${err.message}`));
    results.push({ test: 'Product List', status: 'FAIL', error: err.message });
  }

  // Test 3: List prices
  try {
    console.log(blue('\n[Test 3] Listing Prices...'));
    const prices = await stripe.prices.list({ limit: 10 });
    console.log(green(`  ✓ Found ${prices.data.length} price(s)`));
    prices.data.forEach((p) => {
      const amt = p.unit_amount ? `$${(p.unit_amount / 100).toFixed(2)}` : 'N/A';
      console.log(`    - ${amt} ${p.currency.toUpperCase()} / ${p.recurring?.interval || 'one-time'} (${p.id})`);
    });
    results.push({ test: 'Price List', status: 'PASS' });
  } catch (err) {
    console.log(red(`  ✗ Failed: ${err.message}`));
    results.push({ test: 'Price List', status: 'FAIL', error: err.message });
  }

  // Test 4: Create a test customer (skip in live mode)
  if (useLive) {
    console.log(blue('\n[Test 4] Creating Test Customer...'));
    console.log(yellow('  ⊘ Skipped (live mode — avoiding real customer creation)'));
    results.push({ test: 'Customer Creation', status: 'SKIP' });
  } else {
    try {
      console.log(blue('\n[Test 4] Creating Test Customer...'));
      const customer = await stripe.customers.create({
        email: 'test-dry-run@myapiai.com',
        name: 'Stripe Dry Test Customer',
        metadata: { source: 'dry-test', timestamp: new Date().toISOString() },
      });
      console.log(green(`  ✓ Customer created: ${customer.id}`));
      console.log(green(`  ✓ Email: ${customer.email}`));
      
      // Cleanup: delete the test customer
      await stripe.customers.del(customer.id);
      console.log(green(`  ✓ Customer deleted (cleanup)`));
      results.push({ test: 'Customer Creation', status: 'PASS' });
    } catch (err) {
      console.log(red(`  ✗ Failed: ${err.message}`));
      results.push({ test: 'Customer Creation', status: 'FAIL', error: err.message });
    }
  }

  // Test 5: Webhook signature validation (simulated)
  try {
    console.log(blue('\n[Test 5] Webhook Signature Validation (Simulated)...'));
    if (!webhookSecret) {
      throw new Error('Webhook secret not configured');
    }
    
    // Create a test event payload
    const testPayload = JSON.stringify({
      id: 'evt_test_webhook',
      object: 'event',
      type: 'customer.subscription.created',
      data: { object: { id: 'sub_test' } },
    });
    
    // Simulate signature generation (Stripe uses HMAC SHA256)
    const crypto = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${testPayload}`;
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');
    
    const header = `t=${timestamp},v1=${signature}`;
    
    // Validate using Stripe's constructEvent
    const event = stripe.webhooks.constructEvent(testPayload, header, webhookSecret);
    console.log(green(`  ✓ Webhook signature validated`));
    console.log(green(`  ✓ Event type: ${event.type}`));
    results.push({ test: 'Webhook Validation', status: 'PASS' });
  } catch (err) {
    console.log(red(`  ✗ Failed: ${err.message}`));
    results.push({ test: 'Webhook Validation', status: 'FAIL', error: err.message });
  }

  // Test 6: Check webhook endpoints (metadata only)
  try {
    console.log(blue('\n[Test 6] Listing Webhook Endpoints...'));
    const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });
    console.log(green(`  ✓ Found ${endpoints.data.length} webhook endpoint(s)`));
    endpoints.data.forEach((ep) => {
      const status = ep.status === 'enabled' ? green('enabled') : yellow(ep.status);
      console.log(`    - ${ep.url} [${status}]`);
      console.log(`      Events: ${ep.enabled_events.join(', ')}`);
    });
    results.push({ test: 'Webhook Endpoints', status: 'PASS' });
  } catch (err) {
    console.log(red(`  ✗ Failed: ${err.message}`));
    results.push({ test: 'Webhook Endpoints', status: 'FAIL', error: err.message });
  }

  // Summary
  console.log(blue('\n' + '='.repeat(60)));
  console.log(blue('TEST SUMMARY'));
  console.log(blue('='.repeat(60)));
  
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  
  results.forEach((r) => {
    const icon = r.status === 'PASS' ? green('✓') : r.status === 'SKIP' ? yellow('⊘') : red('✗');
    console.log(`${icon} ${r.test}: ${r.status}`);
    if (r.error) {
      console.log(`    Error: ${r.error}`);
    }
  });
  
  console.log(blue('\n' + '='.repeat(60)));
  console.log(`Total: ${results.length} | Passed: ${green(passed)} | Failed: ${red(failed)} | Skipped: ${yellow(skipped)}`);
  
  if (failed === 0) {
    console.log(green('\n🎉 All tests passed! Stripe integration is working correctly.\n'));
  } else {
    console.log(red('\n⚠️  Some tests failed. Review errors above.\n'));
    process.exit(1);
  }
}

// Run tests
runTests().catch((err) => {
  console.log(red(`\n❌ Unexpected error: ${err.message}\n`));
  console.error(err);
  process.exit(1);
});
