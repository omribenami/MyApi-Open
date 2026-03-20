#!/usr/bin/env node

/**
 * OAuth Services Debug Script
 * This script checks the configuration and identifies issues with each OAuth service
 */

const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, 'src/.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

// Parse OAuth configuration
const services = {
  github: {
    name: 'GitHub',
    requiredVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_REDIRECT_URI'],
    notes: 'Using custom GitHubAdapter',
    knownIssues: []
  },
  discord: {
    name: 'Discord',
    requiredVars: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI'],
    notes: 'Using custom DiscordAdapter (fix applied: scope not in token exchange)',
    knownIssues: []
  },
  slack: {
    name: 'Slack',
    requiredVars: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'SLACK_REDIRECT_URI'],
    notes: 'Using custom SlackAdapter, requests user_scope only',
    knownIssues: []
  },
  facebook: {
    name: 'Facebook',
    requiredVars: ['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET', 'FACEBOOK_REDIRECT_URI'],
    notes: 'Using GenericOAuthAdapter',
    knownIssues: []
  },
  instagram: {
    name: 'Instagram',
    requiredVars: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET', 'INSTAGRAM_REDIRECT_URI'],
    notes: 'Using GenericOAuthAdapter',
    knownIssues: ['Missing Instagram OAuth credentials in .env']
  },
  tiktok: {
    name: 'TikTok',
    requiredVars: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI'],
    notes: 'Uses CLIENT_KEY instead of CLIENT_ID',
    knownIssues: []
  },
  twitter: {
    name: 'Twitter/X',
    requiredVars: ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'TWITTER_REDIRECT_URI'],
    notes: 'Uses PKCE flow',
    knownIssues: []
  },
  reddit: {
    name: 'Reddit',
    requiredVars: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_REDIRECT_URI'],
    notes: 'Requires basic auth for token exchange',
    knownIssues: ['Missing Reddit OAuth credentials in .env']
  },
  linkedin: {
    name: 'LinkedIn',
    requiredVars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_REDIRECT_URI'],
    notes: 'Using deprecated scopes (r_liteprofile r_emailaddress), should use openid profile email',
    knownIssues: ['⚠️  CRITICAL: Using deprecated LinkedIn scopes that LinkedIn removed in 2019']
  },
  notion: {
    name: 'Notion',
    requiredVars: ['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET', 'NOTION_REDIRECT_URI'],
    notes: 'Uses basic auth for token exchange',
    knownIssues: []
  },
  google: {
    name: 'Google',
    requiredVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
    notes: 'Using custom GoogleAdapter',
    knownIssues: []
  }
};

console.log('=== OAuth Services Configuration Debug ===\n');

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const results = {
  configured: [],
  missing: [],
  critical: []
};

Object.entries(services).forEach(([key, service]) => {
  const hasAll = service.requiredVars.every(v => env[v]);
  const status = hasAll ? '✅' : '❌';
  const hasCritical = service.knownIssues.some(i => i.startsWith('⚠️  CRITICAL'));
  
  console.log(`${status} ${service.name}`);
  console.log(`   Adapter: ${service.notes}`);
  
  if (!hasAll) {
    const missing = service.requiredVars.filter(v => !env[v]);
    console.log(`   ❌ Missing: ${missing.join(', ')}`);
    results.missing.push({ service: key, missing });
  } else {
    console.log(`   ✅ Configured: ${service.requiredVars.join(', ')}`);
  }
  
  if (service.knownIssues && service.knownIssues.length > 0) {
    service.knownIssues.forEach(issue => {
      console.log(`   ${issue}`);
      if (issue.startsWith('⚠️  CRITICAL')) {
        results.critical.push({ service: key, issue });
      }
    });
  }
  
  console.log();
});

console.log('=== Summary ===');
console.log(`Configured: ${Object.keys(services).length - results.missing.length}/${Object.keys(services).length}`);
console.log(`Missing Credentials: ${results.missing.length}`);
console.log(`Critical Issues: ${results.critical.length}`);

if (results.missing.length > 0) {
  console.log('\n=== Services Missing Credentials ===');
  results.missing.forEach(({ service, missing }) => {
    console.log(`${service}: ${missing.join(', ')}`);
  });
}

if (results.critical.length > 0) {
  console.log('\n=== Critical Issues Requiring Fixes ===');
  results.critical.forEach(({ service, issue }) => {
    console.log(`${service}: ${issue}`);
  });
}
