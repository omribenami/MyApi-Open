'use strict';

const express = require('express');
const crypto  = require('crypto');
const bcrypt  = require('bcrypt');
const path    = require('path');
const fs      = require('fs');

const {
  createAfpDevice,
  getAfpDevices,
  getAfpDeviceById,
  findAfpDeviceByHostname,
  rotateAfpDeviceToken,
  revokeAfpDevice,
  updateAfpDeviceStatus,
  logAfpCommand,
  createAuditLog,
  db,
} = require('../database');
const { pendingRequests, afpConnections } = require('../lib/afp-state');

// A device is stale (should be offline) if it has no live WebSocket AND
// last_seen_at is older than 2 minutes.
const STALE_THRESHOLD_MS = 2 * 60 * 1000;
function reconcileDeviceStatus(device) {
  const isLive = afpConnections.has(device.id);
  if (isLive) return 'online';
  if (device.status === 'online') {
    const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
    if (Date.now() - lastSeen > STALE_THRESHOLD_MS) {
      // Mark offline in DB so next read is already correct
      try { updateAfpDeviceStatus(device.id, 'offline'); } catch (_) {}
      return 'offline';
    }
  }
  return device.status;
}
const { resolveRequesterPlan } = require('../lib/planEnforcement');

const router = express.Router();

// ── Master-only gate ──────────────────────────────────────────────────────────
// Mirrors isMaster() in src/index.js. AFP is not available to guest/scoped tokens.
function requireMaster(req, res, next) {
  const m = req.tokenMeta;
  if (!m) return res.status(401).json({ error: 'Unauthorized' });
  const ok = m.scope === 'full' || m.tokenType === 'master' ||
             String(m.tokenId || '').startsWith('sess_');
  if (!ok) return res.status(403).json({ error: 'Master token required for AFP routes' });
  next();
}

// ── Pro/Enterprise plan gate ──────────────────────────────────────────────────
function requireAfpPlan(req, res, next) {
  const plan = resolveRequesterPlan(req);
  if (plan !== 'pro' && plan !== 'enterprise') {
    return res.status(403).json({
      error: 'AFP connectors require a Pro or Heavy plan',
      plan,
      feature: 'afp',
      upgradeHint: 'Upgrade to Pro ($9/mo) or Heavy ($29/mo) to use AFP connectors',
    });
  }
  next();
}

// ── WS command dispatcher ─────────────────────────────────────────────────────
const FS_TIMEOUT_MS   = 10_000;
const EXEC_TIMEOUT_MS = 30_000;

function dispatchCommand(deviceId, op, params) {
  const ws = afpConnections.get(deviceId);
  if (!ws || ws.readyState !== 1 /* OPEN */) {
    const err = new Error('Device is offline or not connected');
    err.code = 'DEVICE_OFFLINE';
    return Promise.reject(err);
  }

  const requestId = 'req_' + crypto.randomBytes(12).toString('hex');
  const timeoutMs = op === 'exec' ? EXEC_TIMEOUT_MS : FS_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      const e = new Error('Command timed out');
      e.code = 'TIMEOUT';
      reject(e);
    }, timeoutMs);

    pendingRequests.set(requestId, { resolve, reject, timer });
    ws.send(JSON.stringify({ type: 'afp:command', requestId, op, params }));
  });
}

// ── Path validation helper ─────────────────────────────────────────────────────
// Detects traversal sequences in a path string. This runs on the server before
// dispatching to the daemon to provide defense-in-depth, since the daemon enforces
// afpRoot jailing but we shouldn't forward obviously malicious paths at all.
function containsTraversal(p) {
  if (!p || typeof p !== 'string') return false;
  // Normalize separators and check for .. components
  const normalized = p.replace(/\\/g, '/');
  return normalized.split('/').some(seg => seg === '..');
}

