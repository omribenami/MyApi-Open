'use strict';

/**
 * electron-builder Windows sign hook — signs .exe with signtool.
 * Skips gracefully when WIN_CERT_PATH is not set.
 *
 * Required env vars:
 *   WIN_CERT_PATH     — path to .pfx / .p12 certificate file
 *   WIN_CERT_PASSWORD — PFX password
 *
 * For cloud HSM signing (DigiCert KeyLocker, SSL.com eSigner):
 *   Replace the signtool call with the vendor's CLI tool.
 */
exports.default = async function sign(config) {
  if (!process.env.WIN_CERT_PATH) {
    console.log('[windowsSign] Skipping — WIN_CERT_PATH not set.');
    return;
  }

  const { execSync } = require('child_process');
  const { path }     = config;

  console.log(`[windowsSign] Signing ${path} ...`);

  execSync(
    `signtool sign` +
    ` /f "${process.env.WIN_CERT_PATH}"` +
    ` /p "${process.env.WIN_CERT_PASSWORD}"` +
    ` /tr http://timestamp.digicert.com` +
    ` /td sha256` +
    ` /fd sha256` +
    ` "${path}"`,
    { stdio: 'inherit' }
  );

  console.log('[windowsSign] Signing complete.');
};
