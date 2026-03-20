#!/usr/bin/env node

/**
 * OAuth Services Configuration & Status Test
 * This script tests all OAuth services to identify which ones are configured and working
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'src/.env') });

const GoogleAdapter = require('./src/services/google-adapter');
const GitHubAdapter = require('./src/services/github-adapter');
const SlackAdapter = require('./src/services/slack-adapter');
const DiscordAdapter = require('./src/services/discord-adapter');
const WhatsAppAdapter = require('./src/services/whatsapp-adapter');
const GenericOAuthAdapter = require('./src/services/generic-oauth-adapter');

console.log('=== OAuth Services Configuration Test ===\n');

// Define services
const services = {
  google: {
    name: 'Google',
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
    adapter: GoogleAdapter
  },
  github: {
    name: 'GitHub',
    envVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_REDIRECT_URI'],
    adapter: GitHubAdapter
  },
  slack: {
    name: 'Slack',
    envVars: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'SLACK_REDIRECT_URI'],
    adapter: SlackAdapter
  },
  discord: {
    name: 'Discord',
    envVars: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI'],
    adapter: DiscordAdapter
  },
  whatsapp: {
    name: 'WhatsApp',
    envVars: ['WHATSAPP_CLIENT_ID', 'WHATSAPP_CLIENT_SECRET', 'WHATSAPP_REDIRECT_URI'],
    adapter: WhatsAppAdapter
  },
  facebook: {
    name: 'Facebook',
    envVars: ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET', 'FACEBOOK_REDIRECT_URI'],
    generic: true
  },
  instagram: {
    name: 'Instagram',
    envVars: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET', 'INSTAGRAM_REDIRECT_URI'],
    generic: true
  },
  tiktok: {
    name: 'TikTok',
    envVars: ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI'],
    generic: true
  },
  twitter: {
    name: 'Twitter/X',
    envVars: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'TWITTER_REDIRECT_URI'],
    generic: true
  },
  reddit: {
    name: 'Reddit',
    envVars: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_REDIRECT_URI'],
    generic: true
  },
  linkedin: {
    name: 'LinkedIn',
    envVars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_REDIRECT_URI'],
    generic: true
  },
  notion: {
    name: 'Notion',
    envVars: ['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET', 'NOTION_REDIRECT_URI'],
    generic: true
  }
};

// Test each service
let configuredCount = 0;
let missingCount = 0;

Object.entries(services).forEach(([key, service]) => {
  const { name, envVars } = service;
  
  const hasAllVars = envVars.every(v => process.env[v]);
  const status = hasAllVars ? '✅ CONFIGURED' : '❌ MISSING';
  
  console.log(`${status} - ${name}`);
  
  if (!hasAllVars) {
    const missing = envVars.filter(v => !process.env[v]);
    console.log(`   Missing: ${missing.join(', ')}`);
    missingCount++;
  } else {
    configuredCount++;
    // Show masked credentials
    envVars.forEach(v => {
      const val = process.env[v];
      const masked = val.substring(0, 5) + '...' + val.substring(val.length - 5);
      console.log(`   ${v}: ${masked}`);
    });
  }
  console.log();
});

console.log(`\n=== Summary ===`);
console.log(`Configured: ${configuredCount}/${Object.keys(services).length}`);
console.log(`Missing: ${missingCount}/${Object.keys(services).length}`);
console.log(`\nNote: Services with missing credentials cannot be tested until configuration is added.`);
