#!/usr/bin/env node
/**
 * Create Stripe Products & Prices for MyApi
 * Creates Free, Pro, and Enterprise tiers with recurring billing
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');

// ANSI colors
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const blue = (s) => `\x1b[34m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

console.log(blue('\n💳 STRIPE PRODUCT CREATOR — MyApi Subscription Tiers\n'));

// Use LIVE mode for production products
const liveKey = process.env.STRIPE_SECRET_KEY_LIVE;

if (!liveKey) {
  console.log(red('❌ STRIPE_SECRET_KEY_LIVE not found in .env\n'));
  process.exit(1);
}

const stripe = new Stripe(liveKey, {
  apiVersion: '2023-10-16',
});

console.log(yellow('🔌 Using LIVE mode — Creating production products\n'));

// Product definitions
const PRODUCTS = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for personal projects and testing',
    features: [
      '1,000 API calls/month',
      '3 active services',
      '50 skill installs',
      'Community support',
    ],
    price: 0, // Free
    currency: 'usd',
    interval: 'month',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For power users and small teams',
    features: [
      '100,000 API calls/month',
      'Unlimited services',
      'Unlimited skill installs',
      'Priority support',
      'Custom domains',
    ],
    price: 2900, // $29.00
    currency: 'usd',
    interval: 'month',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large teams and organizations',
    features: [
      'Unlimited API calls',
      'Unlimited services',
      'Unlimited skill installs',
      '24/7 priority support',
      'Custom domains',
      'SSO & RBAC',
      'SLA guarantee',
      'Dedicated account manager',
    ],
    price: 9900, // $99.00
    currency: 'usd',
    interval: 'month',
  },
];

async function createProducts() {
  console.log(cyan('📦 Creating Products & Prices...\n'));

  const results = [];

  for (const def of PRODUCTS) {
    try {
      console.log(blue(`\n[${def.name}] Creating product...`));

      // Create product
      const product = await stripe.products.create({
        name: def.name,
        description: def.description,
        metadata: {
          tier: def.id,
          features: def.features.join(' | '),
          created_by: 'myapi-setup-script',
        },
      });

      console.log(green(`  ✓ Product created: ${product.id}`));
      console.log(`    Name: ${product.name}`);
      console.log(`    Description: ${product.description}`);

      // Create price (skip for free tier, but create a $0 price for consistency)
      let price = null;
      
      if (def.price === 0) {
        console.log(yellow(`  ⊘ Skipping price creation for Free tier (no billing needed)`));
      } else {
        console.log(blue(`  Creating price ($${(def.price / 100).toFixed(2)}/${def.interval})...`));
        
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: def.price,
          currency: def.currency,
          recurring: {
            interval: def.interval,
          },
          metadata: {
            tier: def.id,
          },
        });

        console.log(green(`  ✓ Price created: ${price.id}`));
        console.log(`    Amount: $${(price.unit_amount / 100).toFixed(2)} ${price.currency.toUpperCase()}`);
        console.log(`    Interval: ${price.recurring.interval}`);
      }

      results.push({
        tier: def.id,
        product,
        price,
      });

    } catch (err) {
      console.log(red(`  ✗ Failed: ${err.message}`));
      if (err.code === 'resource_already_exists') {
        console.log(yellow(`  ℹ Product may already exist, continuing...`));
      }
    }
  }

  return results;
}

async function updateEnvFile(results) {
  console.log(blue('\n📝 Updating .env file with product/price IDs...\n'));

  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');

  for (const result of results) {
    const { tier, product, price } = result;
    
    const productKey = `STRIPE_PRODUCT_ID_${tier.toUpperCase()}_LIVE`;
    const priceKey = `STRIPE_PRICE_ID_${tier.toUpperCase()}_LIVE`;

    // Check if keys already exist
    const productRegex = new RegExp(`^${productKey}=.*$`, 'm');
    const priceRegex = new RegExp(`^${priceKey}=.*$`, 'm');

    if (productRegex.test(envContent)) {
      envContent = envContent.replace(productRegex, `${productKey}=${product.id}`);
      console.log(green(`  ✓ Updated ${productKey}`));
    } else {
      envContent += `\n${productKey}=${product.id}`;
      console.log(green(`  ✓ Added ${productKey}`));
    }

    if (price) {
      if (priceRegex.test(envContent)) {
        envContent = envContent.replace(priceRegex, `${priceKey}=${price.id}`);
        console.log(green(`  ✓ Updated ${priceKey}`));
      } else {
        envContent += `\n${priceKey}=${price.id}`;
        console.log(green(`  ✓ Added ${priceKey}`));
      }
    }
  }

  fs.writeFileSync(envPath, envContent);
  console.log(green('\n✅ .env file updated successfully!\n'));
}

async function displaySummary(results) {
  console.log(blue('\n' + '='.repeat(70)));
  console.log(blue('SUMMARY — Products Created'));
  console.log(blue('='.repeat(70) + '\n'));

  for (const result of results) {
    const { tier, product, price } = result;
    console.log(cyan(`${tier.toUpperCase()} Tier:`));
    console.log(`  Product: ${product.id}`);
    console.log(`  Name: ${product.name}`);
    if (price) {
      console.log(`  Price: ${price.id} ($${(price.unit_amount / 100).toFixed(2)}/${price.recurring.interval})`);
    } else {
      console.log(`  Price: N/A (Free tier)`);
    }
    console.log('');
  }

  console.log(green('🎉 All products created successfully!\n'));
  console.log(yellow('Next steps:'));
  console.log('  1. Verify products in Stripe Dashboard: https://dashboard.stripe.com/products');
  console.log('  2. Create payment links for Pro & Enterprise tiers');
  console.log('  3. Test checkout flow with a test subscription\n');
}

// Main execution
(async () => {
  try {
    const results = await createProducts();
    
    if (results.length > 0) {
      await updateEnvFile(results);
      await displaySummary(results);
    } else {
      console.log(red('\n❌ No products were created\n'));
      process.exit(1);
    }
  } catch (err) {
    console.log(red(`\n❌ Unexpected error: ${err.message}\n`));
    console.error(err);
    process.exit(1);
  }
})();
