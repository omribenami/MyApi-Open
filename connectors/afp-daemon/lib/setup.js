'use strict';

/**
 * First-run setup wizard for the AFP Daemon.
 *
 * Prompts the user for:
 *   1. MyApi server URL
 *   2. Master token  (used once to register this PC — not stored)
 *   3. Device name   (defaults to hostname)
 *   4. Optional path jail (AFP_ROOT)
 *   5. Whether to install as a background service
 *
 * On success writes config to ~/.myapi-afp/config.json and returns it.
 */

const readline = require('readline');
const os       = require('os');
const path     = require('path');
const fs       = require('fs');
const config   = require('./config');

// ── Readline helpers ──────────────────────────────────────────────────────────

function ask(rl, question, defaultValue) {
  return new Promise(resolve => {
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(prompt, answer => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

function askSecret(rl, question) {
  return new Promise(resolve => {
    // Show asterisks while typing (best-effort on terminals that support it)
    process.stdout.write(`${question}: `);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    let input = '';
    const onData = ch => {
      ch = ch.toString();
      if (ch === '\n' || ch === '\r' || ch === '\u0004') { // enter / ctrl-d
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
        }
        process.stdout.write('\n');
        resolve(input);
      } else if (ch === '\u0003') { // ctrl-c
        process.stdout.write('\n');
        process.exit(0);
      } else if (ch === '\u007f' || ch === '\b') { // backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        input += ch;
        process.stdout.write('*');
      }
    };
    if (process.stdin.isTTY) {
      process.stdin.on('data', onData);
    } else {
      // Non-TTY (piped input): just use readline normally
      rl.question(`${question}: `, answer => resolve(answer.trim()));
    }
  });
}

// ── HTTP registration call ────────────────────────────────────────────────────
// Uses Node 18+ built-in fetch which handles redirects, TLS, and keep-alive.

async function registerDevice(serverUrl, masterToken, deviceName, afpRoot, cfServiceToken) {
  const url = new URL('/api/v1/afp/devices/register', serverUrl).toString();
  const body = JSON.stringify({
    deviceName,
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    capabilities: ['fs', 'exec'],
    ...(afpRoot ? { afpRoot } : {}),
  });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${masterToken}`,
  };

  // Cloudflare Access service token (optional)
  if (cfServiceToken && cfServiceToken.clientId && cfServiceToken.clientSecret) {
    headers['CF-Access-Client-Id']     = cfServiceToken.clientId;
    headers['CF-Access-Client-Secret'] = cfServiceToken.clientSecret;
  }

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') throw new Error('Connection timed out after 15s');
    throw new Error(`Could not reach server: ${err.message}`);
  }

  let text;
  try { text = await res.text(); } catch (_) { text = ''; }

  // Detect Cloudflare Access interception
  if (text.includes('Cloudflare Access') || text.includes('cloudflareaccess.com')) {
    throw new Error(
      'CLOUDFLARE_ACCESS\n' +
      'Your server is protected by Cloudflare Access.\n' +
      'The daemon cannot log in through a browser.\n\n' +
      'Fix options:\n' +
      '  A) Create a Cloudflare Service Token (recommended):\n' +
      '     Cloudflare dashboard → Access → Service Auth → Create Service Token\n' +
      '     Then re-run setup — it will ask for the Client ID and Secret.\n\n' +
      '  B) Add a Cloudflare Access bypass rule for /api/v1/afp/*\n' +
      '     so the AFP routes are reachable without browser login.'
    );
  }

  // Try to parse as JSON
  let parsed;
  try { parsed = JSON.parse(text); } catch (_) {
    throw new Error(
      `Server returned HTTP ${res.status} with non-JSON response.\n` +
      `    Make sure the URL is correct and the server is running.\n` +
      `    (Got: ${text.slice(0, 120).replace(/\n/g, ' ')})`
    );
  }

  if (res.status === 200 || res.status === 201) return parsed;
  throw new Error(parsed.error || `HTTP ${res.status}`);
}

// ── Service installers ────────────────────────────────────────────────────────

function getExecutablePath() {
  // pkg sets process.pkg when running as a compiled executable
  return process.pkg ? process.execPath : process.argv[1];
}

function installServiceLinux(configDir) {
  const serviceFile = path.join(os.homedir(), '.config', 'systemd', 'user', 'myapi-afp.service');
  const serviceDir  = path.dirname(serviceFile);
  const exePath     = getExecutablePath();

  const unit = `[Unit]
Description=MyApi AFP Daemon
After=network.target

[Service]
Type=simple
ExecStart=${exePath}
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
`;

  fs.mkdirSync(serviceDir, { recursive: true });
  fs.writeFileSync(serviceFile, unit, 'utf8');

  const { execSync } = require('child_process');
  try {
    execSync('systemctl --user daemon-reload', { stdio: 'ignore' });
    execSync('systemctl --user enable --now myapi-afp.service', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function installServiceMac() {
  const plistDir  = path.join(os.homedir(), 'Library', 'LaunchAgents');
  const plistFile = path.join(plistDir, 'com.myapi.afp-daemon.plist');
  const exePath   = getExecutablePath();

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.myapi.afp-daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>${exePath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${os.homedir()}/.myapi-afp/daemon.log</string>
    <key>StandardErrorPath</key>
    <string>${os.homedir()}/.myapi-afp/daemon.log</string>
</dict>
</plist>
`;

  fs.mkdirSync(plistDir, { recursive: true });
  fs.writeFileSync(plistFile, plist, 'utf8');

  const { execSync } = require('child_process');
  try {
    execSync(`launchctl load -w "${plistFile}"`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function installServiceWindows() {
  const taskName  = 'MyApi-AFP-Daemon';
  const exePath   = getExecutablePath();
  const { execSync } = require('child_process');
  try {
    // Remove old task if exists
    execSync(`schtasks /delete /tn "${taskName}" /f`, { stdio: 'ignore' });
  } catch (_) {}
  try {
    execSync(
      `schtasks /create /tn "${taskName}" /tr "${exePath}" /sc ONLOGON /rl HIGHEST /f`,
      { stdio: 'ignore' }
    );
    execSync(`schtasks /run /tn "${taskName}"`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function installService() {
  switch (process.platform) {
    case 'linux':  return installServiceLinux();
    case 'darwin': return installServiceMac();
    case 'win32':  return installServiceWindows();
    default:       return false;
  }
}

function getServiceInstructions() {
  switch (process.platform) {
    case 'linux':
      return 'Run: systemctl --user enable --now myapi-afp.service';
    case 'darwin':
      return `Run: launchctl load -w ~/Library/LaunchAgents/com.myapi.afp-daemon.plist`;
    case 'win32':
      return 'Run as Administrator: schtasks /create /tn "MyApi-AFP-Daemon" /tr "<path-to-exe>" /sc ONLOGON /rl HIGHEST /f';
    default:
      return 'Start the daemon manually and keep the process running.';
  }
}

// ── Main wizard ───────────────────────────────────────────────────────────────

async function run(logger) {
  const log = logger || { info: console.log, warn: console.warn, error: console.error };
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         MyApi AFP Daemon — First-Time Setup       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('This wizard will connect your PC to your MyApi server');
  console.log('so that AI agents can access your files securely.');
  console.log('');

  // Step 1 — Server URL
  let serverUrl = '';
  while (!serverUrl) {
    const input = await ask(rl, 'Step 1 › MyApi server URL\n  e.g. https://myapi.example.com or http://localhost:4500\n>', '');
    serverUrl = input.replace(/\/+$/, ''); // strip trailing slashes
    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      console.log('  ✗ URL must start with http:// or https://');
      serverUrl = '';
    }
  }

  // Step 2 — Master token
  console.log('');
  console.log('Step 2 › Master token');
  console.log('  Find this in MyApi Dashboard → Settings → Access Tokens');
  const masterToken = await askSecret(rl, '>');
  if (!masterToken || masterToken.length < 10) {
    console.log('\n  ✗ Token looks too short. Please re-run setup.\n');
    rl.close();
    process.exit(1);
  }

  // Step 3 — Device name
  console.log('');
  const defaultName = os.hostname();
  const deviceName  = await ask(rl, `Step 3 › Device name for this PC`, defaultName);

  // Step 4 — Optional path jail
  console.log('');
  console.log('Step 4 › Path restrictions (optional)');
  console.log('  Leave blank to allow access to the full filesystem.');
  console.log('  Enter a folder path to restrict access to that folder only.');
  const rootInput = await ask(rl, '  Restrict to folder', '');
  const afpRoot   = rootInput && rootInput.trim() ? path.resolve(rootInput.trim()) : null;

  // Register (with optional Cloudflare Access retry)
  console.log('');
  console.log('  Registering this PC with MyApi ...');
  let registration;
  let cfServiceToken = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      registration = await registerDevice(serverUrl, masterToken, deviceName, afpRoot, cfServiceToken);
      break; // success
    } catch (err) {
      if (err.message.startsWith('CLOUDFLARE_ACCESS')) {
        const alreadyTriedToken = cfServiceToken !== null;
        console.log('\n  ✗ Cloudflare Access is blocking the connection.\n');

        if (alreadyTriedToken) {
          console.log('  The service token was sent but Cloudflare still blocked the request.');
          console.log('  This usually means the token has not been added to the Access Policy yet.\n');
          console.log('  In the Cloudflare dashboard:');
          console.log('    1. Go to Access → Applications → find dev.myapiai.com → Edit');
          console.log('    2. Open the Policy that protects this app');
          console.log('    3. Add a new rule: Selector = "Service Token" → Value = the token you created');
          console.log('    4. Save, then try again here.\n');
        } else {
          console.log('  Your server is protected by Cloudflare Access.\n');
          console.log('  To fix:');
          console.log('    1. Cloudflare dashboard → Access → Service Auth → Create Service Token');
          console.log('    2. Go to Access → Applications → your app → Edit Policy');
          console.log('    3. Add rule: Service Token = the token you just created');
          console.log('    4. Come back here and enter "token"\n');
        }

        const choice = await ask(rl, '  Enter "token" to provide/retry CF Service Token, or "exit" to quit', 'token');
        if (choice.toLowerCase() === 'exit') { rl.close(); process.exit(1); }

        console.log('');
        console.log('  Cloudflare Service Token');
        console.log('  (Cloudflare dashboard → Access → Service Auth → Create Service Token)');
        let clientId = await ask(rl, '  CF-Access-Client-Id', '');
        // Strip label if user pastes "CF-Access-Client-Id: value" from the dashboard
        clientId = clientId.replace(/^CF-Access-Client-Id:\s*/i, '').trim();

        let clientSecret = await askSecret(rl, '  CF-Access-Client-Secret');
        clientSecret = clientSecret.replace(/^CF-Access-Client-Secret:\s*/i, '').trim();
        if (!clientId || !clientSecret) {
          console.log('  Both fields are required. Try again.\n');
          continue;
        }
        cfServiceToken = { clientId, clientSecret };
        console.log('\n  Retrying with Cloudflare service token ...');
      } else {
        console.log(`\n  ✗ Registration failed: ${err.message}`);
        console.log('    Check the URL and master token, then run again.\n');
        rl.close();
        process.exit(1);
      }
    }
  }
  console.log(`  ✓ Registered! Device ID: ${registration.deviceId}`);

  // Save config — master token NOT stored, only the device credentials
  const cfg = {
    serverUrl,
    deviceId:    registration.deviceId,
    deviceToken: registration.deviceToken,
    deviceName,
    afpRoot:     afpRoot || null,
    cfServiceToken: cfServiceToken || null,
  };
  config.save(cfg);
  log.info(`Config saved to: ${config.getConfigPath()}`);
  console.log(`  ✓ Config saved to: ${config.getConfigPath()}`);

  // Step 5 — Service install
  console.log('');
  const installAnswer = await ask(rl, 'Step 5 › Install as a background service that starts at login? [Y/n]', 'Y');
  const doInstall = installAnswer.toLowerCase() !== 'n';
  if (doInstall) {
    console.log('  Installing service ...');
    const ok = installService();
    if (ok) {
      log.info('Service installed and started successfully.');
      console.log('  ✓ Service installed and started!');
      console.log('    The daemon will now start automatically at login.');
    } else {
      log.warn('Automatic service install failed — manual start required.');
      console.log('  ! Could not install service automatically.');
      console.log(`    To start manually: ${getServiceInstructions()}`);
    }
  } else {
    console.log(`  To start the daemon: ${getServiceInstructions()}`);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║              Setup complete!                      ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // Platform-specific post-install guidance
  if (process.platform === 'win32') {
    const logPath = require('./logger').getLogPath();
    console.log('  Windows tips:');
    console.log('  • The daemon is running as a background Task Scheduler task.');
    console.log('  • To check if it\'s running:  Open Task Manager → Details → look for afp-daemon-win-x64.exe');
    console.log(`  • Log file location:         ${logPath}`);
    console.log('');
    console.log('  Run these commands from the folder where the .exe is saved:');
    console.log('    .\\afp-daemon-win-x64.exe --status   ← is it running?');
    console.log('    .\\afp-daemon-win-x64.exe --logs     ← view log output');
    console.log('    .\\afp-daemon-win-x64.exe --stop     ← stop the daemon');
    console.log('    .\\afp-daemon-win-x64.exe --reset    ← wipe config and re-run setup');
    console.log('');
    console.log('  NOTE: In PowerShell you MUST prefix with .\\  (dot-backslash)');
    console.log('        because Windows does not run files from the current folder by default.');
    console.log('');
    console.log('  You can now close this window — the daemon is running in the background.');
  } else if (process.platform === 'darwin') {
    console.log('  Mac tips:');
    console.log('  • The daemon runs as a LaunchAgent (starts at login).');
    console.log('  • Check status:  ./afp-daemon-macos-x64 --status');
    console.log('  • View logs:     ./afp-daemon-macos-x64 --logs');
    console.log('  • Stop:          ./afp-daemon-macos-x64 --stop');
    console.log('');
  } else {
    console.log('  Check status:  ./afp-daemon-linux --status');
    console.log('  View logs:     ./afp-daemon-linux --logs');
    console.log('  Stop:          ./afp-daemon-linux --stop');
    console.log('');
  }

  rl.close();
  return cfg;
}

module.exports = { run };