// ── Shared file-op handler ────────────────────────────────────────────────────
async function fileOp(req, res, op, params) {
  const { deviceId } = req.params;
  const userId = req.tokenMeta.ownerId;
  const tokenId = req.tokenMeta.tokenId || null;
  const start = Date.now();

  let device;
  try {
    device = getAfpDeviceById(deviceId);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Database error' });
  }

  if (!device || device.revoked_at) {
    return res.status(404).json({ ok: false, error: 'AFP device not found' });
  }
  if (device.user_id !== userId) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }

  // Reject paths with traversal sequences before sending to the daemon.
  if (params.path && containsTraversal(params.path)) {
    return res.status(400).json({ ok: false, error: 'Invalid path: traversal sequences not allowed' });
  }

  // When the device has an afpRoot configured, enforce that the requested path
  // stays within it. We use posix normalization since all daemon targets are
  // Unix-like; Windows paths are an edge case handled by the daemon itself.
  if (device.afp_root && params.path) {
    const root = device.afp_root.replace(/\\/g, '/').replace(/\/$/, '');
    const requestedPath = params.path.replace(/\\/g, '/');
    // Absolute paths must start with the root; relative paths are allowed through
    // (the daemon resolves them relative to afpRoot).
    if (path.posix.isAbsolute(requestedPath)) {
      const resolved = path.posix.normalize(requestedPath);
      if (!resolved.startsWith(root + '/') && resolved !== root) {
        return res.status(403).json({ ok: false, error: 'Path is outside the permitted directory' });
      }
    }
  }

  try {
    const data = await dispatchCommand(deviceId, op, params);
    const duration = Date.now() - start;
    logAfpCommand(deviceId, userId, tokenId, op, params.path || null, params.cmd || null, 'ok', duration);
    createAuditLog({
      requesterId: userId,
      action: `afp:${op}`,
      resource: deviceId,
      scope: params.path || params.cmd || null,
      ip: req.ip,
    });
    return res.json({ ok: true, data });
  } catch (err) {
    const duration = Date.now() - start;
    logAfpCommand(deviceId, userId, tokenId, op, params.path || null, params.cmd || null, 'error', duration);
    const status = err.code === 'DEVICE_OFFLINE' ? 503
                 : err.code === 'TIMEOUT'        ? 504
                 : 500;
    return res.status(status).json({ ok: false, error: err.message, code: err.code || 'ERROR' });
  }
}

// ── Device management (static routes BEFORE /:deviceId) ──────────────────────

// GET /api/v1/afp/devices — list all registered daemons for this user
router.get('/devices', requireMaster, requireAfpPlan, (req, res) => {
  const userId = req.tokenMeta.ownerId;
  try {
    const devices = getAfpDevices(userId).map(d => ({
      id: d.id,
      name: d.device_name,
      hostname: d.hostname,
      platform: d.platform,
      arch: d.arch,
      capabilities: d.capabilities_json ? JSON.parse(d.capabilities_json) : [],
      status: reconcileDeviceStatus(d),
      afpRoot: d.afp_root || null,
      privileges: d.afp_root ? 'restricted' : 'full',
      lastSeenAt: d.last_seen_at,
      createdAt: d.created_at,
    }));
    res.json({ ok: true, devices });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to list devices' });
  }
});

// POST /api/v1/afp/devices/register — daemon self-registers
// Upserts: if a non-revoked device already exists for this user + hostname + platform,
// rotate its token in-place rather than creating a duplicate row.
// Returns: { deviceId, deviceToken }  ← store token in daemon; never log it
router.post('/devices/register', requireMaster, requireAfpPlan, async (req, res) => {
  const { deviceName, hostname, platform, arch, capabilities = ['fs', 'exec'] } = req.body;
  if (!deviceName || typeof deviceName !== 'string' || !deviceName.trim()) {
    return res.status(400).json({ ok: false, error: 'deviceName is required' });
  }

  const rawToken = 'afpd_' + crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 10);
  const userId = req.tokenMeta.ownerId;
  const afpRoot = req.body.afpRoot || null;

  let deviceId;
  let isNew = true;

  try {
    // Re-use an existing device row if one exists for the same machine.
    // This prevents a new row from appearing in the Devices list every time
    // the app re-authenticates (e.g. after a token rotation or re-install).
    const existing = hostname ? findAfpDeviceByHostname(userId, hostname, platform || null) : null;

    if (existing) {
      rotateAfpDeviceToken(existing.id, deviceName.trim(), arch || null, capabilities, tokenHash, afpRoot);
      deviceId = existing.id;
      isNew = false;
    } else {
      deviceId = createAfpDevice(
        userId, deviceName.trim(), hostname || null,
        platform || null, arch || null, capabilities, tokenHash, afpRoot,
      );
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Failed to register device' });
  }

  createAuditLog({
    requesterId: userId,
    action: isNew ? 'afp:device_registered' : 'afp:device_token_rotated',
    resource: deviceId,
    ip: req.ip,
    details: { deviceName: deviceName.trim(), platform, hostname },
  });

  res.status(isNew ? 201 : 200).json({ ok: true, deviceId, deviceToken: rawToken });
});

