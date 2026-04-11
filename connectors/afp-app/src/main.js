'use strict';

const { app, Tray, Menu, shell, Notification, dialog, nativeImage } = require('electron');
const path        = require('path');
const os          = require('os');

const credentials = require('./lib/credentials');
const config      = require('./lib/config');
const oauth       = require('./lib/oauth');
const connection  = require('./lib/connection');
const logger      = require('./lib/logger');
const { httpRequest } = require('./lib/http');

const MYAPI_URL = (process.env.MYAPI_URL || 'https://myapiai.com').replace(/\/$/, '');

// ── Single instance lock ───────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// ── macOS: hide from Dock, don't quit on last window ──────────────────────────
app.dock?.hide();
app.on('window-all-closed', () => { /* stay alive — tray-only app */ });

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  status:     'idle',       // idle | authenticating | connecting | connected | disconnected
  deviceName: os.hostname(),
  deviceId:   null,
  wsHandle:   null,
};

// ── Tray ──────────────────────────────────────────────────────────────────────
let tray = null;

function assetPath(name) {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, 'assets');
  return path.join(base, name);
}

function getTrayIcon(status) {
  const isMac   = process.platform === 'darwin';
  const suffix  = isMac ? '-Template' : '';
  const primary = assetPath(`tray-${status}${suffix}.png`);
  const retina  = assetPath(`tray-${status}${suffix}@2x.png`);

  try {
    const img = nativeImage.createFromPath(primary);
    // Add @2x representation for macOS retina
    if (isMac) {
      try {
        const img2x = nativeImage.createFromPath(retina);
        if (!img2x.isEmpty()) img.addRepresentation({ scaleFactor: 2.0, buffer: img2x.toPNG() });
      } catch (_) {}
    }
    if (!img.isEmpty()) return img;
  } catch (_) {}

  // Fallback: 1×1 transparent PNG so the app doesn't crash if assets are missing
  return nativeImage.createEmpty();
}

function buildMenuTemplate() {
  const isConnected    = state.status === 'connected';
  const isDisconnected = state.status === 'disconnected';
  const isBusy         = state.status === 'connecting' || state.status === 'authenticating';
  const autostart      = app.getLoginItemSettings().openAtLogin;

  const statusLabel = isConnected
    ? `● Connected — ${state.deviceName}`
    : isBusy
    ? '↻ Connecting...'
    : '○ Disconnected';

  return [
    { label: 'MyApi AFP', enabled: false },
    { type: 'separator' },
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    { label: 'Connect',    visible: isDisconnected, click: startConnection },
    { label: 'Disconnect', visible: isConnected,    click: stopConnection  },
    { type: 'separator' },
    { label: 'Re-authenticate...', click: reAuthenticate },
    { type: 'separator' },
    {
      label:   'Start on Login',
      type:    'checkbox',
      checked: autostart,
      click:   () => setAutostart(!autostart),
    },
    { type: 'separator' },
    { label: 'Remove & Reset...', click: removeAndReset },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ];
}

function updateTray() {
  if (!tray) return;
  const iconStatus = state.status === 'connected' ? 'connected'
    : (state.status === 'connecting' || state.status === 'authenticating') ? 'connecting'
    : 'disconnected';

  tray.setImage(getTrayIcon(iconStatus));
  tray.setToolTip(
    state.status === 'connected'
      ? `MyApi AFP — Connected (${state.deviceName})`
      : state.status === 'connecting' || state.status === 'authenticating'
      ? 'MyApi AFP — Connecting...'
      : 'MyApi AFP — Disconnected'
  );
  tray.setContextMenu(Menu.buildFromTemplate(buildMenuTemplate()));
}

function setState(next, data = {}) {
  state.status = next;
  if (data.deviceId)   state.deviceId   = data.deviceId;
  if (data.deviceName) state.deviceName = data.deviceName;
  updateTray();
}

// ── Connection lifecycle ───────────────────────────────────────────────────────

function startConnection(cfg) {
  const savedCfg = cfg || config.load();
  if (!savedCfg?.deviceId) { startAuthentication(); return; }
  // Stop any existing handle before starting a new one. Without this, calling
  // startConnection() a second time (e.g. user clicks "Connect" from the tray)
  // leaves the old handle running. If that old handle's device later gets revoked,
  // it loops forever trying to reconnect against a revoked device.
  if (state.wsHandle) {
    state.wsHandle.stop();
    state.wsHandle = null;
  }
  setState('connecting', { deviceName: savedCfg.deviceName || os.hostname() });
  logger.info(`Connecting to ${savedCfg.serverUrl || MYAPI_URL} as device ${savedCfg.deviceId}`);
  state.wsHandle = connection.start(savedCfg, logger, (event, data) => {
    if (event === 'connected')    { logger.info(`Connected — device: ${state.deviceName}`); setState('connected', data); }
    if (event === 'disconnected') { logger.info('Disconnected'); setState('disconnected', {}); }
    if (event === 'needs-reauth') {
      state.wsHandle = null;
      setState('disconnected');
      notify('MyApi AFP — Re-authentication required', data.message || 'Device credentials are invalid. Please re-authenticate.');
      reAuthenticate();
    }
  });
}

