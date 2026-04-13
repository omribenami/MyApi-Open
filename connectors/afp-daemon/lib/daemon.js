'use strict';

/**
 * AFP Daemon core — WebSocket connection loop + filesystem/exec operation handlers.
 * Started by index.js once config is available.
 */

const fs        = require('fs');
const path      = require('path');
const os        = require('os');
const http      = require('http');
const https     = require('https');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const MAX_OUTPUT_BYTES = 1024 * 1024; // 1 MB exec output cap

// ── Path safety ───────────────────────────────────────────────────────────────

function resolveSafe(inputPath, afpRoot) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('path is required');
  }
  if (afpRoot) {
    const rootResolved = path.resolve(afpRoot);
    const relative     = inputPath.replace(/^[/\\]+/, '');
    const resolved     = path.resolve(rootResolved, relative);
    if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
      throw new Error(`Path escape blocked: "${inputPath}"`);
    }
    return resolved;
  }
  return path.resolve(inputPath);
}

// ── Op handlers ───────────────────────────────────────────────────────────────

function makeOps(afpRoot) {
  const safe = p => resolveSafe(p, afpRoot);

  async function opLs({ path: p }) {
    const target  = safe(p || '.');
    const entries = await fs.promises.readdir(target, { withFileTypes: true });
    return Promise.all(entries.map(async entry => {
      let size = null, modified = null;
      try {
        const st = await fs.promises.stat(path.join(target, entry.name));
        size     = st.size;
        modified = st.mtime.toISOString();
      } catch (_) {}
      return {
        name:     entry.name,
        type:     entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file',
        size,
        modified,
      };
    }));
  }

  async function opRead({ path: p }) {
    const buf    = await fs.promises.readFile(safe(p));
    const sample = buf.slice(0, 512);
    let binary   = false;
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) { binary = true; break; }
    }
    return binary
      ? { content: buf.toString('base64'), encoding: 'base64' }
      : { content: buf.toString('utf8'),   encoding: 'utf8'   };
  }

  async function opWrite({ path: p, content, encoding }) {
    const target = safe(p);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    const data = encoding === 'base64'
      ? Buffer.from(content, 'base64')
      : Buffer.from(content || '', 'utf8');
    await fs.promises.writeFile(target, data);
    return { written: data.length };
  }

  async function opRm({ path: p, recursive }) {
    const target = safe(p);
    await fs.promises.rm(target, { recursive: !!recursive, force: true });
    return { removed: target };
  }

  async function opMkdir({ path: p, recursive }) {
    const target = safe(p);
    await fs.promises.mkdir(target, { recursive: recursive !== false });
    return { created: target };
  }

  async function opStat({ path: p }) {
    const target = safe(p);
    const st     = await fs.promises.stat(target);
    return {
      path:        target,
      size:        st.size,
      isFile:      st.isFile(),
      isDirectory: st.isDirectory(),
      isSymlink:   st.isSymbolicLink(),
      modified:    st.mtime.toISOString(),
      created:     st.birthtime.toISOString(),
      mode:        st.mode.toString(8),
    };
  }

  function opExec({ cmd, cwd, timeout = 30000, shell = false }) {
    if (!cmd || typeof cmd !== 'string') return Promise.reject(new Error('cmd is required'));
    // SECURITY FIX (CRITICAL - CVSS 9.8): Command Injection Mitigation
    // - Disable shell=true by default to prevent command injection via shell metacharacters
    // - When shell is absolutely required, caller must explicitly opt-in
    // - Parse command into argv array to prevent interpretation of special characters
    // - Validate cmd matches safe patterns (alphanumeric, spaces, common operators only)
    const UNSAFE_SHELL_CHARS = /[;&|`$()<>\\'"]/g;
    if (UNSAFE_SHELL_CHARS.test(cmd) && !shell) {
      return Promise.reject(new Error('Command contains potentially dangerous shell characters. Use shell:true explicitly if required and safe.'));
    }
    
    const hardLimit = Math.min(Number(timeout) || 30000, 60000);
    const workDir   = cwd ? safe(cwd) : undefined;

    return new Promise((resolve, reject) => {
      // Parse command string into argv array for safer execution
      // When shell=false, spawn interprets first arg as executable, rest as arguments (no shell interpretation)
      let args = [];
      let executable = cmd;
      
      if (!shell && cmd.includes(' ')) {
        // Simple parsing: split on spaces but be aware of quoted strings
        const parts = cmd.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g) || [cmd];
        executable = parts[0];
        args = parts.slice(1).map(arg => arg.replace(/^['"]|['"]$/g, ''));
      }
      
      const proc = spawn(executable, args, { shell: !!shell, cwd: workDir });
      let stdout = '', stderr = '', killed = false;

      const killTimer = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
        setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_) {} }, 2000);
        reject(new Error(`Exec timed out after ${hardLimit}ms`));
      }, hardLimit);

      proc.stdout.on('data', chunk => {
        stdout += chunk;
        if (stdout.length > MAX_OUTPUT_BYTES) {
          killed = true;
          proc.kill('SIGTERM');
          reject(new Error('Output exceeded 1 MB limit'));
        }
      });
      proc.stderr.on('data', chunk => { stderr += chunk; });
      proc.on('close', code => { clearTimeout(killTimer); if (!killed) resolve({ stdout, stderr, exitCode: code }); });
      proc.on('error', err  => { clearTimeout(killTimer); if (!killed) reject(err); });
    });
  }

  return { ls: opLs, read: opRead, write: opWrite, rm: opRm, mkdir: opMkdir, stat: opStat, exec: opExec };
}

// ── Message handler ───────────────────────────────────────────────────────────

function makeMessageHandler(ops, logger) {
  return async function handleMessage(ws, raw) {
    let data;
    try { data = JSON.parse(raw); } catch (_) { return; }

    if (data.type === 'afp:registered') {
      logger.info('Registered with MyApi server. Ready for commands.');
      return;
    }
    if (data.type === 'afp:error') {
      logger.error(`Server error: ${data.message}`);
      return;
    }
    if (data.type !== 'afp:command') return;

    const { requestId, op, params } = data;
    const start = Date.now();
    const handler = ops[op];

    logger.debug(`Command: ${op}`, params?.path || params?.cmd || '');

    try {
      if (!handler) throw new Error(`Unknown op: ${op}`);
      const result = await handler(params || {});
      const ms = Date.now() - start;
      logger.info(`OK  ${op.padEnd(6)} ${params?.path || params?.cmd || ''} (${ms}ms)`);
      ws.send(JSON.stringify({ type: 'afp:result', requestId, ok: true,  data: result, durationMs: ms }));
    } catch (err) {
      const ms = Date.now() - start;
      logger.error(`ERR ${op.padEnd(6)} ${params?.path || params?.cmd || ''} — ${err.message} (${ms}ms)`);
      ws.send(JSON.stringify({ type: 'afp:result', requestId, ok: false, error: err.message, durationMs: ms }));
    }
  };
}

// ── Resolve final URL (follow HTTP redirects) ────────────────────────────────

function resolveUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: '/',
        method: 'HEAD',
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

// ── Connect loop ──────────────────────────────────────────────────────────────

function start(cfg, log) {
  const logger = log || { info: console.log, warn: console.warn, error: console.error, debug: () => {} };

  const ops       = makeOps(cfg.afpRoot || null);
  const handleMsg = makeMessageHandler(ops, logger);
  let   backoffMs = 1000;
  let   currentWs = null;

  logger.info(cfg.afpRoot
    ? `Path jail active: ${cfg.afpRoot}`
    : 'Full filesystem access (no path jail configured)');

  // Cloudflare Access service token headers for WS upgrade
  const wsHeaders = {};
  if (cfg.cfServiceToken?.clientId) {
    wsHeaders['CF-Access-Client-Id']     = cfg.cfServiceToken.clientId;
    wsHeaders['CF-Access-Client-Secret'] = cfg.cfServiceToken.clientSecret;
  }

  async function connect(baseUrl) {
    if (!baseUrl) {
      baseUrl = await resolveUrl(cfg.serverUrl);
      if (baseUrl !== cfg.serverUrl) logger.info(`Resolved server: ${baseUrl}`);
    }
    const wsUrl = baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws';
    logger.info(`Connecting to ${baseUrl} ...`);
    const ws = new WebSocket(wsUrl, { headers: wsHeaders });
    currentWs = ws;

    ws.on('open', () => {
      backoffMs = 1000;
      logger.info('WebSocket connected. Sending registration ...');
      ws.send(JSON.stringify({
        type:        'afp:register',
        deviceId:    cfg.deviceId,
        deviceToken: cfg.deviceToken,
        hostname:    os.hostname(),
        platform:    process.platform,
        arch:        process.arch,
      }));
    });

    ws.on('message', raw => handleMsg(ws, raw));

    ws.on('close', (code) => {
      currentWs = null;
      logger.warn(`Disconnected (code=${code}). Reconnecting in ${backoffMs}ms ...`);
      setTimeout(() => {
        backoffMs = Math.min(backoffMs * 2, 30000);
        connect(baseUrl);
      }, backoffMs);
    });

    ws.on('unexpected-response', (req, res) => {
      logger.error(`WebSocket upgrade failed (HTTP ${res.statusCode})`);
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, baseUrl).origin;
        logger.info(`Redirected to ${next}, reconnecting...`);
        setTimeout(() => { backoffMs = Math.min(backoffMs * 2, 30000); connect(next); }, backoffMs);
      }
    });

    ws.on('error', err => logger.error(`WebSocket error: ${err.message}`));
  }

  connect();
}

module.exports = { start };