// ── One-line installer enrollment ─────────────────────────────────────────────
// Flow: dashboard POSTs /enroll-code → user copy-pastes one command on the
// server → install.sh downloads the binary and exchanges the code at /enroll
// for device credentials. The code is random, expires in 15 minutes, and is
// single-use — the user never touches a long-lived token during setup.

const ENROLL_CODE_TTL_MS = 15 * 60 * 1000;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// POST /api/v1/afp/enroll-code — create a one-time enrollment code (auth required)
router.post('/enroll-code', requireMaster, requireAfpPlan, (req, res) => {
  try {
    const userId = req.tokenMeta.ownerId;
    const block = () => crypto.randomBytes(4).toString('hex').toUpperCase();
    const code = `AFP-${block()}-${block()}`;
    const now = new Date();
    db.prepare(`
      INSERT INTO afp_enroll_codes (id, code_hash, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('aec_' + crypto.randomBytes(8).toString('hex'), sha256(code), userId,
           now.toISOString(), new Date(now.getTime() + ENROLL_CODE_TTL_MS).toISOString());

    const host = req.headers.host || 'www.myapiai.com';
    const base = `https://${host}`;
    createAuditLog({ requesterId: userId, action: 'afp:enroll_code_created', resource: 'afp', ip: req.ip });
    res.json({
      ok: true,
      code,
      expiresInMinutes: ENROLL_CODE_TTL_MS / 60000,
      command: `curl -fsSL ${base}/api/v1/afp/install.sh | sudo bash -s -- ${code}`,
      commandUnix: `curl -fsSL ${base}/api/v1/afp/install.sh | sudo bash -s -- ${code}`,
      // Windows PowerShell one-liner (run in an elevated PowerShell).
      commandWindows: `irm ${base}/api/v1/afp/install.ps1 | iex; Install-MyApiAfp ${code}`,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to create enrollment code' });
  }
});

// POST /api/v1/afp/enroll — exchange an enrollment code for device credentials.
// PUBLIC (called by install.sh from the target machine before it has any
// credentials). Security: code is unguessable (64 bits), single-use, 15-min TTL.
router.post('/enroll', (req, res) => {
  try {
    const { code, deviceName, hostname, platform, arch, capabilities, afpRoot } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ ok: false, error: 'code is required' });
    }
    const row = db.prepare('SELECT * FROM afp_enroll_codes WHERE code_hash = ?').get(sha256(code.trim()));
    if (!row || row.used_at || new Date(row.expires_at) <= new Date()) {
      return res.status(403).json({ ok: false, error: 'Invalid, expired, or already-used enrollment code. Generate a new one from the Connectors page.' });
    }
    db.prepare('UPDATE afp_enroll_codes SET used_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);

    const userId = row.user_id;
    const name = String(deviceName || hostname || 'Linux Server').trim().slice(0, 80);
    const rawToken = 'afpd_' + crypto.randomBytes(32).toString('hex');
    const tokenHash = bcrypt.hashSync(rawToken, 10);

    let deviceId;
    const existing = hostname ? findAfpDeviceByHostname(userId, hostname, platform || null) : null;
    if (existing) {
      rotateAfpDeviceToken(existing.id, name, arch || null, capabilities || ['fs', 'exec'], tokenHash, afpRoot || null);
      deviceId = existing.id;
    } else {
      deviceId = createAfpDevice(userId, name, hostname || null, platform || null, arch || null,
                                 capabilities || ['fs', 'exec'], tokenHash, afpRoot || null);
    }

    createAuditLog({
      requesterId: userId,
      action: 'afp:device_enrolled',
      resource: deviceId,
      ip: req.ip,
      details: { deviceName: name, hostname, platform, via: 'install.sh' },
    });
    res.status(201).json({ ok: true, deviceId, deviceToken: rawToken });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Enrollment failed' });
  }
});

// GET /api/v1/afp/install.sh — one-line installer for Linux/macOS servers.
// PUBLIC. Usage: curl -fsSL https://host/api/v1/afp/install.sh | sudo bash -s -- AFP-XXXX-XXXX
router.get('/install.sh', (req, res) => {
  const host = req.headers.host || 'www.myapiai.com';
  const base = `https://${host}`;
  res.type('text/x-shellscript').send(`#!/usr/bin/env bash
# MyApi AFP connector — one-line installer (Linux / macOS, systemd or launchd)
# Downloads the daemon, enrolls this machine with your one-time code, writes its
# config, and installs it as a service. Nothing else to configure.
set -euo pipefail

CODE="\${1:-\${MYAPI_ENROLL_CODE:-}}"
BASE_URL="\${MYAPI_URL:-${base}}"
BIN=/usr/local/bin/myapi-afp

if [ -z "$CODE" ]; then
  echo "Usage: curl -fsSL $BASE_URL/api/v1/afp/install.sh | sudo bash -s -- AFP-XXXX-XXXX" >&2
  echo "Generate a code on the Connectors page: $BASE_URL/dashboard/connectors" >&2
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo — the installer writes to /usr/local/bin and installs a service." >&2
  exit 1
fi

OS="$(uname -s)"; ARCH="$(uname -m)"
case "$OS" in
  Linux)  PLATFORM=linux;  DL=linux ;;
  Darwin) PLATFORM=darwin; if [ "$ARCH" = "arm64" ]; then DL=mac-arm; else DL=mac; fi ;;
  *) echo "Unsupported OS: $OS" >&2; exit 1 ;;
esac

TARGET_USER="\${SUDO_USER:-root}"
TARGET_HOME="$(eval echo "~$TARGET_USER")"

echo "→ Downloading daemon ($DL)..."
curl -fSL "$BASE_URL/api/v1/afp/download/$DL" -o "$BIN.tmp"
chmod +x "$BIN.tmp" && mv "$BIN.tmp" "$BIN"

echo "→ Enrolling this machine..."
RESP="$(curl -fsS -X POST "$BASE_URL/api/v1/afp/enroll" \\
  -H 'Content-Type: application/json' \\
  -d "{\\"code\\":\\"$CODE\\",\\"deviceName\\":\\"$(hostname)\\",\\"hostname\\":\\"$(hostname)\\",\\"platform\\":\\"$PLATFORM\\",\\"arch\\":\\"$ARCH\\"}")"
DEVICE_ID="$(printf '%s' "$RESP" | sed -n 's/.*"deviceId":"\\([^"]*\\)".*/\\1/p')"
DEVICE_TOKEN="$(printf '%s' "$RESP" | sed -n 's/.*"deviceToken":"\\([^"]*\\)".*/\\1/p')"
if [ -z "$DEVICE_ID" ] || [ -z "$DEVICE_TOKEN" ]; then
  echo "Enrollment failed: $RESP" >&2
  exit 1
fi

echo "→ Writing config for $TARGET_USER..."
CONF_DIR="$TARGET_HOME/.myapi-afp"
mkdir -p "$CONF_DIR"
cat > "$CONF_DIR/config.json" <<CONF
{
  "serverUrl": "$BASE_URL",
  "deviceId": "$DEVICE_ID",
  "deviceToken": "$DEVICE_TOKEN",
  "deviceName": "$(hostname)"
}
CONF
chown -R "$TARGET_USER" "$CONF_DIR"
chmod 600 "$CONF_DIR/config.json"

if [ "$PLATFORM" = "linux" ]; then
  echo "→ Installing systemd service..."
  cat > /etc/systemd/system/myapi-afp.service <<UNIT
[Unit]
Description=MyApi AFP Connector
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=10

[Service]
Type=simple
User=$TARGET_USER
ExecStart=$BIN
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable --now myapi-afp
  echo "✓ Installed and running. Check: systemctl status myapi-afp"
else
  echo "→ Installing launchd agent..."
  PLIST="$TARGET_HOME/Library/LaunchAgents/com.myapi.afp.plist"
  mkdir -p "$(dirname "$PLIST")"
  cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.myapi.afp</string>
  <key>ProgramArguments</key><array><string>$BIN</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
PL
  chown "$TARGET_USER" "$PLIST"
  sudo -u "$TARGET_USER" launchctl load -w "$PLIST" 2>/dev/null || true
  echo "✓ Installed and running (launchd)."
fi

echo "✓ Done — this machine will appear under Connected Devices on the Connectors page within a minute."
`);
});

// GET /api/v1/afp/install.ps1 — one-line installer for Windows.
// PUBLIC. Usage (elevated PowerShell):
//   irm https://host/api/v1/afp/install.ps1 | iex; Install-MyApiAfp AFP-XXXX-XXXX
router.get('/install.ps1', (req, res) => {
  const host = req.headers.host || 'www.myapiai.com';
  const base = `https://${host}`;
  res.type('text/plain').send(`# MyApi AFP connector — one-line installer (Windows)
# Downloads the daemon, enrolls this machine with your one-time code, writes its
# config, and registers an auto-start task. Run in an elevated PowerShell:
#   irm ${base}/api/v1/afp/install.ps1 | iex; Install-MyApiAfp AFP-XXXX-XXXX

function Install-MyApiAfp {
  param([Parameter(Mandatory=$true)][string]$Code)
  $ErrorActionPreference = 'Stop'
  $Base = '${base}'

  $dir = Join-Path $env:APPDATA 'MyApi-AFP'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $bin = Join-Path $dir 'myapi-afp.exe'

  Write-Host '-> Downloading daemon...'
  Invoke-WebRequest -Uri ($Base + '/api/v1/afp/download/win') -OutFile $bin -UseBasicParsing

  Write-Host '-> Enrolling this machine...'
  $arch = if ($env:PROCESSOR_ARCHITECTURE) { $env:PROCESSOR_ARCHITECTURE } else { 'x64' }
  $payload = @{ code=$Code; deviceName=$env:COMPUTERNAME; hostname=$env:COMPUTERNAME; platform='win32'; arch=$arch } | ConvertTo-Json -Compress
  $resp = Invoke-RestMethod -Uri ($Base + '/api/v1/afp/enroll') -Method Post -ContentType 'application/json' -Body $payload
  if (-not $resp.deviceToken) { throw 'Enrollment failed — generate a new code on the Connectors page.' }

  Write-Host '-> Writing config...'
  $cfg = @{ serverUrl=$Base; deviceId=$resp.deviceId; deviceToken=$resp.deviceToken; deviceName=$env:COMPUTERNAME } | ConvertTo-Json
  # WriteAllText with a no-BOM UTF8 encoding — Windows PowerShell 5.1's
  # Set-Content -Encoding UTF8 emits a BOM that breaks the daemon's JSON.parse.
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Join-Path $dir 'config.json'), $cfg, $utf8NoBom)

  Write-Host '-> Registering auto-start task...'
  $tr = '"' + $bin + '"'
  schtasks /Create /TN 'MyApiAFP' /TR $tr /SC ONLOGON /RL LIMITED /F | Out-Null
  Start-Process -FilePath $bin -WindowStyle Hidden

  Write-Host '+ Installed and running. This machine will appear under Connected Devices shortly.'
}
`);
});

// DELETE /api/v1/afp/devices/:deviceId — revoke a daemon
router.delete('/devices/:deviceId', requireMaster, requireAfpPlan, (req, res) => {
  const userId = req.tokenMeta.ownerId;
  const { deviceId } = req.params;

  let device;
  try {
    device = getAfpDeviceById(deviceId);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Database error' });
  }

  if (!device || device.revoked_at) {
    return res.status(404).json({ ok: false, error: 'AFP device not found' });
  }
  if (device.user_id !== userId) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }

  revokeAfpDevice(deviceId);

  // Close any live WS connection for this device
  const ws = afpConnections.get(deviceId);
  if (ws) {
    try { ws.close(1000, 'Device revoked'); } catch (_) {}
    afpConnections.delete(deviceId);
  }

  createAuditLog({ requesterId: userId, action: 'afp:device_revoked', resource: deviceId, ip: req.ip });
  res.json({ ok: true });
});