function stopConnection() {
  state.wsHandle?.stop();
  state.wsHandle = null;
  setState('disconnected');
}

async function startAuthentication() {
  setState('authenticating');
  logger.info(`Starting OAuth flow → ${MYAPI_URL}`);
  try {
    const cfg = await oauth.runOAuthFlow({
      serverUrl:  MYAPI_URL,
      deviceName: state.deviceName,
      afpRoot:    null,
      openUrl:    (url) => { logger.info(`Opening browser for OAuth: ${url.split('?')[0]}`); shell.openExternal(url); },
    });
    logger.info(`OAuth complete — device: ${cfg.deviceId}, name: ${cfg.deviceName}`);
    config.save(cfg);
    credentials.save({ accessToken: cfg.accessToken, deviceId: cfg.deviceId, deviceToken: cfg.deviceToken, registeredAt: cfg.registeredAt });
    setState('connecting', { deviceName: cfg.deviceName, deviceId: cfg.deviceId });
    startConnection(cfg);
  } catch (err) {
    logger.error(`OAuth failed: ${err.message}`);
    setState('disconnected');
    notify('Authentication failed', err.message);
  }
}

// ── Menu actions ───────────────────────────────────────────────────────────────

function setAutostart(enable) {
  app.setLoginItemSettings({ openAtLogin: enable, openAsHidden: true });
  const cfg = config.load() || {};
  config.save({ ...cfg, autostart: enable });
  updateTray();
}

async function reAuthenticate() {
  stopConnection();
  credentials.clear();

  const cfg = config.load();
  if (cfg?.deviceId) {
    // Best-effort deregister old device
    try {
      await httpRequest(
        'DELETE',
        `${cfg.serverUrl || MYAPI_URL}/api/v1/afp/devices/${cfg.deviceId}`,
        null,
        { Authorization: `Bearer ${cfg.accessToken}` }
      );
    } catch (_) {}
    // Keep serverUrl + deviceName, clear device creds
    config.save({ serverUrl: cfg.serverUrl, deviceName: cfg.deviceName, afpRoot: cfg.afpRoot });
  }

  startAuthentication();
}

async function removeAndReset() {
  const { response } = await dialog.showMessageBox({
    type:      'warning',
    buttons:   ['Remove & Reset', 'Cancel'],
    defaultId: 1,
    cancelId:  1,
    title:     'Remove & Reset',
    message:   'Remove this device from MyApi?',
    detail:    'This will disconnect, delete all credentials, and unregister this device. Your MyApi account is not affected.',
  });
  if (response !== 0) return;

  stopConnection();

  const cfg = config.load();
  if (cfg?.deviceId) {
    try {
      await httpRequest(
        'DELETE',
        `${cfg.serverUrl || MYAPI_URL}/api/v1/afp/devices/${cfg.deviceId}`,
        null,
        { Authorization: `Bearer ${cfg.accessToken}` }
      );
    } catch (_) {}
  }

  credentials.clear();
  config.clear();
  app.setLoginItemSettings({ openAtLogin: false });

  notify('MyApi AFP', 'Device removed. Credentials deleted.');
  setTimeout(() => app.quit(), 1500);
}

// ── Notifications ──────────────────────────────────────────────────────────────

function notify(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body }).show();
}

// ── App ready ─────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Init modules that need userData path
  const userData = app.getPath('userData');
  const logsPath = app.getPath('logs');
  credentials.init(userData);
  config.init(userData);
  logger.init(logsPath);

  logger.info(`MyApi AFP starting — ${process.platform} ${process.arch}`);

  tray = new Tray(getTrayIcon('disconnected'));
  tray.setToolTip('MyApi AFP');
  updateTray();

  // Auto-connect or authenticate on startup
  const cfg = config.load();
  if (cfg?.deviceId) {
    startConnection(cfg);
  } else {
    startAuthentication();
  }
});

app.on('before-quit', () => {
  logger.info('Quitting...');
  state.wsHandle?.stop();
});

// Focus existing instance if launched again
app.on('second-instance', () => {
  notify('MyApi AFP', 'Already running in the system tray.');
});
