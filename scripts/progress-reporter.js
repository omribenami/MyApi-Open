#!/usr/bin/env node

/**
 * MyApi Progress Reporter
 * Sends automated progress reports at 8 AM (text + voice) and 6 PM (text only)
 * Integrates with OpenClaw message tool for WhatsApp delivery
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = path.join(__dirname, '..');
const STATUS_FILE = path.join(PROJECT_DIR, 'PROJECT_STATUS.md');

function getPhaseStatus() {
  try {
    const content = fs.readFileSync(STATUS_FILE, 'utf8');
    const lines = content.split('\n');
    
    let phaseTable = '';
    let inTable = false;
    
    for (const line of lines) {
      if (line.includes('| Phase | Feature')) {
        inTable = true;
      }
      if (inTable) {
        if (line.startsWith('---')) {
          break;
        }
        phaseTable += line + '\n';
      }
    }
    
    return phaseTable || 'Unable to read phase status';
  } catch (e) {
    return 'Error reading PROJECT_STATUS.md';
  }
}

function getRecentCommits() {
  try {
    const cmd = "git log --oneline --since='24 hours ago' --grep='phase' | head -10";
    const output = execSync(cmd, { cwd: PROJECT_DIR, encoding: 'utf8' });
    return output.trim() || 'No recent phase commits';
  } catch (e) {
    return 'Error reading git commits';
  }
}

function getOverallProgress() {
  try {
    const content = fs.readFileSync(STATUS_FILE, 'utf8');
    const match = content.match(/Overall Progress: (.*?)$/m);
    return match ? match[1] : 'Unknown';
  } catch (e) {
    return 'Unknown';
  }
}

function generateReport() {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const hour = new Date().getHours();
  const isVoice = hour === 8;
  
  const report = `🚀 **MyApi Tier 2/3 Implementation - Progress Report**

**Time:** ${timestamp} CDT

**Overall Progress:** ${getOverallProgress()}

**Phase Status:**
\`\`\`
${getPhaseStatus()}
\`\`\`

**Recent Commits (Last 24h):**
\`\`\`
${getRecentCommits()}
\`\`\`

**View Details:** See PROJECT_STATUS.md for complete breakdown
`;

  return { report, isVoice, timestamp };
}

function shouldRun() {
  const hour = new Date().getHours();
  return hour === 8 || hour === 18; // 8 AM or 6 PM
}

function main() {
  const args = process.argv.slice(2);
  const forceRun = args.includes('--force');
  
  if (!shouldRun() && !forceRun) {
    console.log('Not scheduled time. Use --force to send anyway.');
    return;
  }

  const { report, isVoice, timestamp } = generateReport();
  
  console.log('\n' + '='.repeat(60));
  console.log(`Progress Report - ${timestamp}`);
  console.log('='.repeat(60));
  console.log(report);
  console.log('='.repeat(60));
  
  if (isVoice) {
    console.log('\n🔊 [At 8 AM, this would also be sent as a voice note]');
    console.log(`Voice message length: ${Math.ceil(report.length / 100)} seconds (approx)`);
  }
  
  console.log('\n📨 [Report would be sent via WhatsApp message tool]');
  console.log(`Report type: ${isVoice ? 'Text + Voice' : 'Text Only'}`);
  
  // Log for external integration
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: isVoice ? 'morning' : 'evening',
    reportLength: report.length,
    status: 'pending_send'
  };
  
  console.log('\nLog Entry:', JSON.stringify(logEntry, null, 2));
}

main();