// ── File system + exec operations ─────────────────────────────────────────────

// GET  /:deviceId/ls?path=<dir>
router.get('/:deviceId/ls', requireMaster, requireAfpPlan, (req, res) =>
  fileOp(req, res, 'ls', { path: req.query.path || '.' }));

// GET  /:deviceId/read?path=<file>
router.get('/:deviceId/read', requireMaster, requireAfpPlan, (req, res) =>
  fileOp(req, res, 'read', { path: req.query.path }));

// GET  /:deviceId/stat?path=<path>
router.get('/:deviceId/stat', requireMaster, requireAfpPlan, (req, res) =>
  fileOp(req, res, 'stat', { path: req.query.path }));

// POST /:deviceId/write  body: { path, content, encoding? }
router.post('/:deviceId/write', requireMaster, requireAfpPlan, (req, res) =>
  fileOp(req, res, 'write', {
    path: req.body.path,
    content: req.body.content,
    encoding: req.body.encoding || 'utf8',
  }));

// DELETE /:deviceId/rm  body: { path, recursive? }
router.delete('/:deviceId/rm', requireMaster, requireAfpPlan, (req, res) =>
  fileOp(req, res, 'rm', {
    path: req.body.path,
    recursive: !!req.body.recursive,
  }));

// POST /:deviceId/mkdir  body: { path, recursive? }
router.post('/:deviceId/mkdir', requireMaster, requireAfpPlan, (req, res) =>
  fileOp(req, res, 'mkdir', {
    path: req.body.path,
    recursive: req.body.recursive !== false,
  }));

