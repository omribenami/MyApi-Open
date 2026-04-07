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
  revokeAfpDevice,
  logAfpCommand,
  createAuditLog,
} = require('../database');
const { pendingRequests, afpConnections } = require('../lib/afp-state');
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
      error: 'AFP connectors require a Pro or Enterprise plan',
      plan,
      feature: 'afp',
      upgradeHint: 'Upgrade to Pro or Enterprise to use AFP connectors',
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
      status: d.status,
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
// Returns: { deviceId, deviceToken }  ← store token in daemon env, never log it
router.post('/devices/register', requireMaster, requireAfpPlan, async (req, res) => {
  const { deviceName, hostname, platform, arch, capabilities = ['fs', 'exec'] } = req.body;
  if (!deviceName || typeof deviceName !== 'string' || !deviceName.trim()) {
    return res.status(400).json({ ok: false, error: 'deviceName is required' });
  }

  const rawToken = 'afpd_' + crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(rawToken, 10); // cost 10: one-time handshake, not user password
  const userId = req.tokenMeta.ownerId;

  const afpRoot = req.body.afpRoot || null;

  let deviceId;
  try {
    deviceId = createAfpDevice(
      userId, deviceName.trim(), hostname || null,
      platform || null, arch || null, capabilities, tokenHash, afpRoot,
    );
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Failed to register device' });
  }

  createAuditLog({
    requesterId: userId,
    action: 'afp:device_registered',
    resource: deviceId,
    ip: req.ip,
    details: { deviceName: deviceName.trim(), platform, hostname },
  });

  res.status(201).json({ ok: true, deviceId, deviceToken: rawToken });
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

module.exports = router;
