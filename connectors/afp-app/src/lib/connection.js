'use strict';

const os        = require('os');
const http      = require('http');
const https     = require('https');
const WebSocket = require('ws');
const { makeOps, makeMessageHandler } = require('./operations');

function resolveUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib    = parsed.protocol === 'https:' ? https : http;
      const req    = lib.request({
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     '/',
        method:   'HEAD',
      }, (res) => {
        res.resume();
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          resolve(new URL(res.headers.location, url).origin);
        } else {
          resolve(url);
        }
      });
      req.on('error', () => resolve(url));
      req.end();
    } catch (_) { resolve(url); }
  });
}

/**
 * Start the WebSocket daemon loop.
 *
 * @param {object}   cfg             - config from config.load() / oauth result
 * @param {object}   logger          - { info, warn, error, debug }
 * @param {Function} onStateChange   - (event: 'connected'|'disconnected', data) => void
 * @returns {{ stop: Function }}
 */
function start(cfg, logger, onStateChange) {
  const ops      = makeOps(cfg.afpRoot || null);
  const handleMsg = makeMessageHandler(ops, logger);
  let backoffMs  = 1000;
  let currentWs  = null;
  let stopped    = false;
  let reconnectTimer = null;

  const wsHeaders = {};
  if (cfg.cfServiceToken?.clientId) {
    wsHeaders['CF-Access-Client-Id']     = cfg.cfServiceToken.clientId;
    wsHeaders['CF-Access-Client-Secret'] = cfg.cfServiceToken.clientSecret;
  }

  async function connect(baseUrl) {
    if (stopped) return;
    if (!baseUrl) {
      baseUrl = await resolveUrl(cfg.serverUrl);
      if (baseUrl !== cfg.serverUrl) logger.info(`Resolved server: ${baseUrl}`);
    }
    const wsUrl = baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws';
    logger.info(`Connecting to ${baseUrl} ...`);
    const ws = new WebSocket(wsUrl, { headers: wsHeaders });
    currentWs = ws;

    ws.on('open', () => {
      if (stopped) { ws.terminate(); return; }
      backoffMs = 1000;
      logger.info('WebSocket open. Registering...');
      ws.send(JSON.stringify({
        type:        'afp:register',
        deviceId:    cfg.deviceId,
        deviceToken: cfg.deviceToken,
        hostname:    os.hostname(),
        platform:    process.platform,
        arch:        process.arch,
      }));
    });

    ws.on('message', (raw) => {
      // Detect afp:registered to fire connected callback
      let data;
      try { data = JSON.parse(raw); } catch (_) { data = null; }
      if (data?.type === 'afp:registered') {
        onStateChange?.('connected', { deviceId: data.deviceId || cfg.deviceId });
      }
      handleMsg(ws, raw);
    });

    ws.on('close', (code) => {
      currentWs = null;
      onStateChange?.('disconnected', { code });
      if (!stopped) {
        logger.warn(`Disconnected (${code}). Reconnecting in ${backoffMs}ms...`);
        reconnectTimer = setTimeout(() => {
          backoffMs = Math.min(backoffMs * 2, 30000);
          connect(baseUrl);
        }, backoffMs);
      }
    });

    ws.on('unexpected-response', (req, res) => {
      logger.error(`WS upgrade failed (HTTP ${res.statusCode})`);
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, baseUrl).origin;
        if (!stopped) {
          reconnectTimer = setTimeout(() => {
            backoffMs = Math.min(backoffMs * 2, 30000);
            connect(next);
          }, backoffMs);
        }
      }
    });

    ws.on('error', (err) => logger.error(`WebSocket error: ${err.message}`));
  }

  connect();

  return {
    stop() {
      stopped = true;
      clearTimeout(reconnectTimer);
      if (currentWs) {
        try { currentWs.terminate(); } catch (_) {}
        currentWs = null;
      }
    },
  };
}

module.exports = { start };