// POST /:deviceId/exec  body: { cmd, cwd?, timeout?, shell? }
router.post('/:deviceId/exec', requireMaster, requireAfpPlan, (req, res) =>
  fileOp(req, res, 'exec', {
    cmd: req.body.cmd,
    cwd: req.body.cwd || undefined,
    timeout: Math.min(Number(req.body.timeout) || 30000, 60000),
    shell: req.body.shell !== false,
  }));

// ── Downloads ─────────────────────────────────────────────────────────────────
// GET /api/v1/afp/download/:platform — serve compiled daemon binary
// Requires auth (session or bearer) but NOT master — any logged-in user can download.
// platform: linux | mac | mac-arm | win

const DIST_DIR = path.join(__dirname, '..', '..', 'connectors', 'afp-daemon', 'dist');

const PLATFORM_FILES = {
  linux:     { file: 'afp-daemon-linux',        name: 'afp-daemon-linux',           mime: 'application/octet-stream' },
  mac:       { file: 'afp-daemon-macos-x64',    name: 'afp-daemon-macos-x64',       mime: 'application/octet-stream' },
  'mac-arm': { file: 'afp-daemon-macos-arm64',  name: 'afp-daemon-macos-arm64',     mime: 'application/octet-stream' },
  win:       { file: 'afp-daemon-win-x64.exe',  name: 'afp-daemon-win-x64.exe',     mime: 'application/vnd.microsoft.portable-executable' },
};

