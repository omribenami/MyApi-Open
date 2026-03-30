#!/usr/bin/env node

/**
 * MyApi ChatGPT Setup CLI Tool
 * 
 * Usage:
 *   npm install -g chatgpt-myapi-setup
 *   chatgpt-myapi-setup
 * 
 * Or run directly:
 *   node chatgpt-setup-cli.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(text) {
  console.log('\n' + '='.repeat(60));
  log(text, 'bright');
  console.log('='.repeat(60) + '\n');
}

function question(prompt) {
  return new Promise(resolve => {
    rl.question(`${colors.cyan}${prompt}${colors.reset}`, resolve);
  });
}

async function getToken() {
  header('🤖 MyApi ChatGPT Setup');

  log('This tool will help you set up ChatGPT with MyApi in 5 minutes.\n', 'cyan');

  log('Step 1: Get Your MyApi Token', 'bright');
  log('Visit: https://www.myapiai.com/dashboard/tokens', 'blue');
  log('Copy a token starting with "myapi_"\n', 'cyan');

  const token = await question('Paste your MyApi token here: ');

  if (!token || !token.trim().startsWith('myapi_')) {
    log('❌ Invalid token. It should start with "myapi_"', 'red');
    process.exit(1);
  }

  return token.trim();
}

function generateInstructions(token) {
  return `You are an AI assistant connected to MyApi, a unified OAuth service integration platform.

You have access to the user's connected OAuth services through the MyApi proxy API.

Available services (if connected): Twitter, Google Workspace, Slack, Facebook, GitHub, Discord, LinkedIn, Notion, Dropbox, Instagram, Threads, TikTok, Microsoft 365, Reddit, Trello, Zoom, HubSpot, Salesforce, and Jira.

When the user asks you to:
- Send/post something → Use the service proxy API to call the appropriate endpoint
- Read/check something → Query the service's read endpoints
- Manage data → Use create/update/delete endpoints as needed

Always:
1. Ask for clarification if needed
2. Confirm the action before executing
3. Explain what you're about to do
4. Report the result clearly
5. If a service returns an error, help debug by explaining common causes

For API calls, use POST to https://www.myapiai.com/api/v1/services/{service}/proxy with:
{
  "method": "GET|POST|PUT|DELETE",
  "path": "/api/endpoint/path",
  "body": {...optional request body...}
}

Example: To send a tweet:
{
  "method": "POST",
  "path": "/2/tweets",
  "body": {"text": "The tweet content"}
}

Known limitations:
- Twitter: Read-only (tweet.write not yet granted)
- Google: Calendar/Gmail read-only
- Facebook: Cannot post to feed (publish_actions not granted)

Be helpful, clear, and always respect user privacy.`;
}

function generateOpenAPISchema() {
  return `openapi: 3.0.0
info:
  title: MyApi Service Proxy
  description: Access integrated OAuth services
  version: 1.0.0
servers:
  - url: https://www.myapiai.com/api/v1
paths:
  /services/{service}/proxy:
    post:
      summary: Call any integrated service
      parameters:
        - name: service
          in: path
          required: true
          schema:
            type: string
            enum: [twitter, google, slack, facebook, instagram, github, discord, linkedin, notion, dropbox, threads, tiktok, microsoft365, reddit, trello, zoom, hubspot, salesforce, jira]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [method, path]
              properties:
                method:
                  type: string
                  enum: [GET, POST, PUT, DELETE, PATCH]
                path:
                  type: string
                body:
                  type: object
      responses:
        '200':
          description: Success`;
}

async function showSteps(token) {
  header('Setup Steps');

  log('📋 Step 1: Create Custom GPT', 'bright');
  log('  1. Go to https://chatgpt.com/gpts/mine', 'cyan');
  log('  2. Click "Create a GPT"', 'cyan');
  log('  3. Name: MyApi Services', 'cyan');
  log('  4. Description: Access my OAuth services', 'cyan');
  log('  5. Click "Create"\n', 'cyan');

  await question('Press ENTER when done...');

  header('Step 2: Add Instructions');

  log('📋 Copy this to ChatGPT Instructions section:', 'bright');
  const instructions = generateInstructions(token);
  
  // Show first 500 chars
  log(instructions.substring(0, 500) + '...', 'blue');
  log('\n[Full instructions will be saved to file]\n', 'yellow');

  await question('Press ENTER when copied...');

  header('Step 3: Add Action');

  log('📋 In ChatGPT Actions section:', 'bright');
  log('  1. Click "Create new action"', 'cyan');
  log('  2. Click "Import from URL"', 'cyan');
  log('  3. Paste: https://raw.githubusercontent.com/omribenami/MyApi/main/openapi-chatgpt-schema.yaml', 'cyan');
  log('  4. Click "Import"\n', 'cyan');

  await question('Press ENTER when done...');

  header('Step 4: Authentication');

  log('🔐 In ChatGPT Action Authentication:', 'bright');
  log('  1. Auth Type: API Key', 'cyan');
  log('  2. Auth: Bearer', 'cyan');
  log('  3. API Key Value: ', 'cyan');
  log(`     ${token}`, 'yellow');
  log('', 'cyan');
  log('  ⚠️  Keep this token secret!', 'red');
  log('', 'cyan');

  await question('Press ENTER when done...');
}

async function saveFiles(token) {
  header('Saving Configuration Files');

  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const configDir = path.join(homeDir, '.myapi-chatgpt');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Save instructions
  const instructionsFile = path.join(configDir, 'chatgpt-instructions.txt');
  fs.writeFileSync(instructionsFile, generateInstructions(token));
  log(`✅ Instructions saved to: ${instructionsFile}`, 'green');

  // Save schema
  const schemaFile = path.join(configDir, 'openapi-schema.yaml');
  fs.writeFileSync(schemaFile, generateOpenAPISchema());
  log(`✅ Schema saved to: ${schemaFile}`, 'green');

  // Save token config
  const configFile = path.join(configDir, 'config.json');
  fs.writeFileSync(configFile, JSON.stringify({
    token,
    createdAt: new Date().toISOString(),
    apiUrl: 'https://www.myapiai.com/api/v1'
  }, null, 2));
  log(`✅ Config saved to: ${configFile}`, 'green');

  // Save setup info
  const setupFile = path.join(configDir, 'SETUP.md');
  fs.writeFileSync(setupFile, `# MyApi ChatGPT Setup

Created: ${new Date().toISOString()}

## Your Token
\`\`\`
${token}
\`\`\`

## Files
- \`chatgpt-instructions.txt\` - Instructions to paste in ChatGPT
- \`openapi-schema.yaml\` - OpenAPI schema for the action
- \`config.json\` - Configuration (keep this safe!)

## Next Steps
1. Create a Custom GPT at https://chatgpt.com/gpts/mine
2. Copy contents of \`chatgpt-instructions.txt\` to Instructions
3. Add Action and import \`openapi-schema.yaml\`
4. Set authentication with your token

## Test
Try asking ChatGPT:
- "What services do I have connected?"
- "Send a tweet saying hello"
- "Add an event to my calendar"
`);
  log(`✅ Setup guide saved to: ${setupFile}`, 'green');

  log(`\n📁 Configuration directory: ${configDir}\n`, 'cyan');
}

async function showSuccess() {
  header('🎉 Setup Complete!');

  log('Your ChatGPT Custom GPT is configured to access MyApi.', 'green');
  log('', 'reset');
  log('Next steps:', 'bright');
  log('  1. Open ChatGPT at https://chatgpt.com', 'cyan');
  log('  2. Go to your Custom GPT', 'cyan');
  log('  3. Test with: "List my connected services"', 'cyan');
  log('  4. Try: "Send a tweet saying hello"', 'cyan');
  log('', 'reset');
  log('Questions? Check the SETUP.md file in ~/.myapi-chatgpt/', 'yellow');
  log('', 'reset');
}

async function main() {
  try {
    const token = await getToken();
    await showSteps(token);
    await saveFiles(token);
    await showSuccess();
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run
main();
