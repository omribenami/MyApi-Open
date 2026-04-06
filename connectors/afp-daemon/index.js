'use strict';

/**
 * MyApi AFP Daemon — Entry Point
 *
 * CLI flags:
 *   --setup    Force re-run of setup wizard
 *   --reset    Delete saved config and re-run setup wizard
 *   --status   Print whether the daemon is running and its PID
 *   --stop     Stop the running daemon
 *   --logs     Print the last 100 lines of the log file
 *
 * Config file:  ~/.myapi-afp/config.json   (Linux/Mac)
 *               %APPDATA%\MyApi-AFP\config.json  (Windows)
 * Log file:     ~/.myapi-afp/daemon.log
 * PID file:     ~/.myapi-afp/daemon.pid
 *
 * Environment variables override config file:
 *   MYAPI_URL          MyApi server URL
 *   MYAPI_DEVICE_ID    afp_xxx
 *   MYAPI_DEVICE_TOKEN afpd_xxx
 *   AFP_ROOT           Optional path jail
 */

const os     = require('os');
const config = require('./lib/config');
const logger = require('./lib/logger');
const pid    = require('./lib/pid');

const args = process.argv.slice(2);

// ── CLI-only flags (exit immediately, no daemon start) ────────────────────────
if (args.includes('--status')) pid.handleStatusFlag();
if (args.includes('--stop'))   pid.handleStopFlag();
if (args.includes('--logs'))   pid.handleLogsFlag();

// ── Guard: prevent duplicate instances ───────────────────────────────────────
const existingPid = pid.read();
if (existingPid && pid.isAlive(existingPid) && !args.includes('--setup') && !args.includes('--reset')) {
  logger.warn(`Daemon already running (PID ${existingPid}). Use --stop to stop it first.`);
  process.exit(1);
}

async function main() {
  logger.info(`MyApi AFP Daemon v1.0.0 — ${os.platform()} ${os.arch()}`);
  logger.info(`Log file: ${logger.getLogPath()}`);

  // Write PID so --status / --stop work
  pid.write();

  // Cleanup PID on exit
  process.on('exit',    () => pid.clear());
  process.on('SIGTERM', () => { pid.clear(); process.exit(0); });
  process.on('SIGINT',  () => { pid.clear(); process.exit(0); });

  // Handle --reset
  if (args.includes('--reset')) {
    config.clear();
    logger.info('Config cleared.');
  }

  // Env vars override everything — skip wizard entirely
  if (!args.includes('--setup') && !args.includes('--reset') &&
      process.env.MYAPI_URL && process.env.MYAPI_DEVICE_ID && process.env.MYAPI_DEVICE_TOKEN) {
    const cfg = {
      serverUrl:   process.env.MYAPI_URL,
      deviceId:    process.env.MYAPI_DEVICE_ID,
      deviceToken: process.env.MYAPI_DEVICE_TOKEN,
      deviceName:  process.env.AFP_DEVICE_NAME || os.hostname(),
      afpRoot:     process.env.AFP_ROOT || null,
    };
    logger.info(`Using environment variables (device: ${cfg.deviceId})`);
    return require('./lib/daemon').start(cfg, logger);
  }

  // Saved config — start directly
  const savedCfg = config.load();
  const forceSetup = args.includes('--setup') || args.includes('--reset');

  if (!forceSetup && savedCfg && savedCfg.serverUrl && savedCfg.deviceId && savedCfg.deviceToken) {
    if (process.env.AFP_ROOT) savedCfg.afpRoot = process.env.AFP_ROOT;
    logger.info(`Loaded config — device: ${savedCfg.deviceId} (${savedCfg.deviceName})`);
    return require('./lib/daemon').start(savedCfg, logger);
  }

  // No config or --setup → run wizard
  const newCfg = await require('./lib/setup').run(logger);
  require('./lib/daemon').start(newCfg, logger);
}

main().catch(err => {
  logger.error('Fatal error:', err.message);
  pid.clear();
  process.exit(1);
});