router.get('/download/:platform', (req, res) => {
  const meta = PLATFORM_FILES[req.params.platform];
  if (!meta) {
    return res.status(400).json({ error: 'Unknown platform. Use: linux, mac, mac-arm, win' });
  }
  const filePath = path.join(DIST_DIR, meta.file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: 'Binary not yet built for this platform.',
      hint: 'Run: cd connectors/afp-daemon && npm run build',
    });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${meta.name}"`);
  res.setHeader('Content-Type', meta.mime);
  res.sendFile(filePath);
});

// GET /api/v1/afp/download/installer/:platform — serve desktop app installer
// No auth required — public download endpoint.
// platform: win

const INSTALLER_DIR = process.env.NODE_ENV === 'production'
  ? '/app/connectors/afp-app/dist'
  : path.join(__dirname, '..', '..', 'connectors', 'afp-app', 'dist');

// Candidate files per platform, in preference order. The first one present on
// disk is served — so a CI-built signed installer (.exe / .dmg) wins, with a
// portable .zip as a fallback for environments where the packaged installer
// isn't built (e.g. NSIS needs Windows/wine).
const INSTALLER_FILES = {
  win:       { files: ['MyApi-AFP-win-x64.exe', 'MyApi-AFP-win-x64.zip'] },
  'mac-arm': { files: ['MyApi-AFP-mac-arm64.dmg', 'MyApi-AFP-mac-arm64.zip'] },
  mac:       { files: ['MyApi-AFP-mac-x64.dmg', 'MyApi-AFP-mac-x64.zip'] },
};
const INSTALLER_MIME = {
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.dmg': 'application/x-apple-diskimage',
  '.zip': 'application/zip',
};

