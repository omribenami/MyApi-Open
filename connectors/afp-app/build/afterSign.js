'use strict';

/**
 * electron-builder afterSign hook — notarizes the macOS app.
 * Skips gracefully when APPLE_ID env var is not set (unsigned dev builds).
 *
 * Required env vars:
 *   APPLE_ID                    — Apple ID email
 *   APPLE_APP_SPECIFIC_PASSWORD — App-specific password from appleid.apple.com
 *   APPLE_TEAM_ID               — 10-character team ID from developer.apple.com
 */
exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  if (!process.env.APPLE_ID) {
    console.log('[afterSign] Skipping notarization — APPLE_ID not set.');
    return;
  }

  const { notarize } = require('@electron/notarize');
  const appName      = context.packager.appInfo.productFilename;
  const appPath      = `${appOutDir}/${appName}.app`;

  console.log(`[afterSign] Notarizing ${appPath} ...`);

  await notarize({
    tool:              'notarytool',
    appPath,
    appleId:           process.env.APPLE_ID,
    appleIdPassword:   process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId:            process.env.APPLE_TEAM_ID,
  });

  console.log('[afterSign] Notarization complete.');
};