// Resolve the best available installer file for a platform (or the preferred
// candidate marked missing when none exist yet).
function resolveInstaller(platform) {
  const meta = INSTALLER_FILES[platform];
  if (!meta) return null;
  for (const f of meta.files) {
    const p = path.join(INSTALLER_DIR, f);
    try { if (fs.existsSync(p)) return { name: f, path: p, mime: INSTALLER_MIME[path.extname(f)] || 'application/octet-stream' }; } catch (_) {}
  }
  const f = meta.files[0];
  return { name: f, path: path.join(INSTALLER_DIR, f), mime: INSTALLER_MIME[path.extname(f)] || 'application/octet-stream', missing: true };
}

router.get('/download/installer/:platform', (req, res) => {
  if (!INSTALLER_FILES[req.params.platform]) {
    return res.status(400).json({ error: `Unknown platform. Available: ${Object.keys(INSTALLER_FILES).join(', ')}` });
  }
  const meta = resolveInstaller(req.params.platform);
  if (meta.missing) {
    return res.status(404).json({ error: 'Installer not yet available for this platform.' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${meta.name}"`);
  res.setHeader('Content-Type', meta.mime);
  res.sendFile(meta.path);
});

// GET /api/v1/afp/installer-info — which desktop installers are actually built,
// so the UI shows a real Download button only when an artifact exists (a packaged
// installer or a portable zip). macOS auto-activates when its artifact is published.
router.get('/installer-info', (req, res) => {
  const platforms = Object.keys(INSTALLER_FILES).map((platform) => {
    const meta = resolveInstaller(platform);
    let size = null;
    if (!meta.missing) { try { size = fs.statSync(meta.path).size; } catch (_) {} }
    return { platform, filename: meta.name, available: size !== null, size };
  });
  res.json({ ok: true, platforms });
});

// GET /api/v1/afp/download-info — return available platforms + file sizes
router.get('/download-info', (req, res) => {
  const platforms = Object.entries(PLATFORM_FILES).map(([platform, meta]) => {
    const filePath = path.join(DIST_DIR, meta.file);
    let size = null;
    try { size = fs.statSync(filePath).size; } catch (_) {}
    return { platform, filename: meta.name, available: size !== null, size };
  });
  res.json({ ok: true, platforms });
});

// Exposed for the trigger executor (in-process AFP calls) — non-breaking: the
// module still exports the router for app.use(). Callers MUST verify device
// ownership before invoking (see actionExecutor).
router.dispatchCommand = dispatchCommand;

module.exports = router;
