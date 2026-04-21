const path = require("path");
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config(); // fallback to current working dir .env if present

// Sentry error monitoring (only initialised when SENTRY_DSN is set)
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.1,
    });
    console.log('[Sentry] Error monitoring initialised');
  } catch (e) {
    console.warn('[Sentry] Failed to initialise:', e.message);
    Sentry = null;
  }
}

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const fs = require("fs");
const multer = require('multer');
const pdfParse = require('pdf-parse');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { marked } = require('marked');
const http = require('http');
const EventEmitter = require('events');
const expressRateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { requestContextMiddleware } = require('./lib/request-context');
const betaMode = require('./lib/betaMode');
const { requireBetaSlot } = require('./middleware/betaCap');

// Database initialization
let mongodbReady = Promise.resolve();
const DATABASE_URL = process.env.DATABASE_URL || '';

if (DATABASE_URL.includes('postgres://') || DATABASE_URL.includes('postgresql://')) {
  // PostgreSQL (Supabase) - use the built-in pool
  console.log('[Startup] Using PostgreSQL database');
} else if (DATABASE_URL && !DATABASE_URL.includes('sqlite')) {
  // MongoDB
  const mongodbAdapter = require('./database-mongodb');
  mongodbReady = mongodbAdapter.connectMongoDB().catch(err => {
    console.error('[MongoDB] Failed to connect:', err.message);
    process.exit(1);
  });
  console.log('[Startup] Initializing MongoDB connection...');
} else {
  // SQLite (default)
  console.log('[Startup] Using SQLite database');
}

// Global event emitter for device alerts and real-time notifications
const alertEmitter = new EventEmitter();
const NotificationService = require('./services/notificationService');
const NotificationDispatcher = require('./lib/notificationDispatcher');
const emailService = require('./services/emailService');
const alerting = require('./lib/alerting');

// PERFORMANCE FIX: Token cache to prevent repeated decryption
// Each decryption is CPU-intensive. Cache for 5 minutes to prevent 502 errors.
const tokenCache = new Map(); // { "service:userId" => { token: {...}, expiresAt: timestamp } }
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedOAuthToken(serviceName, userId) {
  const cacheKey = `${serviceName}:${userId}`;
  const cached = tokenCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }
  
  // Cache expired or missing
  tokenCache.delete(cacheKey);
  return null;
}

function setCachedOAuthToken(serviceName, userId, token) {
  const cacheKey = `${serviceName}:${userId}`;
  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + TOKEN_CACHE_TTL
  });
}

// Clear cache every 10 minutes to prevent stale data
setInterval(() => {
  const now = Date.now();
  let cleared = 0;
  for (const [key, value] of tokenCache.entries()) {
    if (value.expiresAt < now) {
      tokenCache.delete(key);
      cleared++;
    }
  }
  if (cleared > 0) {
    console.log(`[TokenCache] Cleared ${cleared} expired entries`);
  }
}, 10 * 60 * 1000);

const { pendingRequests: afpPendingRequests, afpConnections } = require('./lib/afp-state');

const {
  db,
  initDatabase,
  checkDatabaseHealth,
  runMigrations,
  createVaultToken,
  getVaultTokens,
  deleteVaultToken,
  decryptVaultToken,
  createAccessToken,
  getAccessTokens,
  getExistingMasterToken,
  revokeAccessToken,
  // Scope functions
  seedDefaultScopes,
  validateScope,
  getAllScopes,
  grantScopes,
  getTokenScopes,
  revokeScopes,
  hasPermission,
  expandScopeTemplate,
  createConnector,
  getConnectors,
  createAuditLog,
  // AFP
  getAfpDeviceById,
  updateAfpDeviceStatus,
  getAuditLogs,
  createUser,
  getUsers,
  getUserByUsername,
  getUserById,
  updateUserPlan,
  updateUserOAuthProfile,
  setUserNeedsOnboarding,
  clearUserOnboarding,
  updateUserSubscriptionStatus,
  getUserTotpSecret,
  setUserTotpSecret,
  enableUserTwoFactor,
  disableUserTwoFactor,
  createHandshake,
  getHandshakes,
  approveHandshake,
  denyHandshake,
  revokeHandshake,
  createPersona,
  getPersonas,
  getPersonaById,
  getActivePersona,
  updatePersona,
  setActivePersona,
  deletePersona,
  storeOAuthToken,
  getOAuthToken,
  revokeOAuthToken,
  updateOAuthStatus,
  getOAuthStatus,
  createStateToken,
  validateStateToken,
  cleanupExpiredStateTokens,
  cleanupOldRateLimits,
  createConversation,
  getConversations,
  getConversation,
  storeMessage,
  getConversationHistory,
  addKBDocument,
  getKBDocuments,
  getKBDocumentById,
  deleteKBDocument,
  updateKBDocument,
  getKBDocumentByTitle,
  createMemory,
  getMemories,
  getMemoryById,
  updateMemory,
  deleteMemory,
  clearMemories,
  getPersonaDocuments,
  getPersonaDocumentContents,
  attachDocumentToPersona,
  detachDocumentFromPersona,
  getPersonaSkills,
  attachSkillToPersona,
  detachSkillFromPersona,
  getPersonaSkillPackages,
  // Marketplace
  createMarketplaceListing,
  getMarketplaceListings,
  getMarketplaceListing,
  updateMarketplaceListing,
  removeMarketplaceListing,
  rateMarketplaceListing,
  incrementInstallCount,
  getMyMarketplaceListings,
  // Skills
  createSkill,
  getSkills,
  getSkillById,
  getSkillBySlug,
  getSkillsByIds,
  getSkillsBySlugList,
  suggestSkills,
  updateSkill,
  deleteSkill,
  setActiveSkill,
  getSkillDocuments,
  attachDocumentToSkill,
  detachDocumentFromSkill,
  // Skill Origin & Attribution (Phase 1)
  updateSkillOrigin,
  // Skill Versioning & Immutability (Phase 2)
  createSkillVersion,
  getSkillVersions,
  getSkillVersion,
  // Skill Fork & Derivative Tracking (Phase 3)
  createSkillFork,
  getSkillForks,
  getSkillForkInfo,
  // Skill Licenses (Phase 4)
  getLicenses,
  getLicense,
  validateLicenseOperation,
  // Skill Ownership Verification (Phase 4)
  createOwnershipClaim,
  getOwnershipClaim,
  verifyOwnershipClaim,
  getSkillOwnershipClaims,
  // Services
  seedServiceCategories,
  seedServices,
  getServiceCategories,
  getServices,
  getServicesByCategory,
  getServiceByName,
  getServiceMethods,
  addServiceMethod,
  // Service Preferences (Phase 3)
  getServicePreference,
  // Workspaces
  getWorkspaces,
  // Phase 2: Billing & Usage
  getBillingCustomerByWorkspace,
  upsertBillingCustomer,
  getBillingSubscriptionByWorkspace,
  upsertBillingSubscription,
  listInvoicesByWorkspace,
  upsertInvoice,
  incrementUsageDaily,
  getUsageDaily,
  // Phase 4: Enterprise SSO & RBAC
  getSSOConfigurationsByWorkspace,
  getSSOConfigurationByProvider,
  createSSOConfiguration,
  updateSSOConfiguration,
  getRolesByWorkspace,
  createRole,
  getOrEnsureUserWorkspace,
  getWorkspaceMembers,
  // Phase 5: Compliance & Retention
  createRetentionPolicy,
  getRetentionPolicies,
  updateRetentionPolicy,
  createComplianceAuditLog,
  getComplianceAuditLogs,
  executeRetentionCleanup,
  upsertOAuthServerClient,
  createApprovedDevice,
} = require("./database");
const DeviceFingerprint = require('./utils/deviceFingerprint');

// OAuth service adapters
const GoogleAdapter = require("./services/google-adapter");
const GitHubAdapter = require("./services/github-adapter");
const SlackAdapter = require("./services/slack-adapter");
const DiscordAdapter = require("./services/discord-adapter");
const WhatsAppAdapter = require("./services/whatsapp-adapter");
const GenericOAuthAdapter = require("./services/generic-oauth-adapter");
const {
  buildServiceDefinition,
  validateExecutionInput,
  executeServiceMethod,
  OAUTH_PROVIDER_DETAILS,
} = require('./services/integration-layer');
const {
  PLAN_LIMITS: BILLING_PLAN_LIMITS,
  resolveWorkspaceCurrentPlan,
  computeUsageVsLimits,
  getRangeDays,
} = require('./lib/billing');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4500;
const WORKSPACE_ROOT = path.join(__dirname, '..', '..', '..');
const USER_MD_PATH = process.env.USER_MD_PATH || path.join(WORKSPACE_ROOT, 'USER.md');
const SOUL_MD_PATH = process.env.SOUL_MD_PATH || path.join(WORKSPACE_ROOT, 'SOUL.md');
const LEGAL_DOCS_DIR = path.join(__dirname, '..', 'docs', 'legal');

// Import device approval middleware
const { deviceApprovalMiddleware, setAlertEmitter: setDeviceAlertEmitter } = require('./middleware/deviceApproval');
const { isResourceAllowed } = require('./middleware/scope-validator');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url = '') {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '#';
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  return '#';
}

function renderLegalMarkdown(markdown = '') {
  const safeMarkdown = String(markdown || '').replace(/<[^>]*>/g, '');
  
  // Use marked with default rendering first, then sanitize the output
  let html = marked.parse(safeMarkdown, {
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false,
  });
  
  // Fix links: sanitize hrefs but preserve link text
  html = html.replace(/<a\s+href="([^"]*)"\s*([^>]*)>([^<]*)<\/a>/g, (match, href, attrs, text) => {
    const safeHref = sanitizeUrl(href);
    return `<a href="${escapeHtml(safeHref)}" ${attrs}>${escapeHtml(text)}</a>`;
  });
  
  return html;
}

function loadLegalDoc(filename, fallbackTitle, fallbackBody) {
  const targetPath = path.join(LEGAL_DOCS_DIR, filename);
  if (fs.existsSync(targetPath)) {
    return fs.readFileSync(targetPath, 'utf8');
  }
  return `# ${fallbackTitle}\n\n${fallbackBody}`;
}

function renderLegalPage({ title, markdownContent }) {
  const contentHtml = renderLegalMarkdown(markdownContent);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · MyApi</title>
  <style>
    :root{--bg:#020617;--card:#0f172a;--text:#e2e8f0;--muted:#94a3b8;--accent:#60a5fa;--border:#1e293b;}
    body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;}
    .wrap{max-width:860px;margin:0 auto;padding:24px 16px 48px;}
    .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;}
    h1,h2,h3{line-height:1.25;margin-top:1.2em;}
    h1{margin-top:0;}
    p,li{color:var(--text);} code{background:#0b1220;padding:2px 6px;border-radius:6px;}
    a{color:var(--accent);} .top{margin-bottom:16px;font-size:14px;color:var(--muted);}
    .top a{color:var(--muted);text-decoration:none;} .top a:hover{color:var(--text)}
    @media (max-width: 640px){.wrap{padding:12px}.card{padding:16px}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top"><a href="/dashboard/">← Back to MyApi</a></div>
    <article class="card">${contentHtml}</article>
  </div>
</body>
</html>`;
}

// Initialize database
initDatabase();

// Seed scope definitions (idempotent upsert — safe to run every startup)
seedDefaultScopes();

// Run database migrations
runMigrations();

// Startup database integrity check
const startupHealth = checkDatabaseHealth();
if (!startupHealth.healthy) {
  console.error('[Database] INTEGRITY CHECK FAILED:', startupHealth.error);
  console.error('[Database] The database may be corrupted. Consider restoring from backup.');
  process.exit(1);
} else {
  console.log('[Database] Integrity check passed');
}

// --- OAuth Configuration ---
// Load OAuth config with environment variable support
// OAuth configuration - hardcoded with fallback to oauth.json
let oauthConfig = {
  google: {
    enabled: true,
    clientId: process.env.GOOGLE_CLIENT_ID || 'REMOVED_CLIENT_ID',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'REMOVED_SECRET',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://www.myapiai.com/api/v1/oauth/callback/google'
  }
};

// Try to load from oauth.json if it exists
const oauthConfigPath = path.join(__dirname, 'config', 'oauth.json');
if (fs.existsSync(oauthConfigPath)) {
  try {
    const raw = fs.readFileSync(oauthConfigPath, 'utf8');
    const resolved = raw.replace(/\$\{([^}]+)\}/g, (match, envVar) => process.env[envVar] || match);
    const fileConfig = JSON.parse(resolved);
    oauthConfig = { ...oauthConfig, ...fileConfig };
    console.log('[OAuth] Loaded from oauth.json');
  } catch (e) {
    console.warn('[OAuth] Warning: Could not parse oauth.json, using defaults');
  }
}

// Initialize OAuth adapters
const oauthAdapters = {
  google: new GoogleAdapter(oauthConfig.google || {}),
  github: new GitHubAdapter(oauthConfig.github || {}),
  slack: new SlackAdapter(oauthConfig.slack || {}),
  discord: new DiscordAdapter(oauthConfig.discord || {}),
  whatsapp: new WhatsAppAdapter(oauthConfig.whatsapp || {}),
  facebook: new GenericOAuthAdapter({
    serviceName: 'facebook',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    verifyUrl: 'https://graph.facebook.com/me?fields=id,name,email,picture.type(large)',
    scope: process.env.FACEBOOK_SCOPE || 'email,public_profile',
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || oauthConfig.facebook?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/facebook`,
    clientId: process.env.FACEBOOK_CLIENT_ID || oauthConfig.facebook?.clientId,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET || oauthConfig.facebook?.clientSecret,
  }),
  instagram: new GenericOAuthAdapter({
    serviceName: 'instagram',
    // New Instagram Platform API (Basic Display API was shut down Dec 4, 2024)
    // Requires app type "Instagram" in Meta Developer Console with instagram_business_basic permission
    authUrl: 'https://www.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    verifyUrl: 'https://graph.instagram.com/v21.0/me?fields=id,username,name',
    scope: process.env.INSTAGRAM_SCOPE || 'instagram_business_basic',
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI || oauthConfig.instagram?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/instagram`,
    clientId: process.env.INSTAGRAM_CLIENT_ID || oauthConfig.instagram?.clientId,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || oauthConfig.instagram?.clientSecret,
  }),
  threads: new GenericOAuthAdapter({
    serviceName: 'threads',
    authUrl: 'https://threads.net/oauth/authorize',
    tokenUrl: 'https://graph.threads.net/oauth/access_token',
    verifyUrl: 'https://graph.threads.net/v19.0/me?fields=id,username',
    scope: 'threads_basic_access,threads_manage_metadata',
    redirectUri: process.env.THREADS_REDIRECT_URI || oauthConfig.threads?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/threads`,
    clientId: process.env.THREADS_CLIENT_ID || oauthConfig.threads?.clientId,
    clientSecret: process.env.THREADS_CLIENT_SECRET || oauthConfig.threads?.clientSecret,
    extraAuthParams: { response_type: 'code' },
  }),
  tiktok: new GenericOAuthAdapter({
    serviceName: 'tiktok',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    verifyUrl: 'https://open.tiktokapis.com/v1/user/info/',
    scope: process.env.TIKTOK_SCOPE || 'user.info.basic,user.info.profile,user.info.stats,video.list,video.upload,video.publish,comment.list,comment.list.pull',
    redirectUri: process.env.TIKTOK_REDIRECT_URI || oauthConfig.tiktok?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/tiktok`,
    // TikTok docs/UI often call this value "Client Key". Accept both env names.
    // TikTok expects this key in `client_key` (not `client_id`).
    clientIdParam: 'client_key',
    clientId: process.env.TIKTOK_CLIENT_ID || process.env.TIKTOK_CLIENT_KEY || oauthConfig.tiktok?.clientId,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || oauthConfig.tiktok?.clientSecret,
    extraAuthParams: { response_type: 'code' },
    extraTokenParams: { grant_type: 'authorization_code' },
  }),
  twitter: new GenericOAuthAdapter({
    serviceName: 'twitter',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    verifyUrl: 'https://api.twitter.com/2/users/me',
    scope: process.env.TWITTER_SCOPE || 'tweet.read tweet.write users.read offline.access',
    redirectUri: process.env.TWITTER_REDIRECT_URI || oauthConfig.twitter?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/twitter`,
    clientId: process.env.TWITTER_CLIENT_ID || oauthConfig.twitter?.clientId,
    clientSecret: process.env.TWITTER_CLIENT_SECRET || oauthConfig.twitter?.clientSecret,
    tokenAuthStyle: 'basic',
  }),
  reddit: new GenericOAuthAdapter({
    serviceName: 'reddit',
    authUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    verifyUrl: 'https://oauth.reddit.com/api/v1/me',
    scope: process.env.REDDIT_SCOPE || 'identity read submit privatemessages modmail',
    redirectUri: process.env.REDDIT_REDIRECT_URI || oauthConfig.reddit?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/reddit`,
    clientId: process.env.REDDIT_CLIENT_ID || oauthConfig.reddit?.clientId,
    clientSecret: process.env.REDDIT_CLIENT_SECRET || oauthConfig.reddit?.clientSecret,
    tokenAuthStyle: 'basic',
    extraAuthParams: { duration: 'permanent' },
  }),
  linkedin: new GenericOAuthAdapter({
    serviceName: 'linkedin',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    verifyUrl: 'https://api.linkedin.com/v2/me',
    scope: process.env.LINKEDIN_SCOPE || 'openid profile email',
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || oauthConfig.linkedin?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/linkedin`,
    clientId: process.env.LINKEDIN_CLIENT_ID || oauthConfig.linkedin?.clientId,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || oauthConfig.linkedin?.clientSecret,
    extraAuthParams: { response_type: 'code' },
  }),
  notion: new GenericOAuthAdapter({
    serviceName: 'notion',
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    verifyUrl: 'https://api.notion.com/v1/users/me',
    scope: '',
    redirectUri: process.env.NOTION_REDIRECT_URI || oauthConfig.notion?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/notion`,
    clientId: process.env.NOTION_CLIENT_ID || oauthConfig.notion?.clientId,
    clientSecret: process.env.NOTION_CLIENT_SECRET || oauthConfig.notion?.clientSecret,
    tokenAuthStyle: 'basic',
    extraAuthParams: { owner: 'user' },
  }),
  microsoft365: new GenericOAuthAdapter({
    serviceName: 'microsoft365',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    verifyUrl: 'https://graph.microsoft.com/v1.0/me',
    scope: process.env.MICROSOFT365_SCOPE || 'openid profile email offline_access User.Read Mail.Read Calendars.Read',
    redirectUri: process.env.MICROSOFT365_REDIRECT_URI || oauthConfig.microsoft365?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/microsoft365`,
    clientId: process.env.MICROSOFT365_CLIENT_ID || oauthConfig.microsoft365?.clientId,
    clientSecret: process.env.MICROSOFT365_CLIENT_SECRET || oauthConfig.microsoft365?.clientSecret,
  }),
  dropbox: new GenericOAuthAdapter({
    serviceName: 'dropbox',
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    verifyUrl: 'https://api.dropboxapi.com/2/users/get_current_account',
    scope: process.env.DROPBOX_SCOPE || '',
    redirectUri: process.env.DROPBOX_REDIRECT_URI || oauthConfig.dropbox?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/dropbox`,
    clientId: process.env.DROPBOX_CLIENT_ID || oauthConfig.dropbox?.clientId,
    clientSecret: process.env.DROPBOX_CLIENT_SECRET || oauthConfig.dropbox?.clientSecret,
  }),
  trello: new GenericOAuthAdapter({
    serviceName: 'trello',
    authUrl: 'https://trello.com/1/OAuthAuthorizeToken',
    tokenUrl: 'https://trello.com/1/OAuthGetAccessToken',
    verifyUrl: 'https://api.trello.com/1/members/me',
    scope: process.env.TRELLO_SCOPE || 'read,write',
    redirectUri: process.env.TRELLO_REDIRECT_URI || oauthConfig.trello?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/trello`,
    clientId: process.env.TRELLO_CLIENT_ID || oauthConfig.trello?.clientId,
    clientSecret: process.env.TRELLO_CLIENT_SECRET || oauthConfig.trello?.clientSecret,
  }),
  zoom: new GenericOAuthAdapter({
    serviceName: 'zoom',
    authUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    verifyUrl: 'https://api.zoom.us/v2/users/me',
    scope: process.env.ZOOM_SCOPE || '',
    redirectUri: process.env.ZOOM_REDIRECT_URI || oauthConfig.zoom?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/zoom`,
    clientId: process.env.ZOOM_CLIENT_ID || oauthConfig.zoom?.clientId,
    clientSecret: process.env.ZOOM_CLIENT_SECRET || oauthConfig.zoom?.clientSecret,
    tokenAuthStyle: 'basic',
  }),
  hubspot: new GenericOAuthAdapter({
    serviceName: 'hubspot',
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    verifyUrl: 'https://api.hubapi.com/oauth/v1/access-tokens/',
    scope: process.env.HUBSPOT_SCOPE || 'oauth crm.objects.contacts.read crm.objects.contacts.write crm.objects.deals.read crm.objects.deals.write',
    redirectUri: process.env.HUBSPOT_REDIRECT_URI || oauthConfig.hubspot?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/hubspot`,
    clientId: process.env.HUBSPOT_CLIENT_ID || oauthConfig.hubspot?.clientId,
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET || oauthConfig.hubspot?.clientSecret,
  }),
  salesforce: new GenericOAuthAdapter({
    serviceName: 'salesforce',
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    verifyUrl: 'https://login.salesforce.com/services/oauth2/userinfo',
    scope: process.env.SALESFORCE_SCOPE || 'api refresh_token',
    redirectUri: process.env.SALESFORCE_REDIRECT_URI || oauthConfig.salesforce?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/salesforce`,
    clientId: process.env.SALESFORCE_CLIENT_ID || oauthConfig.salesforce?.clientId,
    clientSecret: process.env.SALESFORCE_CLIENT_SECRET || oauthConfig.salesforce?.clientSecret,
  }),
  jira: new GenericOAuthAdapter({
    serviceName: 'jira',
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    verifyUrl: 'https://api.atlassian.com/me',
    scope: process.env.JIRA_SCOPE || 'read:jira-user read:jira-work write:jira-work offline_access',
    redirectUri: process.env.JIRA_REDIRECT_URI || oauthConfig.jira?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/jira`,
    clientId: process.env.JIRA_CLIENT_ID || oauthConfig.jira?.clientId,
    clientSecret: process.env.JIRA_CLIENT_SECRET || oauthConfig.jira?.clientSecret,
    extraAuthParams: { audience: 'api.atlassian.com', prompt: 'consent' },
  }),
  confluence: new GenericOAuthAdapter({
    serviceName: 'confluence',
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    verifyUrl: 'https://api.atlassian.com/me',
    scope: process.env.CONFLUENCE_SCOPE || 'read:confluence-content.all read:confluence-user write:confluence-content offline_access',
    redirectUri: process.env.CONFLUENCE_REDIRECT_URI || oauthConfig.confluence?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/confluence`,
    clientId: process.env.CONFLUENCE_CLIENT_ID || oauthConfig.confluence?.clientId,
    clientSecret: process.env.CONFLUENCE_CLIENT_SECRET || oauthConfig.confluence?.clientSecret,
    extraAuthParams: { audience: 'api.atlassian.com', prompt: 'consent' },
  }),
  asana: new GenericOAuthAdapter({
    serviceName: 'asana',
    authUrl: 'https://app.asana.com/-/oauth_authorize',
    tokenUrl: 'https://app.asana.com/-/oauth_token',
    verifyUrl: 'https://app.asana.com/api/1.0/users/me',
    scope: process.env.ASANA_SCOPE || 'default',
    redirectUri: process.env.ASANA_REDIRECT_URI || oauthConfig.asana?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/asana`,
    clientId: process.env.ASANA_CLIENT_ID || oauthConfig.asana?.clientId,
    clientSecret: process.env.ASANA_CLIENT_SECRET || oauthConfig.asana?.clientSecret,
    tokenAuthStyle: 'basic',
  }),
  linear: new GenericOAuthAdapter({
    serviceName: 'linear',
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    verifyUrl: 'https://api.linear.app/oauth/userinfo',
    scope: process.env.LINEAR_SCOPE || 'read write',
    redirectUri: process.env.LINEAR_REDIRECT_URI || oauthConfig.linear?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/linear`,
    clientId: process.env.LINEAR_CLIENT_ID || oauthConfig.linear?.clientId,
    clientSecret: process.env.LINEAR_CLIENT_SECRET || oauthConfig.linear?.clientSecret,
    extraAuthParams: { response_type: 'code', actor: 'user' },
  }),
  box: new GenericOAuthAdapter({
    serviceName: 'box',
    authUrl: 'https://account.box.com/api/oauth2/authorize',
    tokenUrl: 'https://api.box.com/oauth2/token',
    verifyUrl: 'https://api.box.com/2.0/users/me',
    scope: process.env.BOX_SCOPE || 'root_readwrite',
    redirectUri: process.env.BOX_REDIRECT_URI || oauthConfig.box?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/box`,
    clientId: process.env.BOX_CLIENT_ID || oauthConfig.box?.clientId,
    clientSecret: process.env.BOX_CLIENT_SECRET || oauthConfig.box?.clientSecret,
  }),
  airtable: new GenericOAuthAdapter({
    serviceName: 'airtable',
    authUrl: 'https://airtable.com/oauth2/v1/authorize',
    tokenUrl: 'https://airtable.com/oauth2/v1/token',
    verifyUrl: 'https://api.airtable.com/v0/meta/whoami',
    scope: process.env.AIRTABLE_SCOPE || 'data.records:read data.records:write schema.bases:read',
    redirectUri: process.env.AIRTABLE_REDIRECT_URI || oauthConfig.airtable?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/airtable`,
    clientId: process.env.AIRTABLE_CLIENT_ID || oauthConfig.airtable?.clientId,
    clientSecret: process.env.AIRTABLE_CLIENT_SECRET || oauthConfig.airtable?.clientSecret,
    tokenAuthStyle: 'basic',
  }),
  figma: new GenericOAuthAdapter({
    serviceName: 'figma',
    authUrl: 'https://www.figma.com/oauth',
    tokenUrl: 'https://www.figma.com/api/oauth/token',
    verifyUrl: 'https://api.figma.com/v1/me',
    scope: process.env.FIGMA_SCOPE || 'files:read',
    redirectUri: process.env.FIGMA_REDIRECT_URI || oauthConfig.figma?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/figma`,
    clientId: process.env.FIGMA_CLIENT_ID || oauthConfig.figma?.clientId,
    clientSecret: process.env.FIGMA_CLIENT_SECRET || oauthConfig.figma?.clientSecret,
  }),
  canva: new GenericOAuthAdapter({
    serviceName: 'canva',
    authUrl: 'https://www.canva.com/api/oauth/authorize',
    tokenUrl: 'https://www.canva.com/api/oauth/token',
    verifyUrl: 'https://api.canva.com/rest/v1/users/me',
    scope: process.env.CANVA_SCOPE || 'asset:read profile:read design:content:read',
    redirectUri: process.env.CANVA_REDIRECT_URI || oauthConfig.canva?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/canva`,
    clientId: process.env.CANVA_CLIENT_ID || oauthConfig.canva?.clientId,
    clientSecret: process.env.CANVA_CLIENT_SECRET || oauthConfig.canva?.clientSecret,
  }),
  zendesk: new GenericOAuthAdapter({
    serviceName: 'zendesk',
    authUrl: `https://${process.env.ZENDESK_SUBDOMAIN || oauthConfig.zendesk?.subdomain || 'your-subdomain'}.zendesk.com/oauth/authorizations/new`,
    tokenUrl: `https://${process.env.ZENDESK_SUBDOMAIN || oauthConfig.zendesk?.subdomain || 'your-subdomain'}.zendesk.com/oauth/tokens`,
    verifyUrl: `https://${process.env.ZENDESK_SUBDOMAIN || oauthConfig.zendesk?.subdomain || 'your-subdomain'}.zendesk.com/api/v2/users/me.json`,
    scope: process.env.ZENDESK_SCOPE || 'read write',
    redirectUri: process.env.ZENDESK_REDIRECT_URI || oauthConfig.zendesk?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/zendesk`,
    clientId: process.env.ZENDESK_CLIENT_ID || oauthConfig.zendesk?.clientId,
    clientSecret: process.env.ZENDESK_CLIENT_SECRET || oauthConfig.zendesk?.clientSecret,
    extraAuthParams: { response_type: 'code' },
  }),
  intercom: new GenericOAuthAdapter({
    serviceName: 'intercom',
    authUrl: 'https://app.intercom.com/oauth',
    tokenUrl: 'https://api.intercom.io/auth/eagle/token',
    verifyUrl: 'https://api.intercom.io/me',
    scope: process.env.INTERCOM_SCOPE || '',
    redirectUri: process.env.INTERCOM_REDIRECT_URI || oauthConfig.intercom?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/intercom`,
    clientId: process.env.INTERCOM_CLIENT_ID || oauthConfig.intercom?.clientId,
    clientSecret: process.env.INTERCOM_CLIENT_SECRET || oauthConfig.intercom?.clientSecret,
  }),
  clickup: new GenericOAuthAdapter({
    serviceName: 'clickup',
    authUrl: 'https://app.clickup.com/api',
    tokenUrl: 'https://app.clickup.com/api/v2/oauth/token',
    verifyUrl: 'https://api.clickup.com/api/v2/user',
    scope: process.env.CLICKUP_SCOPE || '',
    redirectUri: process.env.CLICKUP_REDIRECT_URI || oauthConfig.clickup?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/clickup`,
    clientId: process.env.CLICKUP_CLIENT_ID || oauthConfig.clickup?.clientId,
    clientSecret: process.env.CLICKUP_CLIENT_SECRET || oauthConfig.clickup?.clientSecret,
  }),
  monday: new GenericOAuthAdapter({
    serviceName: 'monday',
    authUrl: 'https://auth.monday.com/oauth2/authorize',
    tokenUrl: 'https://auth.monday.com/oauth2/token',
    verifyUrl: null,
    scope: process.env.MONDAY_SCOPE || 'me:read boards:read',
    redirectUri: process.env.MONDAY_REDIRECT_URI || oauthConfig.monday?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/monday`,
    clientId: process.env.MONDAY_CLIENT_ID || oauthConfig.monday?.clientId,
    clientSecret: process.env.MONDAY_CLIENT_SECRET || oauthConfig.monday?.clientSecret,
  }),
};

const OAUTH_SERVICES = Object.keys(oauthAdapters);
const isAdapterConfigured = (adapter) => {
  if (!adapter) return false;
  if (typeof adapter.isConfigured === 'function') return adapter.isConfigured();
  return Boolean(
    (adapter.clientId || '').toString().trim() &&
    (adapter.clientSecret || '').toString().trim() &&
    (adapter.redirectUri || '').toString().trim()
  );
};
const isOAuthServiceEnabled = (service) => {
  // Rule: credentials present in env → service is active. No config file changes needed.
  // The only override is setting enabled:false in oauth.json to hard-disable a credentialed service.
  const adapter = oauthAdapters[service];
  const explicitlyDisabled = oauthConfig[service]?.enabled === false;
  return Boolean(!explicitlyDisabled && isAdapterConfigured(adapter));
};

// --- Middleware ---
const session = require('express-session');
const isProd = process.env.NODE_ENV === 'production';

// Only load BetterSqlite3 if not using MongoDB
let BetterSqlite3 = null;
let BetterSqlite3StoreFactory = null;
if (!process.env.DATABASE_URL) {
  BetterSqlite3 = require('better-sqlite3');
  BetterSqlite3StoreFactory = require('better-sqlite3-session-store')(session);
}

// SOC2 Phase 2 — CC7: Assign a unique correlation ID to every request for log tracing
// Propagated automatically via AsyncLocalStorage — no manual threading needed
app.use(requestContextMiddleware);

// SOC2 Phase 4.3 — CSP nonce: generate a cryptographically random nonce per request.
// The nonce is injected into the CSP header (scriptSrc) by Helmet and into the dashboard
// HTML at serve time so script tags can carry matching `nonce=""` attributes.
// NOTE: styleSrc retains `unsafe-inline` because React inline style={} props emit
//       `style="..."` attributes in the DOM which cannot carry nonces — removing it
//       would break every component that uses dynamic styling.
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://unpkg.com", "https://static.cloudflareinsights.com", "https://cdn.tailwindcss.com", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      connectSrc: ["'self'", "https:", "wss:"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", "https://chat.openai.com", "https://chatgpt.com"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: [],
      reportUri: ['/api/v1/security/csp-report'],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use('/api/', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});

const devOrigins = ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:4500', 'http://127.0.0.1:4500', 'http://localhost:5173', 'http://127.0.0.1:5173'];
const envOrigins = String(process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = envOrigins.length > 0 ? envOrigins : (isProd ? [] : devOrigins);

function isAllowedCorsOrigin(origin) {
  if (allowedOrigins.includes(origin)) return true;

  // Support wildcard origins in env, e.g. https://*.example.com
  for (const allowed of allowedOrigins) {
    if (!allowed.includes('*')) continue;
    const suffix = allowed.replace('*.', '');
    if (origin === suffix || origin.endsWith(`.${suffix}`)) return true;
  }

  // Cloudflare tunnel/dev domains (safe-list for remote dashboard access)
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith('.trycloudflare.com') || hostname.endsWith('.cfargotunnel.com')) return true;
  } catch (_) {}

  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin/non-browser requests (no Origin header)
    if (!origin) return callback(null, true);
    if (isAllowedCorsOrigin(origin)) return callback(null, true);

    // In local/dev environments we may access dashboard via LAN IP, localhost aliases,
    // or temporary tunnels; allow explicit Origin dynamically to avoid blank SPA asset loads.
    if (!isProd) {
      console.warn(`[CORS] Allowing non-whitelisted origin in dev mode: ${origin}`);
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Stripe webhook must be registered before express.json() so it receives the raw body
// required by stripe.webhooks.constructEvent() for signature verification.
app.post('/api/v1/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const configuredSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  let event;

  if (configuredSecret) {
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing Stripe signature' });
    const stripe = getStripeClient();
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, configuredSecret);
    } catch (err) {
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }
  } else {
    try {
      event = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const type = event?.type;
  const obj = event?.data?.object || {};
  const metadataWorkspaceId = obj?.metadata?.workspace_id || null;

  if (type === 'customer.subscription.created' || type === 'customer.subscription.updated') {
    if (metadataWorkspaceId) {
      const newPlanId = (obj.items?.data?.[0]?.price?.nickname || obj.items?.data?.[0]?.price?.lookup_key || 'free').toLowerCase();
      upsertBillingSubscription(metadataWorkspaceId, {
        stripe_subscription_id: obj.id,
        plan_id: newPlanId,
        status: obj.status || 'active',
        period_start: obj.current_period_start ? new Date(obj.current_period_start * 1000).toISOString() : null,
        period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: !!obj.cancel_at_period_end,
      });
      // Notify workspace owner on active subscription (upgrade)
      if (type === 'customer.subscription.updated' && obj.status === 'active' && newPlanId !== 'free') {
        const billingWs = getWorkspaces(null, metadataWorkspaceId);
        if (billingWs?.ownerId) {
          NotificationDispatcher.onSubscriptionUpgraded(metadataWorkspaceId, billingWs.ownerId, newPlanId)
            .catch(err => console.error('[Billing] Subscription upgrade notification error:', err));
        }
      }
    }
  }

  if (type === 'customer.subscription.deleted') {
    if (metadataWorkspaceId) {
      upsertBillingSubscription(metadataWorkspaceId, {
        stripe_subscription_id: obj.id,
        plan_id: 'free',
        status: 'canceled',
        period_start: null,
        period_end: null,
        cancel_at_period_end: false,
      });
    }
  }

  if (type === 'customer.subscription.trial_will_end') {
    if (metadataWorkspaceId) {
      upsertBillingSubscription(metadataWorkspaceId, {
        stripe_subscription_id: obj.id,
        plan_id: (obj.items?.data?.[0]?.price?.nickname || obj.items?.data?.[0]?.price?.lookup_key || 'free').toLowerCase(),
        status: obj.status || 'trialing',
        period_start: obj.current_period_start ? new Date(obj.current_period_start * 1000).toISOString() : null,
        period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
        cancel_at_period_end: !!obj.cancel_at_period_end,
      });
    }
  }

  if (type === 'invoice.paid' || type === 'invoice.payment_failed' || type === 'invoice.finalized') {
    if (metadataWorkspaceId) {
      upsertInvoice(metadataWorkspaceId, {
        stripe_invoice_id: obj.id,
        amount_cents: obj.amount_paid || obj.amount_due || 0,
        currency: obj.currency || 'usd',
        status: obj.status || 'open',
        invoice_url: obj.hosted_invoice_url || null,
        created_at: obj.created ? new Date(obj.created * 1000).toISOString() : new Date().toISOString(),
      });
      // Notify workspace owner on payment failure
      if (type === 'invoice.payment_failed') {
        const failWs = getWorkspaces(null, metadataWorkspaceId);
        if (failWs?.ownerId) {
          const failReason = obj.last_payment_error?.message || 'Payment was declined';
          NotificationDispatcher.onBillingFailure(metadataWorkspaceId, failWs.ownerId, failReason)
            .catch(err => console.error('[Billing] Payment failure notification error:', err));
        }
      }
    }
  }

  return res.json({ received: true });
});

app.use(express.json({ limit: "100kb" }));

// Global rate limiter middleware (applies to all requests except exempt paths)
const globalRateLimitMap = {};

// P1 Security Fix: Cleanup old rate limit entries (in-memory maps grow unbounded)
const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  // Clean globalRateLimitMap
  for (const [key, timestamps] of Object.entries(globalRateLimitMap || {})) {
    const recentTimestamps = timestamps.filter(ts => now - ts < maxAge);
    if (recentTimestamps.length === 0) {
      delete globalRateLimitMap[key];
    } else {
      globalRateLimitMap[key] = recentTimestamps;
    }
  }

  // Clean rateLimitMap if it exists
  if (typeof rateLimitMap !== 'undefined') {
    for (const [key, timestamps] of Object.entries(rateLimitMap || {})) {
      const recentTimestamps = timestamps.filter(ts => now - ts < maxAge);
      if (recentTimestamps.length === 0) {
        delete rateLimitMap[key];
      } else {
        rateLimitMap[key] = recentTimestamps;
      }
    }
  }
}, 60 * 60 * 1000); // Run every hour
rateLimitCleanupInterval.unref?.();

// Email processor: Send pending emails every 5 minutes
const emailProcessorInterval = setInterval(async () => {
  try {
    const result = await emailService.processPendingEmails(50);
    if (result.sent > 0 || result.failed > 0) {
      console.log(`[Email] Processed batch: ${result.sent} sent, ${result.failed} failed`);
    }
  } catch (err) {
    console.error('[Email] Error processing pending emails:', err.message);
  }
}, 5 * 60 * 1000); // Run every 5 minutes
emailProcessorInterval.unref?.();

app.use((req, res, next) => {
  // CRITICAL: Exempt all auth/dashboard bootstrap paths from rate limiting
  const isExempt = req.path === '/api/v1/auth/me' ||
                   req.path === '/api/v1/auth/debug' ||
                   req.path === '/api/v1/auth/logout' ||
                   req.path === '/api/v1/dashboard/metrics' ||
                   (req.path === '/api/v1/privacy/cookies' && req.method === 'GET') ||
                   req.path.startsWith('/api/v1/ws') ||
                   req.path === '/health' ||
                   req.path === '/ping' ||
                   req.path.startsWith('/dashboard/');

  // Bearer token (API/agent) requests: apply a separate, higher rate limit
  // Device approval middleware provides additional rate limiting for API tokens
  const hasBearer = req.headers.authorization?.startsWith('Bearer ') || req.query.token || req.query.api_key;

  if (isExempt) {
    return next();
  }

  const now = Date.now();

  if (hasBearer) {
    // Apply a separate rate limit for API token requests (higher ceiling)
    const bearerKey = `bearer:${req.ip}`;
    const bearerWindowMs = 60000;
    const bearerMaxRequests = process.env.NODE_ENV === 'test' ? 5000 : 600; // 600 req/min for API tokens
    if (!globalRateLimitMap[bearerKey]) globalRateLimitMap[bearerKey] = [];
    globalRateLimitMap[bearerKey] = globalRateLimitMap[bearerKey].filter(t => now - t < bearerWindowMs);
    if (globalRateLimitMap[bearerKey].length >= bearerMaxRequests) {
      return res.status(429).json({ error: 'API rate limit exceeded', retryAfter: 60 });
    }
    globalRateLimitMap[bearerKey].push(now);
    return next();
  }

  const key = `global:${req.ip}`;
  const windowMs = 60000; // 1 minute
  const maxRequests = process.env.NODE_ENV === 'test' ? 1000 : 120; // 120 req/min default

  if (!globalRateLimitMap[key]) globalRateLimitMap[key] = [];
  globalRateLimitMap[key] = globalRateLimitMap[key].filter(t => now - t < windowMs);

  if (globalRateLimitMap[key].length >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - globalRateLimitMap[key][0])) / 1000));
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: retryAfterSeconds
    });
  }

  globalRateLimitMap[key].push(now);
  next();
});

const secureCookie = process.env.SESSION_COOKIE_SECURE
  ? String(process.env.SESSION_COOKIE_SECURE).toLowerCase() === 'true'
  : isProd;

let sessionStore;
let sessionDb = null;
if (process.env.NODE_ENV !== 'test' && !process.env.DATABASE_URL) {
  // Only use SQLite session store if not using MongoDB
  const sessionDbPath = process.env.SESSION_DB_PATH || path.join(__dirname, 'db.sqlite');
  sessionDb = new BetterSqlite3(sessionDbPath);
  sessionStore = new BetterSqlite3StoreFactory({
    client: sessionDb,
    expired: {
      clear: true,
      intervalMs: 15 * 60 * 1000,
    },
  });
}

// SOC2 CC6 — Concurrent session limits (max 3 per user, oldest invalidated on new login)
const MAX_SESSIONS_PER_USER = 3;
// userId -> [{ sessionId, createdAt }]
const userSessionRegistry = new Map();

function registerUserSession(userId, sessionId) {
  if (!userSessionRegistry.has(userId)) userSessionRegistry.set(userId, []);
  const sessions = userSessionRegistry.get(userId);
  sessions.push({ sessionId, createdAt: Date.now() });

  // Evict oldest sessions that exceed the limit
  while (sessions.length > MAX_SESSIONS_PER_USER) {
    const { sessionId: oldSid } = sessions.shift(); // oldest first
    if (sessionStore && typeof sessionStore.destroy === 'function') {
      try { sessionStore.destroy(oldSid, () => {}); } catch (_) {}
    }
    logger.warn('Session evicted due to concurrent session limit', { userId, evictedSessionId: oldSid });
  }
}

function unregisterUserSession(userId, sessionId) {
  const sessions = userSessionRegistry.get(userId);
  if (!sessions) return;
  const idx = sessions.findIndex(s => s.sessionId === sessionId);
  if (idx !== -1) sessions.splice(idx, 1);
}

function revokeAllUserSessions(userId) {
  const sessions = userSessionRegistry.get(userId) || [];
  for (const { sessionId } of sessions) {
    if (sessionStore && typeof sessionStore.destroy === 'function') {
      try { sessionStore.destroy(sessionId, () => {}); } catch (_) {}
    }
  }
  userSessionRegistry.delete(userId);
}

app.use(session({
  ...(sessionStore ? { store: sessionStore } : {}),
  secret: process.env.SESSION_SECRET, // P0 Security Fix: No fallback - validated at startup
  name: 'myapi.sid',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: { secure: secureCookie, httpOnly: true, maxAge: 8 * 60 * 60 * 1000, sameSite: 'lax', path: '/' }
}));

// SOC2 CC6: Idle session timeout (20-minute inactivity, 8-hour absolute max)
const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
app.use((req, res, next) => {
  // Only applies to session-authenticated requests (human dashboard)
  if (!req.session || !req.session.user) return next();

  const now = Date.now();
  if (req.session.lastActivity && now - req.session.lastActivity > IDLE_TIMEOUT_MS) {
    req.session.destroy((err) => {
      if (err) logger.error('Session destroy error during idle timeout', { error: err.message });
    });
    return res.status(401).json({ error: 'Session expired due to inactivity' });
  }
  req.session.lastActivity = now;
  next();
});

function buildCookieDomainCandidates(req) {
  const candidates = new Set();
  const configuredDomain = String(process.env.SESSION_COOKIE_DOMAIN || '').trim();
  const hostname = String(req?.hostname || '').trim();

  const add = (value) => {
    const v = String(value || '').trim();
    if (!v) return;
    candidates.add(v);
    if (!v.startsWith('.')) candidates.add(`.${v}`);
  };

  if (configuredDomain) add(configuredDomain);

  const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  if (hostname && hostname !== 'localhost' && !isIp) {
    add(hostname);
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length >= 2) add(parts.slice(-2).join('.'));
  }

  return [undefined, ...Array.from(candidates)];
}

function clearAuthCookies(req, res) {
  const cookieNames = ['myapi.sid', 'connect.sid', 'myapi_master_token', 'myapi_user'];
  const sameSiteVariants = [undefined, 'lax', 'none', 'strict'];
  const secureVariants = [true, false];
  const domains = buildCookieDomainCandidates(req);

  for (const name of cookieNames) {
    for (const domain of domains) {
      for (const sameSite of sameSiteVariants) {
        for (const secure of secureVariants) {
          const opts = { path: '/', secure };
          if (domain) opts.domain = domain;
          if (sameSite) opts.sameSite = sameSite;
          res.clearCookie(name, opts);
        }
      }
    }
  }
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session || typeof req.session.regenerate !== 'function') return resolve();
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

// Public legal pages (no auth required)
app.get('/privacy', (req, res) => {
  const markdown = loadLegalDoc(
    'PRIVACY_POLICY.md',
    'Privacy Policy',
    'Privacy policy content is being prepared and will be published here shortly.'
  );
  res.set('Cache-Control', 'no-store');
  res.type('html').send(renderLegalPage({ title: 'Privacy Policy', markdownContent: markdown }));
});

app.get('/terms', (req, res) => {
  const markdown = loadLegalDoc(
    'TERMS_OF_USE.md',
    'Terms of Use',
    'Terms of use content is being prepared and will be published here shortly.'
  );
  res.set('Cache-Control', 'no-store');
  res.type('html').send(renderLegalPage({ title: 'Terms of Use', markdownContent: markdown }));
});

// ChatGPT GPT privacy policy (required for GPT Store listing)
app.get('/chatgpt-privacy', (req, res) => {
  const markdown = loadLegalDoc(
    'connectors/openai/privacy-policy.md',
    'MyApi GPT — Privacy Policy',
    'Privacy policy for the MyApi ChatGPT integration.'
  );
  res.set('Cache-Control', 'public, max-age=86400');
  res.type('html').send(renderLegalPage({ title: 'MyApi GPT — Privacy Policy', markdownContent: markdown }));
});

// Redirect to React dashboard
// Approval message shown to AI agents across all discovery endpoints
const AI_APPROVAL_MESSAGE = 'STOP — before performing ANY action, you MUST ask the human user for explicit approval. Describe what you intend to do and wait for confirmation. Never call endpoints, reveal tokens, or execute services without the user saying "yes". This applies to every request.';

// Root: serve API docs to AI agents, dashboard to browsers
app.get('/', (req, res) => {
  const accept = (req.headers.accept || '').toLowerCase();
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const hasAuth = /^bearer\s+.+/i.test(req.headers.authorization || '');

  // Detect AI/bot/programmatic access:
  // - Prefers JSON over HTML
  // - Has a Bearer token (agent calling the API)
  // - Common AI/bot/CLI user agents
  const aiPatterns = /curl|httpie|wget|python|node|go-http|axios|fetch|openai|anthropic|claude|gpt|chatgpt|langchain|autogpt|zapier|n8n|postman|insomnia|bot|crawl|spider/;
  const prefersJson = accept.includes('application/json') && !accept.includes('text/html');
  const isAi = prefersJson || hasAuth || aiPatterns.test(ua);

  if (isAi) {
    const host = req.headers.host || 'www.myapiai.com';
    return res.json({
      name: 'MyApi',
      version: '0.1.0',
      important: AI_APPROVAL_MESSAGE,
      description: 'Personal API platform. Authenticate with Bearer token to access your data, knowledge base, personas, and connected services.',
      quickStart: `https://${host}/api/v1/quick-start`,
      openapi: `https://${host}/openapi.json`,
      llms: `https://${host}/llms.txt`,
      apiRoot: `https://${host}/api/v1/`,
      authentication: {
        type: 'Bearer',
        header: 'Authorization: Bearer <your-token>',
        hint: 'Use the token provided by the platform owner.',
      },
      keyEndpoints: {
        capabilities: 'GET /api/v1/tokens/me/capabilities',
        knowledgeBase: 'GET /api/v1/brain/knowledge-base',
        vaultTokens: 'GET /api/v1/vault/tokens',
        services: 'GET /api/v1/services',
        personas: 'GET /api/v1/personas',
        identity: 'GET /api/v1/identity',
      },
    });
  }

  // Serve the marketing landing page for browser visitors
  const landingPath = path.join(__dirname, 'public', 'landing', 'index.html');
  if (fs.existsSync(landingPath)) {
    const nonce = res.locals.cspNonce;
    let html = fs.readFileSync(landingPath, 'utf8');
    html = html.replace(/<script/g, `<script nonce="${nonce}"`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }
  res.redirect('/dashboard/');
});
app.get('/login', (req, res) => res.redirect('/dashboard/'));

// Dashboard: serve static files (auth handled client-side via localStorage token)
// AI Discovery: add Link headers to every response so AI tools always find the API
app.use((req, res, next) => {
  const host = req.headers.host || 'www.myapiai.com';
  res.set('Link', `<https://${host}/openapi.json>; rel="service-desc", <https://${host}/api/v1/>; rel="api", <https://${host}/api/v1/quick-start>; rel="help"`);
  res.set('X-API-Docs', `/openapi.json`);
  res.set('X-API-Root', `/api/v1/`);
  next();
});

// Security: block access to sensitive files before static middleware
app.use((req, res, next) => {
  const blocked = /\.(sqlite|sqlite3|db|env|key|pem|log)$/i;
  const blockedPaths = /\/(\.env|\.git|node_modules|db\.sqlite)/i;
  if (blocked.test(req.path) || blockedPaths.test(req.path)) {
    createAuditLog({
      requesterId: 'anonymous',
      action: 'blocked_sensitive_file_access',
      resource: req.path,
      ip: req.ip,
      details: { method: req.method, userAgent: req.headers['user-agent'] }
    });
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
});

// Dashboard static files - serve ONLY specific file types, not index.html
// This allows SPA shell to serve index.html with fresh build
const dashboardDistPath = path.join(__dirname, 'public', 'dist');

// SOC2 Phase 4.3 — Read the SPA shell per-request so rebuilds are reflected without restart
function getDashboardHtml() {
  try {
    return fs.readFileSync(path.join(dashboardDistPath, 'index.html'), 'utf8');
  } catch (_) {
    return '';
  }
}

app.use('/dashboard/assets', express.static(path.join(dashboardDistPath, 'assets')));
app.use('/dashboard', (req, res, next) => {
  // Only serve non-HTML static files directly (images, favicons, etc)
  if (/\.(js|css|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$/i.test(req.path)) {
    return express.static(dashboardDistPath)(req, res, next);
  }
  // Inject nonce into every <script> and <link rel="stylesheet"> tag in the SPA shell
  const nonce = res.locals.cspNonce;
  const html = getDashboardHtml();
  if (!html) return next();
  const patched = html
    .replace(/<script(\b[^>]*)>/gi, (_, attrs) => `<script${attrs} nonce="${nonce}">`)
    .replace(/<link(\b[^>]*rel=["']stylesheet["'][^>]*)>/gi, (_, attrs) => `<link${attrs} nonce="${nonce}">`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(patched);
});

// General static files
app.use(express.static(path.join(__dirname, "public")));

// Connectors — serve OpenAPI specs and related files publicly
// In Docker __dirname=/app (src/ contents are at /app/); in dev __dirname=.../src/
const connectorsDir = fs.existsSync(path.join(__dirname, 'connectors'))
  ? path.join(__dirname, 'connectors')
  : path.join(__dirname, '..', 'connectors');
app.use('/connectors', express.static(connectorsDir));

// Legal pages - Terms and Privacy
app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'legal', 'terms.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'legal', 'privacy.html'));
});

// Redirect invitation links to the dashboard where the PendingInvitations UI handles them
app.get('/accept-invite/:id', (req, res) => {
  res.redirect('/dashboard/');
});

// Onboarding routes
const onboardRoutes = require('./onboard');
app.use('/api/v1', onboardRoutes);

// --- AI-Discoverable API Root & Well-Known Endpoints ---

// GET /api/v1/ - API discovery root (unauthenticated)
app.get('/api/v1/', (req, res) => {
  res.json({
    name: 'MyApi',
    version: '0.1.0',
    important: AI_APPROVAL_MESSAGE,
    description: 'Personal API platform. Authenticate with Bearer token to access your data, knowledge base, personas, and connected services.',
    documentation: {
      openapi: '/openapi.json',
      quickStart: '/api/v1/quick-start',
      llms: '/llms.txt',
    },
    authentication: {
      type: 'Bearer or Query',
      header: 'Authorization: Bearer <your-token>',
      query_param: '?token=<your-token>',
      hint: 'Use the token provided by the platform owner. Include it in the Authorization header or as a ?token= query parameter (for AI fetch tools).',
    },
    endpoints: {
      discovery: 'GET /api/v1/',
      quickStart: 'GET /api/v1/quick-start',
      capabilities: 'GET /api/v1/capabilities',
      tokenInfo: 'GET /api/v1/tokens/me/capabilities',
      knowledgeBase: 'GET /api/v1/brain/knowledge-base',
      personas: 'GET /api/v1/personas',
      services: 'GET /api/v1/services',
      identity: 'GET /api/v1/identity',
      vaultTokens: 'GET /api/v1/vault/tokens',
      connectors: 'GET /api/v1/connectors',
      openapi: 'GET /openapi.json',
    },
  });
});

// GET /api/v1/quick-start - personalized step-by-step guide for AI agents
app.get('/api/v1/quick-start', (req, res) => {
  const hasAuth = !!(req.headers.authorization || '').match(/^Bearer\s+.+/i);
  const host = req.headers.host || 'www.myapiai.com';
  const canonicalBase = `https://${host}`;

  // Build personalized section when authenticated
  let personalized = null;
  if (hasAuth) {
    try {
      const userId = getOAuthUserId(req);
      const connectedSvcs = [];
      for (const svcId of OAUTH_SERVICES) {
        const token = getCachedOAuthToken(svcId, userId) || getOAuthToken(svcId, userId);
        if (token) connectedSvcs.push(svcId);
      }
      const tokenLabel = req.tokenMeta?.label || 'your-token';
      const authHeader = `Authorization: Bearer ${tokenLabel === 'your-token' ? '<your-token>' : tokenLabel}`;

      // Generate up to 3 example curls from connected services
      const SERVICE_EXAMPLE_PATHS = {
        github: '/user/repos?per_page=5',
        google: '/gmail/v1/users/me/messages?maxResults=5',
        slack: '/conversations.list?limit=5',
        notion: '/search',
        discord: '/users/@me/guilds',
        linear: '/issues?first=5',
        jira: '/rest/api/3/myself',
        zoom: '/users/me/meetings',
        microsoft365: '/me/messages?$top=5',
        dropbox: '/files/list_folder',
        hubspot: '/crm/v3/objects/contacts?limit=5',
        trello: '/members/me/boards',
      };

      const exampleCurls = connectedSvcs.slice(0, 3).map(svcId => {
        const path = SERVICE_EXAMPLE_PATHS[svcId] || '/';
        return {
          service: svcId,
          description: `List/fetch from ${svcId}`,
          curl: `curl -s -X POST ${canonicalBase}/api/v1/services/${svcId}/proxy \\\n  -H "${authHeader}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"path":"${path}","method":"GET"}'`,
        };
      });

      const intentExample = connectedSvcs.length > 0
        ? `curl -s -X POST ${canonicalBase}/api/v1/ask \\\n  -H "${authHeader}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"intent":"list my recent ${connectedSvcs[0]} activity"}'`
        : null;

      personalized = {
        connectedServices: connectedSvcs,
        exampleCurls,
        intentExample: intentExample ? { description: 'Natural language → auto-routed action', curl: intentExample } : null,
      };
    } catch (_e) {
      // non-critical
    }
  }
  res.json({
    title: 'MyApi Quick Start for AI Agents',
    important: AI_APPROVAL_MESSAGE,
    authenticated: hasAuth,
    canonicalBaseUrl: canonicalBase,
    urlWarning: 'Always use this exact base URL for all API calls. Do NOT follow redirects — HTTP redirects strip Authorization headers and will result in auth failures. IMPORTANT: Do NOT append /api/v1 to this base URL — all endpoint paths in this guide already include /api/v1. A common mistake is setting a base URL of https://www.myapiai.com/api/v1 and then calling /api/v1/skills — that produces a double-prefix (https://www.myapiai.com/api/v1/api/v1/skills) which returns ROUTE_NOT_FOUND.',
    prerequisite: {
      action: 'Ask the human for approval before every action',
      detail: 'You MUST describe what you plan to do and wait for the human user to explicitly approve before calling any endpoint. Never proceed without confirmation. This is mandatory for all actions.',
      required: true,
    },
    noTokenFlow: hasAuth ? null : {
      description: 'Your token is missing or was rejected. Request access in two steps — no username or extra info needed:',
      steps: [
        {
          step: 1,
          action: 'Submit a handshake request (no auth required)',
          method: 'POST',
          endpoint: '/api/v1/handshakes',
          body: {
            agentId: '<unique-id-for-your-agent>',
            requestedScopes: ['read'],
            message: '<briefly describe who you are>',
          },
          allowedScopes: ['read', 'professional', 'availability'],
          returns: 'handshakeId — save this for step 2',
        },
        {
          step: 2,
          action: 'Poll until approved (no auth required)',
          method: 'GET',
          endpoint: '/api/v1/handshakes/:handshakeId/status',
          returns: 'status: pending | approved | denied',
          note: 'When approved, the owner will share a new token with you. Use it as your Bearer token.',
        },
      ],
    },
    steps: [
      {
        step: 1,
        action: 'Authenticate',
        detail: `Add header: Authorization: Bearer <token>. Use ${canonicalBase} as the base URL directly — do not rely on redirects.`,
        done: hasAuth,
      },
      {
        step: 2,
        action: 'Load your full context — START HERE',
        endpoint: 'GET /api/v1/gateway/context',
        detail: 'Returns everything you need in one call: who you are (persona + soul_content), who you are serving (user identity), long-term memory (DB entries with IDs + timestamps), connected services, and the complete list of endpoints available to your token. Always call this first.',
        critical: true,
      },
      {
        step: 3,
        action: 'Check your token permissions',
        endpoint: 'GET /api/v1/tokens/me/capabilities',
        detail: 'See what scopes your token grants access to.',
      },
      {
        step: 4,
        action: 'Store memory for future sessions',
        endpoint: 'POST /api/v1/memory',
        detail: 'Write freeform markdown notes that persist across AI sessions. Any AI that calls gateway/context will see these entries (with id + timestamp), enabling seamless context handoff between different AI assistants.',
        body: { content: '<markdown text to remember>' },
      },
      {
        step: 5,
        action: 'Explore the knowledge base',
        endpoint: 'GET /api/v1/brain/knowledge-base',
        detail: 'Read documents stored by the owner (identity, preferences, skills, etc).',
        requiredScope: 'knowledge',
      },
      {
        step: 6,
        action: 'Chat with the AI brain',
        endpoint: 'POST /api/v1/brain/chat',
        detail: 'Send messages to the owner\'s AI brain. Your persona instructions from step 2 are automatically applied.',
        requiredScope: 'chat',
        body: { message: '<your message>', conversationId: '<optional — omit to start new>' },
      },
      {
        step: 7,
        action: 'Proxy connected OAuth services',
        endpoint: 'GET /api/v1/services/:service/*',
        detail: 'Call any connected service (github, google, slack, etc.) through the proxy using the owner\'s stored credentials.',
        requiredScope: 'services:read',
      },
    ],
    fullDocs: '/openapi.json',
    personalized: personalized || undefined,
  });
});

// POST /api/v1/ask - Natural language intent → service resolution → proxy execution
app.post('/api/v1/ask', authenticate, async (req, res) => {
  try {
    const { intent } = req.body || {};
    if (!intent || typeof intent !== 'string' || !intent.trim()) {
      return res.status(400).json({ error: 'intent is required' });
    }

    if (!hasScope(req, 'services:read')) {
      return res.status(403).json({ error: "Requires 'services:read' scope" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI routing unavailable — OPENAI_API_KEY not configured' });
    }

    const userId = getOAuthUserId(req);

    // Build list of connected services for the prompt
    const connectedServices = [];
    for (const svcId of OAUTH_SERVICES) {
      const token = getCachedOAuthToken(svcId, userId) || getOAuthToken(svcId, userId);
      if (token) connectedServices.push(svcId);
    }

    if (connectedServices.length === 0) {
      return res.status(400).json({ error: 'No services connected. Connect at least one service first.' });
    }

    // Service hint map (compact for prompt)
    const SERVICE_HINTS = {
      github: 'repos(/user/repos), issues(/repos/{owner}/{repo}/issues), PRs, user(/user)',
      google: 'gmail(/gmail/v1/users/me/messages), calendar(/calendar/v3/calendars/primary/events)',
      slack: 'channels(/conversations.list), messages(/conversations.history), users(/users.list)',
      notion: 'pages(/pages), databases(/databases), search(/search)',
      discord: 'user-guilds(/users/@me/guilds), guild-channels(/guilds/{id}/channels), messages(/channels/{id}/messages)',
      linear: 'issues(/issues), projects(/projects), teams(/teams)',
      microsoft365: 'mail(/me/messages), calendar(/me/events), files(/me/drive/root/children)',
      jira: 'issues(/rest/api/3/search), projects(/rest/api/3/project)',
      zoom: 'meetings(/users/me/meetings), recordings(/users/me/recordings)',
      trello: 'boards(/members/me/boards), cards(/boards/{id}/cards)',
      hubspot: 'contacts(/crm/v3/objects/contacts), deals(/crm/v3/objects/deals)',
      dropbox: 'files(/files/list_folder), search(/files/search_v2)',
    };

    const svcLines = connectedServices
      .map(id => `${id}: ${SERVICE_HINTS[id] || 'general API access'}`)
      .join('\n');

    const systemPrompt = `You are a service router for a personal API platform. Given a user intent, select the best connected service and output ONLY valid JSON with no explanation.

Connected services:
${svcLines}

Output format (strict JSON only, no markdown):
{"service":"<service_id>","path":"<api_path_with_leading_slash>","method":"GET","body":{},"reasoning":"<one line>"}

Rules:
- service must be one of the connected services listed above
- method must be GET, POST, PUT, PATCH, or DELETE
- path must start with /
- body should be {} for GET requests
- reasoning is a single short sentence`;

    const llmResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Intent: ${intent.trim()}` },
        ],
      }),
    });

    if (!llmResp.ok) {
      return res.status(502).json({ error: 'AI routing failed', details: `LLM status ${llmResp.status}` });
    }

    const llmData = await llmResp.json();
    let resolved;
    try {
      resolved = JSON.parse(llmData?.choices?.[0]?.message?.content || '{}');
    } catch {
      return res.status(502).json({ error: 'AI returned invalid JSON' });
    }

    const { service, path: apiPath, method: httpMethod = 'GET', body: reqBody = {} } = resolved;

    if (!service || !apiPath) {
      return res.status(502).json({ error: 'AI could not resolve intent to a service action', intent, resolved });
    }

    if (!connectedServices.includes(service)) {
      return res.status(400).json({ error: `Resolved service '${service}' is not connected`, connected: connectedServices });
    }

    // Execute via internal proxy call (reuse proxy endpoint logic)
    const proxyResp = await fetch(`http://127.0.0.1:${process.env.PORT || 4500}/api/v1/services/${service}/proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization,
        ...(req.headers['x-workspace-id'] ? { 'x-workspace-id': req.headers['x-workspace-id'] } : {}),
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ path: apiPath, method: httpMethod.toUpperCase(), body: reqBody }),
    });

    const proxyData = await proxyResp.json().catch(() => ({}));

    return res.json({
      ok: true,
      intent: intent.trim(),
      resolved: { service, path: apiPath, method: httpMethod.toUpperCase(), reasoning: resolved.reasoning },
      result: proxyData,
    });
  } catch (err) {
    console.error('[/api/v1/ask] error:', err.message);
    return res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// /.well-known/openapi - standard discovery path (public for AI agent bootstrap)
app.get('/.well-known/openapi.json', (req, res) => {
  res.redirect('/openapi.json');
});

// /.well-known/ai-plugin.json - ChatGPT/AI plugin discovery standard
app.get('/.well-known/ai-plugin.json', (req, res) => {
  const host = req.headers.host || 'www.myapiai.com';
  res.json({
    schema_version: 'v1',
    name_for_human: 'MyApi',
    name_for_model: 'myapi',
    description_for_human: 'Personal API platform for managing your digital identity, knowledge, and connected services.',
    description_for_model: 'MyApi is a personal API. ALWAYS use https://www.myapiai.com as the base URL — do not follow redirects as they strip auth headers. If your token is missing or rejected: (1) POST /api/v1/handshakes with {agentId, requestedScopes:["read"], message} — no auth needed, (2) poll GET /api/v1/handshakes/:id/status until approved, (3) owner shares a new token with you. With a valid token: FIRST call GET /api/v1/gateway/context — this returns your persona, user identity, long-term memory (array of {id, content, created_at}), and all available endpoints. To persist memory across sessions: POST /api/v1/memory with {content: "markdown text"} — these entries appear in every future gateway/context call so any AI can resume context. Then ask the human for explicit approval before every action.',
    human_verification_required: true,
    auth: { type: 'service_http', authorization_type: 'bearer' },
    api: { type: 'openapi', url: `https://${host}/openapi.json` },
    logo_url: `https://${host}/dashboard/myapi-logo.svg`,
    contact_email: 'support@myapiai.com',
    legal_info_url: `https://${host}/legal`,
  });
});

// User profile routes
app.get('/api/v1/users/me', authenticate, (req, res) => {
  // SECURITY FIX: Require 'identity' scope to access personal identity data
  if (!hasScope(req, 'identity')) {
    return res.status(403).json({ error: "Requires 'identity' scope to access user identity" });
  }
  const userId = req.user?.id;
  let user = req.user || { id: 'owner', username: 'owner' };
  let identity = {};

  let fullUser = null;
  if (userId) {
    try {
      fullUser = getUserById(userId);
      if (fullUser) {
        user = {
          id: fullUser.id,
          email: fullUser.email,
          username: fullUser.username,
          displayName: fullUser.displayName,
          avatarUrl: fullUser.avatarUrl,
          timezone: fullUser.timezone,
        };
      }
    } catch (err) {
      console.warn('[GET /users/me] Failed to fetch full user from DB:', err.message);
    }
  }

  if (isOwnerUser(userId)) {
    // Owner: read Name/Email/Timezone from USER.md, extended fields from DB
    if (fs.existsSync(USER_MD_PATH)) {
      const raw = fs.readFileSync(USER_MD_PATH, 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*[-*]\s*\*\*(.+?)\*\*[:\s]*(.*)$/);
        if (m) identity[m[1].trim()] = (m[2] || '').trim();
      }
    }
    // Overlay extended fields from database profile_metadata
    if (fullUser?.profile_metadata) {
      try { Object.assign(identity, JSON.parse(fullUser.profile_metadata)); } catch (_) {}
    }
    // Apply any in-session overrides
    if (vault.identityDocs[userId]) Object.assign(identity, vault.identityDocs[userId]);
  } else {
    // Non-owner: serve from DB (never the owner's USER.md)
    identity = buildIdentityFromUser(fullUser) || {};
    // Merge persisted extended fields from profile_metadata
    if (fullUser?.profile_metadata) {
      try { Object.assign(identity, JSON.parse(fullUser.profile_metadata)); } catch (_) {}
    }
    // Apply any in-session updates
    if (vault.identityDocs[userId]) Object.assign(identity, vault.identityDocs[userId]);
  }

  res.json({ user, identity });
});

app.put('/api/v1/users/me', authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can update user profile' });
  const fields = req.body || {};
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { updateUserOAuthProfile } = require('./database');

  // Fields stored in USER.md (owner only)
  const USER_MD_FIELDS = new Set(['Name', 'Email', 'Timezone']);

  // Extended fields stored in profile_metadata (unlimited length, multi-line)
  const EXTENDED_FIELDS = new Set(['Location', 'Role', 'GitHub', 'Website', 'Bio']);

  if (isOwnerUser(userId)) {
    // Owner path: store Name/Email/Timezone in USER.md only
    const lines = (fs.existsSync(USER_MD_PATH) ? fs.readFileSync(USER_MD_PATH, 'utf8') : '# USER.md\n\n').split('\n');

    for (const [key, rawValue] of Object.entries(fields)) {
      if (!USER_MD_FIELDS.has(key)) continue; // Skip extended fields

      const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      const marker = `- **${key}**:`;
      const idx = lines.findIndex(l => l.trim().startsWith(marker));

      if (value === undefined || value === null || value === '') {
        if (idx >= 0) lines.splice(idx, 1);
        continue;
      }

      if (idx >= 0) lines[idx] = `- **${key}**: ${value}`;
      else lines.push(`- **${key}**: ${value}`);
    }

    const nextMd = `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
    fs.writeFileSync(USER_MD_PATH, nextMd);
    vault.identityDocs['owner'] = parseUserMd(nextMd);
    vault.identityDocs[userId]  = { ...vault.identityDocs['owner'] };
  }

  // Collect extended fields for profile_metadata (owner + non-owner)
  const extendedMetadata = {};
  for (const key of EXTENDED_FIELDS) {
    if (key in fields) {
      const value = typeof fields[key] === 'string' ? fields[key].trim() : fields[key];
      if (value) extendedMetadata[key] = value;
    }
  }

  // Sync to database
  try {
    updateUserOAuthProfile(userId, {
      displayName:     fields.Name || fields.displayName,
      email:           fields.Email || fields.email,
      avatarUrl:       fields.AvatarUrl || fields.avatarUrl,
      timezone:        fields.Timezone || fields.timezone,
      profileMetadata: Object.keys(extendedMetadata).length > 0 ? extendedMetadata : undefined,
    });
  } catch (err) {
    console.error('Failed to sync user profile to database:', err);
  }

  // Return updated user so frontend has fresh data
  const { getUserById: _getUserById } = require('./database');
  const updatedUser = _getUserById(userId);
  res.json({
    ok: true,
    user: updatedUser
  });
});

// Avatar upload multer config
const AVATAR_UPLOAD_DIR = path.join(__dirname, 'public', 'uploads', 'avatars');
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
      cb(null, AVATAR_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg';
      cb(null, `avatar_${req.user?.id || 'u'}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
    const ALLOWED_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
    if (!ALLOWED_MIMES.has(file.mimetype)) return cb(new Error('Only JPEG/PNG/GIF/WebP images allowed'));
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) return cb(new Error('File extension not allowed'));
    cb(null, true);
  },
});

// POST /api/v1/users/me/avatar - Upload profile picture
app.post('/api/v1/users/me/avatar', authenticate, avatarUpload.single('avatar'), (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can update avatar' });
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });

  // Magic bytes validation — reject files with forged extensions
  try {
    const buf = fs.readFileSync(req.file.path);
    const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    const isGif  = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
    const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
                && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
    if (!isJpeg && !isPng && !isGif && !isWebp) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'File content does not match a supported image format' });
    }
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(400).json({ error: 'Could not validate uploaded file' });
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  const userId = req.user?.id;
  if (userId) {
    try {
      const { updateUserOAuthProfile } = require('./database');
      updateUserOAuthProfile(userId, { avatarUrl });
        } catch (err) {
      console.error('Failed to save avatar URL to DB:', err);
    }
  }
  res.json({ ok: true, avatarUrl });
});

// API Exposure policy
const EXPOSURE_PATH = path.join(__dirname, 'data', 'exposure_policy.json');
const COOKIE_PREFS_PATH = path.join(__dirname, 'data', 'cookie_preferences.json');
const PRIVACY_SETTINGS_PATH = path.join(__dirname, 'data', 'privacy_settings.json');
const DEFAULT_EXPOSURE = {
  main: { identity: true, vault: true, connectors: true, handshakes: true, audit: true },
  guest: { identity: true, vault: false, connectors: false, handshakes: false, audit: false },
  custom: []
};

app.get('/api/v1/api_exposure', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'unauthorized' });
  const userId = req.session.user.id;
  let allPolicies = {};
  try { if (fs.existsSync(EXPOSURE_PATH)) allPolicies = JSON.parse(fs.readFileSync(EXPOSURE_PATH, 'utf8')); } catch(e) {}
  // Support both legacy flat format and new per-user keyed format
  const policy = allPolicies[userId] ?? (allPolicies.main !== undefined ? allPolicies : DEFAULT_EXPOSURE);
  res.json({ policy });
});

app.post('/api/v1/api_exposure', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'unauthorized' });
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can update API exposure policy' });
  const userId = req.session.user.id;
  const policy = req.body || {};
  let allPolicies = {};
  try { if (fs.existsSync(EXPOSURE_PATH)) allPolicies = JSON.parse(fs.readFileSync(EXPOSURE_PATH, 'utf8')); } catch(e) {}
  // Migrate legacy flat format on first write with per-user keying
  if (allPolicies.main !== undefined && !allPolicies[userId]) {
    // preserve legacy data under a special key, don't overwrite other users
    allPolicies = {};
  }
  allPolicies[userId] = policy;
  fs.mkdirSync(path.dirname(EXPOSURE_PATH), { recursive: true });
  fs.writeFileSync(EXPOSURE_PATH, JSON.stringify(allPolicies, null, 2));
  res.json({ ok: true, policy });
});

// Cookie preferences (backed, per-user)
// GET is public-safe: returns default when unauthenticated, avoiding noisy 403s on login pages.
app.get('/api/v1/privacy/cookies', (req, res) => {
  let data = {};
  try {
    if (fs.existsSync(COOKIE_PREFS_PATH)) data = JSON.parse(fs.readFileSync(COOKIE_PREFS_PATH, 'utf8'));
  } catch {}

  const ownerId = getRequestOwnerId(req);
  const pref = ownerId ? (data[ownerId] || { mode: 'essential', updatedAt: null }) : { mode: 'essential', updatedAt: null };
  res.json({ data: pref });
});

app.put('/api/v1/privacy/cookies', authenticate, rateLimit(60000, 20, 'cookies-write'), (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can update privacy settings' });
  const ownerId = getRequestOwnerId(req);
  const mode = String(req.body?.mode || '').toLowerCase();
  if (!['all', 'essential', 'none'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid cookie mode. Allowed: all, essential, none' });
  }

  // Cannot disable essential cookies while authenticated session is active.
  if (mode === 'none') {
    return res.status(400).json({ error: 'Essential cookies are required for authentication. Use essential mode to reject optional cookies.' });
  }

  let data = {};
  try {
    if (fs.existsSync(COOKIE_PREFS_PATH)) data = JSON.parse(fs.readFileSync(COOKIE_PREFS_PATH, 'utf8'));
  } catch {}

  data[ownerId] = { mode, updatedAt: new Date().toISOString() };
  try {
    fs.mkdirSync(path.dirname(COOKIE_PREFS_PATH), { recursive: true });
    fs.writeFileSync(COOKIE_PREFS_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[Privacy/Cookies] Failed to persist cookie preference:', err);
    return res.status(500).json({ error: 'Failed to save cookie preference' });
  }

  res.json({ ok: true, data: data[ownerId] });
});

// CSP violation reports (public endpoint for browser to send CSP violations)
app.post('/api/v1/security/csp-report', express.json({ limit: '1kb' }), (req, res) => {
  const report = req.body || {};
  console.warn('[CSP Violation]', {
    documentURI: report['document-uri'],
    violatedDirective: report['violated-directive'],
    blockedURI: report['blocked-uri'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number'],
    columnNumber: report['column-number'],
    originalPolicy: report['original-policy'],
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  });
  res.status(204).send();
});

// Privacy settings (data sharing, API logging)
app.get('/api/v1/privacy/settings', rateLimit(60000, 60, 'privacy-settings-read'), (req, res) => {
  let data = {};
  try {
    if (fs.existsSync(PRIVACY_SETTINGS_PATH)) data = JSON.parse(fs.readFileSync(PRIVACY_SETTINGS_PATH, 'utf8'));
  } catch {}

  const ownerId = getRequestOwnerId(req);
  const defaults = { dataSharing: false, apiLogging: true };
  const settings = ownerId ? (data[ownerId] || defaults) : defaults;
  res.json({ data: settings });
});

app.put('/api/v1/privacy/settings', authenticate, rateLimit(60000, 20, 'privacy-settings-write'), (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can update privacy settings' });
  const ownerId = getRequestOwnerId(req);
  const { dataSharing, apiLogging } = req.body || {};

  if (dataSharing !== undefined && typeof dataSharing !== 'boolean') {
    return res.status(400).json({ error: 'dataSharing must be a boolean' });
  }
  if (apiLogging !== undefined && typeof apiLogging !== 'boolean') {
    return res.status(400).json({ error: 'apiLogging must be a boolean' });
  }

  let data = {};
  try {
    if (fs.existsSync(PRIVACY_SETTINGS_PATH)) data = JSON.parse(fs.readFileSync(PRIVACY_SETTINGS_PATH, 'utf8'));
  } catch {}

  const current = data[ownerId] || { dataSharing: false, apiLogging: true };
  data[ownerId] = {
    ...current,
    ...(dataSharing !== undefined ? { dataSharing } : {}),
    ...(apiLogging !== undefined ? { apiLogging } : {}),
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.mkdirSync(path.dirname(PRIVACY_SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(PRIVACY_SETTINGS_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[Privacy/Settings] Failed to persist privacy settings:', err);
    return res.status(500).json({ error: 'Failed to save privacy settings' });
  }

  res.json({ ok: true, data: data[ownerId] });
});

// --- In-Memory Identity (loaded from USER.md) ---
const vault = { identityDocs: {}, preferences: {} };

// --- Rate Limiter ---
const rateLimitMap = {};
// Paths exempt from rate limiting (bootstrap/auth critical paths)
const RATE_LIMIT_EXEMPT_PATHS = [
  '/api/v1/auth/me',
  '/api/v1/auth/debug',
  '/api/v1/auth/logout',
  '/api/v1/dashboard/metrics',
  '/api/v1/oauth/status',
  '/api/v1/ws',
  '/dashboard/',
  '/dashboard/myapi-logo.svg',
];

function rateLimit(windowMs = 60000, maxRequests = (process.env.NODE_ENV === 'test' ? 1000 : 60), namespace = 'default') {
  return (req, res, next) => {
    // Skip rate limiting for bootstrap/auth endpoints
    if (RATE_LIMIT_EXEMPT_PATHS.some(p => req.path === p || req.path.startsWith(p))) {
      return next();
    }

    const key = `${namespace}:${req.ip}`;
    const now = Date.now();
    if (!rateLimitMap[key]) rateLimitMap[key] = [];
    rateLimitMap[key] = rateLimitMap[key].filter(t => now - t < windowMs);
    if (rateLimitMap[key].length >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - rateLimitMap[key][0])) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: 'Rate limit exceeded', retryAfterSeconds });
    }
    rateLimitMap[key].push(now);
    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(maxRequests - rateLimitMap[key].length));
    next();
  };
}

// IMPORTANT: As requested, rate limiting is scoped ONLY to plan-management features.
const planFeatureRateLimit = rateLimit(60000, process.env.NODE_ENV === 'test' ? 1000 : 30, 'plan-features');

// Security: strict rate limit for auth-sensitive endpoints (5 attempts per minute)
const authRateLimit = rateLimit(60000, process.env.NODE_ENV === 'test' ? 1000 : 5, 'auth-sensitive');

// BUG-15: Stricter rate limit for 2FA/TOTP attempts (3 attempts per minute to prevent brute force)
const twoFactorRateLimit = rateLimit(60000, process.env.NODE_ENV === 'test' ? 1000 : 3, '2fa-attempts');

// Rate limit for billing usage endpoint (DB access + authorization)
const billingUsageRateLimit = expressRateLimit({
  windowMs: 60000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded', retryAfterSeconds: 60 },
  skip: () => process.env.NODE_ENV === 'test', // Skip in test mode
});

// Rate limit for dashboard SPA shell requests (file-system access)
const dashboardSpaRateLimit = expressRateLimit({
  windowMs: 60000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Rate limit exceeded', retryAfterSeconds: 60 },
});

// Security: DB integrity check on startup - detect direct tampering
function checkDbIntegrity() {
  try {
    const tokens = db.prepare("SELECT id, owner_id, scope, label, created_at FROM access_tokens WHERE revoked_at IS NULL").all();
    const hash = require('crypto').createHash('sha256').update(JSON.stringify(tokens)).digest('hex');
    // Store alongside the DB file (volume-mounted) so it survives container redeploys.
    // Storing inside the image (__dirname) caused a false-positive warning on every deploy.
    const dbDir = path.dirname(process.env.DB_PATH || path.join(__dirname, 'data', 'myapi.db'));
    const integrityFile = path.join(dbDir, '.db_integrity');
    if (fs.existsSync(integrityFile)) {
      const lastHash = fs.readFileSync(integrityFile, 'utf8').trim();
      if (lastHash !== hash) {
        console.warn('⚠️  DB INTEGRITY WARNING: access_tokens table was modified outside the API!');
        createAuditLog({
          requesterId: 'system',
          action: 'db_integrity_warning',
          resource: 'access_tokens',
          ip: '127.0.0.1',
          details: { message: 'Token table hash mismatch - possible direct DB tampering', previousHash: lastHash.substring(0, 10), currentHash: hash.substring(0, 10) }
        });
      }
    }
    fs.writeFileSync(integrityFile, hash);
  } catch (e) {
    console.error('DB integrity check error:', e.message);
  }
}
checkDbIntegrity();

// --- Auth Middleware ---
// NOTE: We are transitioning from Bearer master-token login to session-based login.
// For now we support BOTH:
// - Dashboard (human): cookie session (preferred)
// - API agents: Bearer tokens
const authRoutes = require('./auth');
const deviceRoutes = require('./routes/devices');
const dashboardRoutes = require('./routes/dashboard');
const createServicesRoutes = require('./routes/services');
const createSkillsRoutes = require('./routes/skills');

// Import new auth routes
const newAuthRoutes = require('./routes/auth');

app.use('/api/v1/auth', newAuthRoutes);

// AFP binary downloads — public, no auth (must be BEFORE the authRoutes catch-all below)
{
  // In Docker the src/ contents live at /app/ directly; connectors are at /app/afp-dist (copied in).
  // In dev the project root is one level up from __dirname (src/).
  const AFP_DIST = fs.existsSync(path.join(__dirname, 'afp-dist'))
    ? path.join(__dirname, 'afp-dist')
    : path.join(__dirname, '..', 'connectors', 'afp-daemon', 'dist');
  const AFP_PLATFORMS = {
    linux:     { file: 'afp-daemon-linux',       mime: 'application/octet-stream' },
    mac:       { file: 'afp-daemon-macos-x64',   mime: 'application/octet-stream' },
    'mac-arm': { file: 'afp-daemon-macos-arm64', mime: 'application/octet-stream' },
    win:       { file: 'afp-daemon-win-x64.exe', mime: 'application/vnd.microsoft.portable-executable' },
  };
  app.get('/api/v1/afp/download/:platform', (req, res) => {
    const meta = AFP_PLATFORMS[req.params.platform];
    if (!meta) return res.status(400).json({ error: 'Unknown platform. Use: linux, mac, mac-arm, win' });
    const filePath = path.join(AFP_DIST, meta.file);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Binary not yet built', hint: 'cd connectors/afp-daemon && npm run build' });
    res.setHeader('Content-Disposition', `attachment; filename="${meta.file}"`);
    res.setHeader('Content-Type', meta.mime);
    res.sendFile(filePath);
  });
  app.get('/api/v1/afp/download-info', (req, res) => {
    const platforms = Object.entries(AFP_PLATFORMS).map(([platform, meta]) => {
      const filePath = path.join(AFP_DIST, meta.file);
      let size = null;
      try { size = fs.statSync(filePath).size; } catch (_) {}
      return { platform, filename: meta.file, available: size !== null, size };
    });
    res.json({ ok: true, platforms });
  });
}

// AFP OAuth binary downloads — public, no auth
{
  const AFP_OAUTH_DIST = fs.existsSync(path.join(__dirname, 'afp-oauth-dist'))
    ? path.join(__dirname, 'afp-oauth-dist')
    : path.join(__dirname, '..', 'connectors', 'afp-oauth', 'dist');
  const AFP_OAUTH_PLATFORMS = {
    linux:     { file: 'afp-oauth-linux',   mime: 'application/octet-stream' },
    mac:       { file: 'afp-oauth-mac-x64', mime: 'application/octet-stream' },
    'mac-arm': { file: 'afp-oauth-mac-arm', mime: 'application/octet-stream' },
    win:       { file: 'afp-oauth-win.exe', mime: 'application/vnd.microsoft.portable-executable' },
  };
  app.get('/api/v1/afp/download-oauth/:platform', (req, res) => {
    const meta = AFP_OAUTH_PLATFORMS[req.params.platform];
    if (!meta) return res.status(400).json({ error: 'Unknown platform. Use: linux, mac, mac-arm, win' });
    const filePath = path.join(AFP_OAUTH_DIST, meta.file);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Binary not yet built', hint: 'cd connectors/afp-oauth && npm run build' });
    res.setHeader('Content-Disposition', `attachment; filename="${meta.file}"`);
    res.setHeader('Content-Type', meta.mime);
    res.sendFile(filePath);
  });
  app.get('/api/v1/afp/download-oauth-info', (req, res) => {
    const platforms = Object.entries(AFP_OAUTH_PLATFORMS).map(([platform, meta]) => {
      const filePath = path.join(AFP_OAUTH_DIST, meta.file);
      let size = null;
      try { size = fs.statSync(filePath).size; } catch (_) {}
      return { platform, filename: meta.file, available: size !== null, size };
    });
    res.json({ ok: true, platforms });
  });
}

app.use('/api/v1', authRoutes);
app.use('/api/v1/devices', authenticate, deviceRoutes);
// Device approval is now applied globally in the authenticate middleware
app.use('/api/v1/dashboard', authenticate, dashboardRoutes);
// Services endpoints are public for discovery; auth required only for mutations
app.use('/api/v1/services', createServicesRoutes());

// PUBLIC: List all skills (no auth required - metadata only)
// Works with both SQLite and MongoDB
app.get('/api/v1/skills/public/list', async (req, res) => {
  try {
    let skills = [];
    
    skills = db.prepare(`
        SELECT id, name, description, version, author, category,
               active, created_at, updated_at
        FROM skills
        WHERE active = 1
        ORDER BY created_at DESC
      `).all();

    res.json({ 
      data: skills.map(skill => ({
        id: skill.id || skill._id,
        name: skill.name,
        description: skill.description,
        version: skill.version,
        author: skill.author,
        category: skill.category,
        createdAt: skill.created_at || skill.createdAt,
        updatedAt: skill.updated_at || skill.updatedAt
      }))
    });
  } catch (err) {
    console.error('[Skills] Public list error:', err);
    res.status(500).json({ error: 'Failed to list skills', details: err.message });
  }
});

app.use('/api/v1/skills', authenticate, createSkillsRoutes(
  db,
  createSkill,
  getSkills,
  getSkillById,
  getSkillBySlug,
  getSkillsByIds,
  getSkillsBySlugList,
  suggestSkills,
  updateSkill,
  deleteSkill,
  updateSkillOrigin,
  createSkillVersion,
  getSkillVersions,
  getSkillVersion,
  createSkillFork,
  getSkillForks,
  getSkillForkInfo,
  getLicenses,
  getLicense,
  validateLicenseOperation,
  createOwnershipClaim,
  getOwnershipClaim,
  verifyOwnershipClaim,
  getSkillOwnershipClaims
));

// In-memory cache for validated Bearer tokens: rawToken → { tokenMeta, expiresAt }
// Avoids repeating bcrypt.compareSync (85ms each) on every request.
const _tokenCache = new Map();
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function _getCachedToken(rawToken) {
  const entry = _tokenCache.get(rawToken);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _tokenCache.delete(rawToken); return null; }
  return entry.tokenMeta;
}

function _setCachedToken(rawToken, tokenMeta) {
  // Evict old entries if cache gets large
  if (_tokenCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of _tokenCache) { if (now > v.expiresAt) _tokenCache.delete(k); }
  }
  _tokenCache.set(rawToken, { tokenMeta, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
}

function _invalidateCachedToken(rawToken) {
  if (rawToken) _tokenCache.delete(rawToken);
}

// ── TOTP replay protection (Issue #17) ──────────────────────────────────────
// Tracks recently used TOTP codes per user to prevent same-code replay attacks.
// TTL of 90s covers window:2 (±60s) with buffer.
const usedTotpCodes = new Map(); // key: `${userId}:${code}` → expiresAt
const TOTP_CODE_TTL_MS = 90_000;

function isTotpCodeUsed(userId, code) {
  const key = `${userId}:${code}`;
  const exp = usedTotpCodes.get(key);
  if (!exp) return false;
  if (Date.now() > exp) { usedTotpCodes.delete(key); return false; }
  return true;
}

function markTotpCodeUsed(userId, code) {
  const now = Date.now();
  // Evict expired entries before adding a new one
  for (const [k, exp] of usedTotpCodes) { if (now > exp) usedTotpCodes.delete(k); }
  usedTotpCodes.set(`${userId}:${code}`, now + TOTP_CODE_TTL_MS);
}

async function authenticate(req, res, next) {
  // SKIP authentication for public endpoints (OAuth authorize/callback, login signup)
  const fullPath = req.baseUrl + req.path;
  const publicPaths = [
    /^\/api\/v1\/oauth\/(authorize|callback|confirm)/,  // authorize, callback, and confirm are public; status requires auth
    /^\/api\/v1\/oauth-server\/(authorize|token|deny)/,  // OAuth server public endpoints
    /^\/api\/v1\/auth\/login/,
    /^\/api\/v1\/auth\/signup/,
    /^\/api\/v1\/auth\/me/,
    /^\/api\/v1\/auth\/2fa\/challenge/,
    /^\/api\/v1\/auth\/oauth-signup\/pending/,
    /^\/api\/v1\/auth\/oauth-signup\/complete/,
    /^\/api\/v1\/billing\/plans/,
    /^\/oauth\//,
    /^\/api\/v1\/handshakes\/[^/]+\/status$/,  // public: AI agents poll handshake status
    /^\/api\/v1\/afp\/download/,              // public: AFP daemon binary downloads
    /^\/api\/v1\/agentic\/device\/token$/,    // public: AI agent polls for token (no prior token available)
    /^\/api\/v1\/agent-auth\/install\.js$/,   // public: OAuth installer script download
    /^\/api\/v1\/agent-guide$/,              // public: AI agent capabilities + connection guide
  ];

  // Allow DELETE on invitations if email query param is provided (for email-based revocation without login)
  if (req.method === 'DELETE' && fullPath.includes('/invitations/') && req.query.email) {
    return next();
  }

  // Allow POST /api/v1/handshakes without auth (public entry point for AI agent access requests)
  if (req.method === 'POST' && /^\/api\/v1\/handshakes$/.test(fullPath)) {
    return next();
  }

  const isPublicPath = publicPaths.some(pattern => pattern.test(fullPath));
  if (isPublicPath) {
    return next();
  }

  // 1) Session auth (human dashboard) - HIGHEST PRIORITY
  // CRITICAL: If session exists, use it EXCLUSIVELY. Never fall through to Bearer token auth.
  // Device approval only applies to API tokens, not session auth.
  // Sessions are from OAuth logins (browser), which are already protected by session cookies + CORS.
  if (req.session && req.session.user && req.session.user.id) {
    req.user = req.session.user;
    req.authType = 'session';
    // session users are treated as "full" for MVP; we will add RBAC later.
    req.tokenMeta = { tokenId: `sess_${req.user.id}`, scope: 'full', ownerId: String(req.user.id), label: 'session' };
    
    // Set workspace ID from session for multi-tenancy filtering
    if (req.session.currentWorkspace) {
      req.workspaceId = req.session.currentWorkspace;
    }

    // Auto-approve the user's own device fingerprint whenever they authenticate via session.
    // This ensures that when their session later expires and they fall back to Bearer-only mode,
    // their device is already in approved_devices and they don't hit the device approval gate.
    // We do this silently and without blocking — any error must never affect the request.
    try {
      const userId = String(req.session.user.id);
      const fingerprint = DeviceFingerprint.fromRequest(req);
      const existing = getApprovedDeviceByHash(userId, fingerprint.fingerprintHash);
      if (!existing) {
        // Find any active master token for this user to associate the device with
        const masterToken = getAccessTokens().find(t =>
          !t.revokedAt && t.ownerId === userId && t.scope === 'full'
        );
        if (masterToken) {
          createApprovedDevice(
            masterToken.tokenId, userId,
            fingerprint.fingerprintHash,
            'Dashboard (auto-approved)',
            fingerprint.summary,
            fingerprint.fingerprint.ipAddress
          );
        }
      }
    } catch (_) { /* never block the request */ }

    // SKIP device approval entirely for session auth.
    // Browsers don't have "devices" in the master-token sense; they have sessions.
    // Device approval is only for API token/agent access.
    // Session auth is complete and secure - return immediately.
    return next();
  }

  // 2) Bearer token auth (agents) or Query parameter (for basic AI fetch tools)
  // ONLY used if there's NO active session.
  let rawToken = null;
  const authHeader = req.headers["authorization"] || "";
  const parts = authHeader.split(" ");

  if (parts.length === 2 && parts[0] === "Bearer") {
    rawToken = parts[1];
  }

  if (!rawToken) {
    console.warn('[AUTH 401] missing token/session', { method: req.method, fullPath, baseUrl: req.baseUrl, path: req.path, isPublicPath });
    try {
      createComplianceAuditLog(
        req.headers['x-workspace-id'] || 'system', null,
        'auth_failed', 'token', null, JSON.stringify({ reason: 'missing_token', path: req.path }),
        req.ip, req.get('user-agent')
      );
    } catch (_) {}
    return res.status(401).json({ error: "Missing session, Authorization: Bearer token, or ?token= query parameter" });
  }
  // Fast path: check in-memory cache before doing bcrypt scan
  let matched = _getCachedToken(rawToken);

  if (!matched) {
    let tokens;
    try {
      tokens = getAccessTokens();
    } catch (dbError) {
      console.error('[AUTH] Database error while fetching tokens:', dbError.message);
      return res.status(500).json({ error: "Internal server error", message: "Service temporarily unavailable" });
    }
    for (const tokenMeta of tokens) {
      // Check that token is not revoked, not expired, and hash matches
      if (!tokenMeta.revokedAt && tokenMeta.hash && await bcrypt.compare(rawToken, tokenMeta.hash).catch(() => false)) {
        // Check expiration: if expiresAt is set and is in the past, reject the token
        if (tokenMeta.expiresAt) {
          const expiryTime = new Date(tokenMeta.expiresAt);
          const now = new Date();
          if (expiryTime <= now) {
            console.warn('[AUTH] Token has expired', { tokenId: tokenMeta.tokenId, expiresAt: tokenMeta.expiresAt });
            continue; // Skip this expired token
          }
        }
        matched = tokenMeta;
        break;
      }
    }
    if (matched) _setCachedToken(rawToken, matched);
  }

  if (!matched) {
    createAuditLog({ requesterId: "unknown", action: "auth_fail", resource: req.path, ip: req.ip });
    try {
      createComplianceAuditLog(
        req.headers['x-workspace-id'] || 'system', null,
        'auth_failed', 'token', null, null,
        req.ip, req.get('user-agent')
      );
    } catch (_) {}
    return res.status(401).json({ error: "Invalid or revoked token" });
  }
  req.tokenMeta = matched;
  req.authType = 'bearer';

  // Populate req.user from the token's owner so endpoints that read req.user?.id work
  // correctly regardless of whether auth came from a session or a Bearer token.
  if (matched.ownerId && matched.ownerId !== 'owner') {
    try {
      const tokenOwner = getUserById(matched.ownerId);
      if (tokenOwner) req.user = tokenOwner;
    } catch (_) {}
  }

  // For Bearer tokens (agents/APIs), enforce device approval.
  // This adds a layer of security: even if a master token is leaked, the attacker
  // still needs to approve the device fingerprint before accessing protected APIs.
  // Exceptions (below) are routes that can't use device approval (OAuth bootstrap,
  // device-management itself, etc.) or that only return non-sensitive metadata.
  // NOTE: Session-authenticated requests are already bypassed by deviceApprovalMiddleware
  // itself, so we only need to skip here for Bearer-token paths that legitimately can't
  // be gated. DO NOT add identity-returning endpoints (/users, /identity) to this list —
  // that was the source of a past security issue where scoped tokens reached user
  // identity data from unapproved devices.
  // Use req.baseUrl to get the full path (req.path is relative to mount point)
  const routePath = req.baseUrl + req.path;
  const skipDeviceApproval = (routePath.startsWith('/api/v1/auth/') && routePath !== '/api/v1/auth/me') ||
                             routePath.startsWith('/api/v1/devices') ||
                             routePath.startsWith('/api/v1/oauth/') ||
                             routePath.startsWith('/api/v1/billing') ||      // workspace plan/usage metadata only
                             routePath.startsWith('/api/v1/dashboard') ||    // dashboard metrics, session-authed in practice
                             routePath.startsWith('/api/v1/agentic/') ||     // Device Flow + ASC bootstrap (have own auth)
                             (routePath.startsWith('/api/v1/activity') && req.method === 'GET');

  if (skipDeviceApproval) {
    return next();
  }

  // Apply device approval only for guest/scoped tokens (external API access)
  return deviceApprovalMiddleware(req, res, next);
}

function adminOnly(req, res, next) {
  // Check if token has admin scope
  const scope = req.tokenMeta?.scope || req.tokenData?.scope || '';
  if (scope !== 'full' && !scope.includes('admin')) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function getOAuthUserId(req) {
  // Check session auth first, then Bearer token auth
  if (req?.session?.user?.id) {
    return String(req.session.user.id);
  }
  if (req?.tokenMeta?.ownerId) {
    return String(req.tokenMeta.ownerId);
  }
  return 'oauth_user';
}

function countConnectedOAuthServices(userId) {
  if (!userId) return 0;
  let count = 0;
  for (const service of OAUTH_SERVICES) {
    try {
      // Use cache to prevent CPU spike from repeated decryption
      let token = getCachedOAuthToken(service, String(userId));
      if (!token) {
        token = getOAuthToken(service, String(userId));
        if (token) {
          setCachedOAuthToken(service, String(userId), token);
        }
      }
      if (token && !token.revoked_at) count += 1;
    } catch {
      // Ignore per-service read/decrypt failures for counting
    }
  }
  return count;
}

// Register notification system routes (after authenticate is defined)
const notificationsRouter = require('./routes/notifications');
const activityRoutes = require('./routes/activity');
const emailRoutes = require('./routes/email');
const workspacesRoutes = require('./routes/workspaces');
const invitationsRoutes = require('./routes/invitations');
const createManagementRoutes = require('./routes/management');

app.use('/api/v1/notifications', authenticate, notificationsRouter);
app.use('/api/v1/activity', authenticate, activityRoutes);
app.use('/api/v1/email', authenticate, emailRoutes);
app.use('/api/v1/workspaces', authenticate, workspacesRoutes);
app.use('/api/v1/invitations', authenticate, invitationsRoutes);

// Waitlist: public POST (email capture), admin-gated list/invite/notify-launch.
const createWaitlistRoutes = require('./routes/waitlist');
app.use('/api/v1/waitlist', createWaitlistRoutes({ isMaster, authenticate }));

// Mount management routes (audit, tokens, etc)
// Note: Management routes require authentication but have their own permission checks
const auditLogService = {
  getRecent: (limit = 1000, offset = 0) => {
    try {
      const stmt = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?');
      return stmt.all(limit, offset) || [];
    } catch (e) {
      console.error('Error fetching audit logs:', e);
      return [];
    }
  }
};

// Create a simple audit/agents endpoint directly (bypass requirePersonal for read-only audit)
app.get('/api/v1/manage/audit/agents', authenticate, (req, res) => {
  try {
    const logs = auditLogService.getRecent(1000, 0);
    const agentMap = {};

    logs.forEach(log => {
      if (!log.request_id) return;

      const userAgent = log.user_agent || '';
      let agentName = 'Unknown';
      let agentType = 'browser';

      if (userAgent.includes('Jarvis')) {
        agentName = 'Jarvis';
        agentType = 'ai';
      } else if (userAgent.includes('OpenClaw')) {
        agentName = 'OpenClaw';
        agentType = 'ai';
      } else if (userAgent.includes('curl') || userAgent.includes('node')) {
        agentName = userAgent.split('/')[0];
        agentType = 'cli';
      } else if (userAgent.includes('Python')) {
        agentName = 'Python';
        agentType = 'script';
      }

      if (!agentMap[agentName]) {
        agentMap[agentName] = {
          agentName,
          agentType,
          accessCount: 0,
          lastAccess: null,
          tokensUsed: [],
          endpointsAccessed: []
        };
      }

      agentMap[agentName].accessCount++;
      agentMap[agentName].lastAccess = log.created_at;

      if (log.resource && !agentMap[agentName].endpointsAccessed.includes(log.resource)) {
        agentMap[agentName].endpointsAccessed.push(log.resource);
      }
    });

    res.json({
      ok: true,
      agents: Object.values(agentMap)
    });
  } catch (error) {
    console.error('Error fetching agent usage:', error);
    res.status(500).json({ error: 'Failed to fetch agent usage' });
  }
});

// Register export data routes
const exportRoutes = require('./routes/export');
const importRoutes = require('./routes/import');
const createVaultInstructionsRoutes = require('./routes/vault-instructions');

// Export dumps entire user state (tokens, personas, skills, KB, OAuth metadata).
// Guard: only master tokens and dashboard sessions may export. Guest/scoped
// tokens never reach this — otherwise a narrow token could exfiltrate the
// full account via the export bundle.
app.use('/api/v1/export', authenticate, (req, res, next) => {
  const meta = req.tokenMeta || {};
  const isSession = String(meta.tokenId || '').startsWith('sess_') || Boolean(req.session?.user);
  const isMasterTok = meta.scope === 'full' || meta.tokenType === 'master';
  if (isSession || isMasterTok) return next();
  return res.status(403).json({ error: 'Export requires a master token or dashboard session' });
}, exportRoutes);
app.use('/api/v1/import', authenticate, importRoutes);
app.use('/api/v1/vault', authenticate, createVaultInstructionsRoutes(db, null, createAuditLog));

// AFP (API File Protocol) — PC filesystem/exec connector
const afpRoutes = require('./routes/afp');

app.use('/api/v1/afp', authenticate, afpRoutes);

// FAL Image Generation API
const falImagesRoutes = require('./routes/fal-images');
app.use('/api/v1/fal', authenticate, falImagesRoutes);

// OAuth Server — MyApi as authorization server for external AI clients (ChatGPT, etc.)
const oauthServerRoutes = require('./routes/oauth-server');
app.use('/api/v1/oauth-server', oauthServerRoutes);

const agenticRoutes = require('./routes/agentic');
app.use('/api/v1/agentic', authenticate, agenticRoutes);

// ─── Public: Agent Auth installer script ──────────────────────────────────────
// Serve the zero-dependency OAuth PKCE installer so agents/users can run:
//   curl -sL https://www.myapiai.com/api/v1/agent-auth/install.js | node
// Path works both locally (src/index.js → ../connectors/) and in container (index.js → connectors/)
const _connectorBase = require('fs').existsSync(require('path').join(__dirname, 'connectors')) ? __dirname : require('path').join(__dirname, '..');
const agentAuthScript = require('path').join(_connectorBase, 'connectors/agent-auth/index.js');
app.get('/api/v1/agent-auth/install.js', (req, res) => {
  const fs = require('fs');
  if (!fs.existsSync(agentAuthScript)) {
    return res.status(404).send('// installer not found');
  }
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(fs.readFileSync(agentAuthScript, 'utf8'));
});

// ─── Public: Agent connection guide ──────────────────────────────────────────
// Fetched by AI agents (via the onboarding starter prompt) to learn about
// MyApi's capabilities and the three connection methods.
app.get('/api/v1/agent-guide', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    api: 'MyApi — Agent Connection Guide',
    version: '1.1',
    base_url: 'https://www.myapiai.com',
    base_url_warning: 'Use https://www.myapiai.com as the base URL — do NOT append /api/v1. All paths in this guide already include /api/v1. Example: correct = https://www.myapiai.com/api/v1/skills, wrong = https://www.myapiai.com/api/v1/api/v1/skills.',

    headline: 'MyApi gives AI agents secure, scoped access to a user\'s identity, memory, documents, tools, and action history.',

    description: 'MyApi is a personal context and control-plane API. It lets AI agents read who the user is, what they know, and what tools they have connected — and act on their behalf across 45+ services. Instead of re-explaining context every conversation, agents query MyApi once and have everything they need. Every action is logged, every token is revocable.',

    mental_model: {
      summary: 'Five distinct layers — understand these before making your first call.',
      layers: {
        identity: 'Who the user is: name, role, bio, timezone, location, preferences. Read from GET /api/v1/users/me. Start here.',
        memory: 'Short, durable facts the user wants every agent to know — recurring context that should survive across sessions. Read/write via GET|POST /api/v1/memory.',
        knowledge_base: 'Long-form documents, SOPs, notes, and files the user has uploaded. Full-text searchable. Read via GET /api/v1/brain/knowledge-base. Distinct from memory: documents are rich and queryable, memory entries are concise key facts.',
        personas: 'Named behavioural overlays — each persona has a SOUL.md personality file and a scoped knowledge base. Agents can adopt a persona to shift tone, role, and context. Read via GET /api/v1/personas.',
        services: 'Connected action surfaces: GitHub, Google, Slack, Discord, Notion, Linear, and 40+ more. Agents can read data and trigger actions through these integrations after the user grants access.',
      },
    },

    concrete_example: 'An agent loads the user\'s identity (timezone, role), activates their "Work" persona, reads the product brief from the knowledge base, checks open GitHub issues, and drafts a Slack update — all traced in the audit log under the agent\'s named token.',

    quickstart: {
      summary: 'Five calls to go from zero to fully oriented. Run these in order after connecting.',
      steps: [
        {
          step: 1,
          label: 'Verify your token works',
          method: 'GET',
          path: '/api/v1/auth/me',
          note: 'Returns your token metadata and scope. If this 401s, your token is wrong or expired.',
        },
        {
          step: 2,
          label: 'Load the user\'s identity',
          method: 'GET',
          path: '/api/v1/users/me',
          note: 'Returns name, role, bio, timezone, location, preferences. Ground all future responses in this data.',
        },
        {
          step: 3,
          label: 'Read persistent memory',
          method: 'GET',
          path: '/api/v1/memory',
          note: 'Short facts the user wants every agent to carry. Check this before asking the user questions they\'ve already answered.',
        },
        {
          step: 4,
          label: 'Browse the knowledge base',
          method: 'GET',
          path: '/api/v1/brain/knowledge-base',
          note: 'Lists uploaded documents and SOPs. Use GET /api/v1/brain/knowledge-base/:id to read a specific document.',
        },
        {
          step: 5,
          label: 'Check available personas',
          method: 'GET',
          path: '/api/v1/personas',
          note: 'Lists named personas with their SOUL.md content. Ask the user which one to activate if multiple exist.',
        },
        {
          step: 6,
          label: 'Discover connected services (optional)',
          method: 'GET',
          path: '/api/v1/services',
          note: 'Lists which external services (GitHub, Google, Slack, etc.) the user has connected. Use this to know which action surfaces are available before attempting service calls.',
        },
        {
          step: 7,
          label: 'List available skills (optional)',
          method: 'GET',
          path: '/api/v1/skills',
          note: 'Lists all skills configured for this account. Each skill has a name, description, and optional script. Requires skills:read scope.',
        },
      ],
    },

    connection_methods: [
      {
        id: 'device_flow',
        name: 'OAuth Device Flow',
        recommended: true,
        summary: 'RFC 8628 browser-approval flow. The agent requests a short user code, the user approves it in the dashboard, and the agent receives its own dedicated scoped token.',
        pros: [
          'Each agent gets its own named token — full per-agent audit trail',
          'User explicitly approves each agent in the browser — no blind trust',
          'Tokens can be scoped to read-only or specific resources',
          'Revoke one agent token without affecting others',
        ],
        cons: [
          'Requires the user to open a browser tab once to approve',
          'Approval window is 15 minutes — agent must poll until approved',
        ],
        best_for: 'Most users. Secure, auditable, and the recommended default.',
        setup: {
          quick_start: 'curl -sL https://www.myapiai.com/api/v1/agent-auth/install.js | node',
          quick_start_note: 'Runs the full device flow automatically and prints a ready-to-use Bearer token.',
          manual_steps: [
            'Step 1 — Request a device code:',
            '  POST /api/v1/agentic/device/authorize',
            '  Body: { "label": "My Claude Agent", "scope": "full" }',
            '  Response: { "device_code": "...", "user_code": "ABCD-1234", "verification_uri_complete": "https://...", "expires_in": 900 }',
            '',
            'Step 2 — Show the user_code to the user and ask them to visit verification_uri_complete.',
            '  Approval page: https://www.myapiai.com/dashboard/activate',
            '',
            'Step 3 — Poll for the token every 5 seconds:',
            '  POST /api/v1/agentic/device/token',
            '  Body: { "device_code": "..." }',
            '  Returns 428 while pending, 400 if denied, 200 with access_token when approved.',
            '',
            'Step 4 — Use the token:',
            '  Authorization: Bearer <access_token>',
          ],
        },
      },
      {
        id: 'master_token',
        name: 'Master Token',
        recommended: false,
        summary: 'A single long-lived bearer token with full API access. Generated automatically when the account was created. Find it in the dashboard under Access Tokens.',
        pros: [
          'Zero setup — token already exists in the dashboard',
          'Full read/write access to all resources',
          'Works immediately with any HTTP client',
        ],
        cons: [
          'One token shared across all agents — no per-agent identity in audit logs',
          'Compromising the token compromises everything',
          'Cannot be scoped to read-only or a subset of resources',
        ],
        best_for: 'Quick local experiments or personal single-agent setups where auditability is not a concern.',
        setup: {
          steps: [
            'Step 1 — Log in at https://www.myapiai.com/dashboard/',
            'Step 2 — Go to Access Tokens — the Master Token is listed at the top.',
            'Step 3 — Copy it and set the header on every request:',
            '  Authorization: Bearer <your_master_token>',
          ],
          dashboard_url: 'https://www.myapiai.com/dashboard/access-tokens',
        },
      },
      {
        id: 'asc_keypair',
        name: 'ASC — Agentic Secure Connection (Ed25519 Keypair)',
        recommended: false,
        summary: 'Cryptographic keypair auth. The agent generates an Ed25519 keypair, registers the public key once with user approval, then signs every request. The private key never leaves the agent.',
        pros: [
          'Private key is never transmitted — strongest security posture',
          'Every request is individually signed — cryptographic non-repudiation',
          'Replay protection via timestamp window (±60 seconds)',
          'Revoke a single key without affecting other agents',
        ],
        cons: [
          'Agent must implement Ed25519 request signing',
          'Initial key registration requires one-time user approval in the dashboard',
          'Requires accurate system clock (±60 seconds)',
        ],
        best_for: 'Production agents or automated pipelines where cryptographic proof of origin is required.',
        setup: {
          steps: [
            'Step 1 — Generate an Ed25519 keypair (save the private key securely):',
            '  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");',
            '  const pubKeyB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");',
            '',
            'Step 2 — Register the public key:',
            '  POST /api/v1/agentic/asc/register',
            '  Body: { "public_key": "<pubKeyB64>", "label": "My Agent" }',
            '  Response: { "status": "pending_approval", "key_fingerprint": "..." }',
            '',
            'Step 3 — User approves the fingerprint at:',
            '  https://www.myapiai.com/dashboard/devices',
            '',
            'Step 4 — Sign every API request with three headers:',
            '  X-Agent-PublicKey: <pubKeyB64>',
            '  X-Agent-Timestamp: <unix_seconds>',
            '  X-Agent-Signature: base64( Ed25519Sign(privateKey, "<timestamp>:<token_id>") )',
            '',
            'Step 5 — Server verifies the signature and timestamp freshness. Request proceeds if both pass.',
          ],
        },
      },
    ],

    api_reference: 'https://www.myapiai.com/dashboard/docs',
    support: 'https://www.myapiai.com/dashboard/',
  });
});

const createGoogleRoutes = require('./routes/google');
app.use('/api/v1/google', createGoogleRoutes());

// --- PUBLIC: RUNTIME CONFIG (no auth required) ---
// Landing page + signup flows read this to decide whether to render the
// "Now in Beta" chrome and whether to swap signup for the waitlist form.
// Cache 30s so a BETA flag flip propagates within half a minute.
app.get('/api/v1/config/public', (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=30');
    return res.json({ data: betaMode.getBetaStatus() });
  } catch (err) {
    console.error('[Config] public config error:', err);
    return res.json({ data: { beta: true, betaFull: false, betaMaxUsers: 50 } });
  }
});

// --- PUBLIC: BILLING PLANS ENDPOINT (no auth required) ---
app.get('/api/v1/billing/plans', (req, res) => {
  try {
    // Try to get plans from database first
    const stmt = db.prepare(`
      SELECT id, name, price_cents, description, features,
             monthly_api_call_limit, max_services, max_team_members,
             max_skills_per_persona, stripe_product_id, active
      FROM pricing_plans
      WHERE active = 1
      ORDER BY display_order ASC
    `);
    const dbPlans = stmt.all();

    const betaActive = betaMode.isBetaMode();
    const annotate = (plan) => ({
      ...plan,
      beta_locked: betaActive && String(plan.id).toLowerCase() !== 'free',
    });

    if (dbPlans && dbPlans.length > 0) {
      // Transform database plans to frontend format
      const plans = dbPlans.map(plan => annotate({
        id: plan.id,
        name: plan.name,
        price_cents: plan.price_cents,
        priceMonthly: Math.floor(plan.price_cents / 100), // For backwards compat
        description: plan.description,
        features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features,
        monthlyApiCallLimit: plan.monthly_api_call_limit,
        maxServices: plan.max_services,
        maxTeamMembers: plan.max_team_members,
        maxSkillsPerPersona: plan.max_skills_per_persona,
        stripe_product_id: plan.stripe_product_id
      }));
      return res.json({ data: plans });
    }

    // Fallback to hardcoded plans if database is empty
    const plans = Object.values(BILLING_PLANS).map(plan => annotate({
      id: plan.id,
      name: plan.name,
      price_cents: plan.price_cents,
      priceMonthly: plan.priceMonthly,
      description: plan.description,
      features: plan.features,
      monthlyApiCallLimit: plan.monthlyApiCallLimit,
      maxServices: plan.maxServices,
      maxTeamMembers: plan.maxTeamMembers,
      maxSkillsPerPersona: plan.maxSkillsPerPersona,
      stripe_product_id: plan.stripe_product_id
    }));
    res.json({ data: plans });
  } catch (err) {
    console.error('[Billing] Error fetching plans:', err);
    // Return hardcoded plans as fallback
    const betaActive = betaMode.isBetaMode();
    const plans = Object.values(BILLING_PLANS).map(plan => ({
      id: plan.id,
      name: plan.name,
      price_cents: plan.price_cents,
      priceMonthly: plan.priceMonthly,
      description: plan.description,
      features: plan.features,
      monthlyApiCallLimit: plan.monthlyApiCallLimit,
      maxServices: plan.maxServices,
      maxTeamMembers: plan.maxTeamMembers,
      maxSkillsPerPersona: plan.maxSkillsPerPersona,
      stripe_product_id: plan.stripe_product_id,
      beta_locked: betaActive && String(plan.id).toLowerCase() !== 'free',
    }));
    res.json({ data: plans });
  }
});

// Import multi-tenancy middleware
const { extractWorkspaceContext, enforceMultiTenancy, switchWorkspaceHandler } = require('./middleware/multitenancy');
const { createAuditSecurityRouter } = require('./routes/auditSecurity');

// Extract workspace context for all authenticated requests
app.use('/api/v1', authenticate, extractWorkspaceContext, enforceMultiTenancy);

// Workspace-scoped API logging for sensitive actions
app.use('/api/v1', (req, res, next) => {
  const p = req.path || '';
  const sensitive = p.startsWith('/tokens') || p.startsWith('/security/') || p.startsWith('/audit/') || p.startsWith('/auth/') || p.startsWith('/workspaces') || p.startsWith('/workspace-switch');
  if (!sensitive || !req.tokenMeta || req.method === 'OPTIONS') return next();

  const startedAt = Date.now();
  res.on('finish', () => {
    try {
      createAuditLog({
        requesterId: req.tokenMeta?.tokenId || null,
        workspaceId: req.workspaceId || null,
        actorId: req.user?.id || req.tokenMeta?.ownerId || null,
        actorType: req.authType === 'session' ? 'user' : 'token',
        action: `${req.method}_${p.replace(/^\//, '').replace(/\//g, '_')}`,
        resource: p,
        endpoint: p,
        httpMethod: req.method,
        statusCode: res.statusCode,
        scope: req.tokenMeta?.scope || null,
        ip: req.ip,
        details: { durationMs: Date.now() - startedAt, workspaceId: req.workspaceId || null }
      });
    } catch (_) {}
  });
  return next();
});

// Workspace switching endpoint
app.post('/api/v1/workspace-switch/:workspaceId', authenticate, switchWorkspaceHandler);

// Phase 3: audit/security API
app.use('/api/v1', authenticate, createAuditSecurityRouter({ sessionDb, sessionStore }));

function getRequestOwnerId(req) {
  const id = req?.tokenMeta?.ownerId || req?.session?.user?.id;
  if (!id) console.warn('[auth] getRequestOwnerId: no user context, falling back to owner');
  return String(id || 'owner');
}

function inferMemorySource(req) {
  const label = (req?.tokenMeta?.label || '').toLowerCase();
  if (!label || isMaster(req) && !label) return 'user';
  if (label.includes('chatgpt') || label.includes('openai') || label.includes('gpt')) return 'chatgpt';
  if (label.includes('claude') || label.includes('anthropic')) return 'claude';
  if (label.includes('jarvis')) return 'jarvis';
  if (label.includes('gemini') || label.includes('google ai')) return 'gemini';
  if (label.includes('copilot') || label.includes('github')) return 'github copilot';
  if (isMaster(req)) return 'user';
  return label || 'api';
}

function getRequestWorkspaceId(req) {
  if (req?.workspaceId) return req.workspaceId;
  if (req?.session?.currentWorkspace) return req.session.currentWorkspace;
  const explicit = req?.body?.workspace_id || req?.query?.workspace || req?.headers?.['x-workspace-id'];
  if (explicit) return String(explicit);

  const userId = req?.user?.id || req?.session?.user?.id;
  if (userId) {
    const workspaces = getWorkspaces(String(userId));
    if (workspaces?.length) return workspaces[0].id;
  }
  return null;
}

function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripeClient() {
  if (!isStripeConfigured()) return null;
  try {
    const Stripe = require('stripe');
    return new Stripe(process.env.STRIPE_SECRET_KEY);
  } catch {
    return null;
  }
}

function trackWorkspaceUsage(req, delta = {}) {
  const workspaceId = getRequestWorkspaceId(req);
  if (!workspaceId) return;
  const today = new Date().toISOString().slice(0, 10);
  incrementUsageDaily(workspaceId, today, delta);
}

function getOwnerEmailFromUserDoc() {
  try {
    if (!fs.existsSync(USER_MD_PATH)) return '';
    const raw = fs.readFileSync(USER_MD_PATH, 'utf8');
    const line = raw.split('\n').find((l) => /\*\*\s*Email\s*\*\*/i.test(l));
    if (!line) return '';
    const m = line.match(/\*\*\s*Email\s*\*\*\s*:\s*(.+)$/i);
    return String(m?.[1] || '').trim().toLowerCase();
  } catch (_) {
    return '';
  }
}

function isOwnerUser(userId) {
  if (!userId) return false;
  if (userId === 'owner') return true;
  try {
    const ownerEmail = String(
      process.env.POWER_USER_EMAIL || process.env.OWNER_EMAIL || getOwnerEmailFromUserDoc() || ''
    ).trim().toLowerCase();
    if (!ownerEmail) return false;
    const user = getUserById(userId);
    return String(user?.email || '').toLowerCase() === ownerEmail;
  } catch (_) { return false; }
}

function requirePowerUser(req, res) {
  const configuredEmail = String(process.env.POWER_USER_EMAIL || process.env.OWNER_EMAIL || getOwnerEmailFromUserDoc() || '').trim().toLowerCase();
  if (!configuredEmail) {
    res.status(503).json({ error: 'Power-user access is not configured (set POWER_USER_EMAIL/OWNER_EMAIL or USER.md email)' });
    return false;
  }

  let email = String(req?.session?.user?.email || req?.user?.email || '').toLowerCase();
  if (!email && req?.tokenMeta?.ownerId) {
    const tokenOwnerUser = getUserById(req.tokenMeta.ownerId);
    email = String(tokenOwnerUser?.email || '').toLowerCase();
  }
  if (!email || email !== configuredEmail) {
    res.status(403).json({ error: 'Only power user can access user management' });
    return false;
  }
  return true;
}

function revokeExistingMasterTokens(ownerId) {
  const now = new Date().toISOString();
  db.prepare("UPDATE access_tokens SET revoked_at = ? WHERE owner_id = ? AND scope = 'full' AND revoked_at IS NULL").run(now, ownerId);
  // Also revoke bootstrap tokens created with the hardcoded 'owner' ownerId,
  // so stale bootstrap tokens don't linger after a real user regenerates their master token.
  if (ownerId !== 'owner') {
    db.prepare("UPDATE access_tokens SET revoked_at = ? WHERE owner_id = 'owner' AND scope = 'full' AND revoked_at IS NULL").run(now);
  }
}

function pruneRedundantMasterTokens(ownerId, keep = 3) {
  try {
    const tokens = (getAccessTokens(ownerId) || [])
      .filter(t => t.scope === 'full' && !t.revokedAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (tokens.length <= keep) return { pruned: 0, kept: tokens.length };

    const toRevoke = tokens.slice(keep);
    for (const t of toRevoke) {
      revokeAccessToken(t.tokenId);
    }
    return { pruned: toRevoke.length, kept: keep };
  } catch (e) {
    console.error('pruneRedundantMasterTokens error:', e.message);
    return { pruned: 0, kept: 0, error: true };
  }
}

// --- Scope helpers ---

// Returns true for master tokens and session (dashboard) users — full access.
function isMaster(req) {
  return req.tokenMeta?.scope === 'full' ||
    req.tokenMeta?.tokenType === 'master' ||
    String(req.tokenMeta?.tokenId || '').startsWith('sess_');
}

// Returns true if the request's token carries `scope` (or is a master token).
// Checks the access_token_scopes table for guest tokens.
function hasScope(req, scope) {
  if (isMaster(req)) return true;
  const tokenScopes = getTokenScopes(req.tokenMeta?.tokenId || '');
  return tokenScopes.includes('admin:*') || tokenScopes.includes(scope);
}

// Returns the persona_id from scope_bundle for non-master bundle tokens, or null.
function getBundlePersonaId(req) {
  if (isMaster(req)) return null;
  const bundle = req.tokenMeta?.scopeBundle;
  if (!bundle) return null;
  try {
    const parsed = typeof bundle === 'string' ? JSON.parse(bundle) : bundle;
    return parsed?.persona_id ? Number(parsed.persona_id) : null;
  } catch { return null; }
}

// --- Scope Filter (identity data) ---
function filterByScope(data, scope) {
  if (scope === "full" || !scope) return data;
  const scopeFields = {
    "basic":        ["name", "role", "company"],
    "professional": ["name", "role", "company", "skills", "education", "experience"],
    "availability": ["availability", "timezone", "calendar"],
    // legacy aliases
    "read":         ["name", "role", "company"],
  };
  const allowed = scopeFields[scope] || scopeFields["basic"];
  const filtered = {};
  for (const key of allowed) {
    if (data[key] !== undefined) filtered[key] = data[key];
  }
  return filtered;
}

// --- Parse USER.md ---
function parseUserMd(raw) {
  const result = {};
  const lines = raw.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*[-*]\s*\*\*(.+?)\*\*[:\s]*(.+)/);
    if (match) {
      const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
      result[key] = match[2].trim();
    }
  }
  return result;
}

function syncActivePersonaToSoulFile() {
  const activePersona = getActivePersona();
  if (!activePersona || !activePersona.soul_content) return;
  fs.writeFileSync(SOUL_MD_PATH, activePersona.soul_content.endsWith('\n') ? activePersona.soul_content : `${activePersona.soul_content}\n`);
}

// --- Bootstrap ---
function bootstrap() {
  const existingTokens = getAccessTokens();
  const masterExists = existingTokens.some(t => t.scope === 'full' && !t.revokedAt);
  let rawMaster;
  if (!masterExists) {
    rawMaster = 'myapi_' + crypto.randomBytes(32).toString("hex");
    const hash = bcrypt.hashSync(rawMaster, 10);
    createAccessToken(hash, "owner", "full", "Master Token", null, null, null, rawMaster, 'master');
    console.log("=== MyApi Platform Started ===");
    console.log("Master token created for bootstrap (hidden in logs for security)");
  } else {
    // Try to retrieve the existing master token so it stays constant across restarts
    const existing = getExistingMasterToken('owner');
    if (existing) {
      rawMaster = existing.rawToken;
      console.log("=== MyApi Platform Started ===");
      console.log("Master token already exists (retrieved from database)");
    } else {
      console.log("=== MyApi Platform Started ===");
      console.log("Master token already exists (encrypted token not available for retrieval)");
    }
  }

  // Initialize Personas: Create default persona from SOUL.md if none exist
  const existingPersonas = getPersonas();
  if (existingPersonas.length === 0) {
    let defaultSoulContent = `# SOUL.md - Default Persona\n\nDefault personality and values.\n`;
    if (fs.existsSync(SOUL_MD_PATH)) {
      defaultSoulContent = fs.readFileSync(SOUL_MD_PATH, "utf8");
    }
    const defaultPersona = createPersona("Default", defaultSoulContent, "Default persona from SOUL.md");
    setActivePersona(defaultPersona.id);
    syncActivePersonaToSoulFile();
    console.log(`✓ Created default persona (id: ${defaultPersona.id})`);
  } else {
    syncActivePersonaToSoulFile();
  }

  // Load identity from USER.md
  if (fs.existsSync(USER_MD_PATH)) {
    vault.identityDocs["owner"] = parseUserMd(fs.readFileSync(USER_MD_PATH, "utf-8"));
  } else {
    vault.identityDocs["owner"] = { name: "User", role: "Unknown" };
  }

  console.log(`Port: ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard/`);
  console.log(`API: http://localhost:${PORT}/api/v1/`);
  console.log("==============================");
  return rawMaster;
}

// ============================
// ROUTES
// ============================

// Health check helper
function buildHealthResponse() {
  const dbHealth = checkDatabaseHealth();
  return {
    status: dbHealth.healthy ? "ok" : "degraded",
    statusCode: dbHealth.healthy ? 200 : 503,
    database: dbHealth,
  };
}

// Health
app.get("/health", (req, res) => {
  const health = buildHealthResponse();
  res.status(health.statusCode).json({ status: health.status, uptime: process.uptime(), database: health.database });
});

function parseAndValidateHttpUrl(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    let normalized = String(value).trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `https://${normalized}`;
    }
    const u = new URL(normalized);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

function normalizeSecretToken(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function parseFlexibleBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
  }
  return false;
}

function getEffectiveScopes(req) {
  if (isMaster(req)) return ['admin:*'];
  return getTokenScopes(req.tokenMeta?.tokenId || '');
}

function buildCapabilitiesForRequest(req) {
  const scopes = getEffectiveScopes(req);
  const allowedPersonas = req.tokenMeta?.allowedPersonas || null;
  const canReadBrain = hasPermission(scopes, ['knowledge']) || hasPermission(scopes, ['chat']) || hasPermission(scopes, ['admin:*']);
  const canReadVault = hasPermission(scopes, ['admin:*']);

  const auth = {
    style: req.authType === 'session' ? 'session-cookie' : 'bearer-token',
    requiredHeaders: req.authType === 'session'
      ? ['Cookie: connect.sid=<session>']
      : ['Authorization: Bearer <token>'],
  };

  const endpoints = [
    {
      purpose: 'Health check',
      method: 'GET',
      url: '/health',
      params: [],
      sampleRequest: { method: 'GET', headers: {} },
      sampleResponse: { status: 'ok', uptime: 123.45 },
      commonErrors: [],
    },
    {
      purpose: 'List API capabilities visible to current caller',
      method: 'GET',
      url: '/api/v1/capabilities',
      params: [],
      sampleRequest: { method: 'GET', headers: auth.requiredHeaders },
      sampleResponse: { auth, scopes, endpoints: ['...'] },
      commonErrors: [{ status: 401, error: 'Missing session or Authorization: Bearer token' }],
    },
    {
      purpose: 'Upload text knowledge document (.txt/.md/.pdf)',
      method: 'POST',
      url: '/api/v1/brain/knowledge-base/upload',
      params: [
        { in: 'formData', name: 'file|document|upload|kbFile', required: true, type: 'binary' },
      ],
      sampleRequest: {
        method: 'POST',
        headers: [...auth.requiredHeaders],
        body: 'multipart/form-data with file field',
      },
      sampleResponse: { ok: true, documentsCreated: 3 },
      commonErrors: [
        { status: 400, error: 'Unsupported file type. Supported: .txt, .md, .pdf' },
        { status: 400, error: 'Failed to parse PDF. Please upload a text-based PDF or convert it to .txt/.md.' },
      ],
    },
  ];

  const canMemory = isMaster(req) || hasPermission(scopes, ['memory']) || hasPermission(scopes, ['admin:*']);
  const canKnowledge = hasPermission(scopes, ['knowledge']) || hasPermission(scopes, ['admin:*']);

  if (canMemory) {
    endpoints.push({
      purpose: 'List all memory entries — call this first to recall what you already know',
      method: 'GET',
      url: '/api/v1/memory',
      params: [],
      sampleRequest: { method: 'GET', headers: [...auth.requiredHeaders] },
      sampleResponse: { data: [{ id: 'mem_x', content: 'User prefers dark mode', created_at: '...' }] },
      commonErrors: [],
    });
    endpoints.push({
      purpose: 'Save a memory — use for short facts, notes, preferences. One fact per entry. NOT for documents.',
      method: 'POST',
      url: '/api/v1/memory',
      params: [{ in: 'body', name: 'content', required: true, type: 'string', description: 'A short fact or note, e.g. "User prefers TypeScript"' }],
      sampleRequest: { method: 'POST', headers: [...auth.requiredHeaders, 'Content-Type: application/json'], body: { content: 'User prefers dark mode' } },
      sampleResponse: { data: { id: 'mem_x', content: 'User prefers dark mode' } },
      commonErrors: [{ status: 400, error: 'content is required' }],
    });
    endpoints.push({
      purpose: 'Update a memory entry by ID',
      method: 'PATCH',
      url: '/api/v1/memory/:id',
      params: [{ in: 'body', name: 'content', required: true, type: 'string' }],
      sampleRequest: { method: 'PATCH', headers: [...auth.requiredHeaders, 'Content-Type: application/json'], body: { content: 'Updated fact' } },
      sampleResponse: { data: { id: 'mem_x', content: 'Updated fact' } },
      commonErrors: [{ status: 404, error: 'Memory not found' }],
    });
    endpoints.push({
      purpose: 'Delete a memory entry by ID',
      method: 'DELETE',
      url: '/api/v1/memory/:id',
      params: [],
      sampleRequest: { method: 'DELETE', headers: [...auth.requiredHeaders] },
      sampleResponse: { success: true },
      commonErrors: [{ status: 404, error: 'Memory not found' }],
    });
  }

  if (canKnowledge) {
    endpoints.push({
      purpose: 'List knowledge base documents — for named documents and files, NOT short facts',
      method: 'GET',
      url: '/api/v1/brain/knowledge-base',
      params: [],
      sampleRequest: { method: 'GET', headers: [...auth.requiredHeaders] },
      sampleResponse: { data: [{ id: 'kbdoc_x', title: 'Resume', source: 'agent' }] },
      commonErrors: [],
    });
    endpoints.push({
      purpose: 'Create or update a knowledge base document by title (upsert) — use for named documents, NOT short memories',
      method: 'POST',
      url: '/api/v1/brain/knowledge-base/upsert',
      params: [
        { in: 'body', name: 'title', required: true, type: 'string', description: 'Document title, used as unique key' },
        { in: 'body', name: 'content', required: true, type: 'string', description: 'Full document text' },
        { in: 'body', name: 'source', required: false, type: 'string', description: 'Source label, e.g. "agent"' },
      ],
      sampleRequest: { method: 'POST', headers: [...auth.requiredHeaders, 'Content-Type: application/json'], body: { title: 'My Document', content: '# Content here', source: 'agent' } },
      sampleResponse: { ok: true, action: 'created', document: { id: 'kbdoc_x', title: 'My Document' } },
      commonErrors: [{ status: 400, error: 'title and content are required' }],
    });
    endpoints.push({
      purpose: 'Get full content of a knowledge base document by ID',
      method: 'GET',
      url: '/api/v1/brain/knowledge-base/:id',
      params: [],
      sampleRequest: { method: 'GET', headers: [...auth.requiredHeaders] },
      sampleResponse: { data: { id: 'kbdoc_x', title: 'My Document', content: '...' } },
      commonErrors: [{ status: 404, error: 'Document not found' }],
    });
  }

  if (canReadVault) {
    endpoints.push({
      purpose: 'Store API token with website URL and optional AI discovery',
      method: 'POST',
      url: '/api/v1/vault/tokens',
      params: [
        { in: 'body', name: 'name', required: true, type: 'string' },
        { in: 'body', name: 'service', required: true, type: 'string' },
        { in: 'body', name: 'token', required: true, type: 'string' },
        { in: 'body', name: 'websiteUrl', required: true, type: 'url' },
        { in: 'body', name: 'discoverApi', required: false, type: 'boolean' },
      ],
      sampleRequest: { method: 'POST', headers: [...auth.requiredHeaders, 'Content-Type: application/json'] },
      sampleResponse: { data: { id: 'vt_x', discoveredApiUrl: 'https://api.example.com/v1', discoveredAuthScheme: 'Bearer' } },
      commonErrors: [{ status: 400, error: 'websiteUrl must be a valid http(s) URL' }],
    });
  }

  const canReadSkills = isMaster(req) || hasPermission(scopes, ['skills:read']) || hasPermission(scopes, ['skills:write']) || hasPermission(scopes, ['admin:*']);
  const canWriteSkills = isMaster(req) || hasPermission(scopes, ['skills:write']) || hasPermission(scopes, ['admin:*']);

  if (canReadSkills) {
    endpoints.push({
      purpose: 'List all skills for this account',
      method: 'GET',
      url: '/api/v1/skills',
      params: [{ in: 'query', name: 'include_archived', required: false, type: 'boolean' }],
      sampleRequest: { method: 'GET', headers: [...auth.requiredHeaders] },
      sampleResponse: { skills: [{ id: 'skill_x', name: 'My Skill', description: '...', active: true }] },
      commonErrors: [{ status: 403, error: "Requires 'skills:read' scope" }],
    });
    endpoints.push({
      purpose: 'Get details of a specific skill',
      method: 'GET',
      url: '/api/v1/skills/:id',
      params: [],
      sampleRequest: { method: 'GET', headers: [...auth.requiredHeaders] },
      sampleResponse: { skill: { id: 'skill_x', name: 'My Skill', description: '...' } },
      commonErrors: [{ status: 404, error: 'Skill not found' }],
    });
  }

  if (canWriteSkills) {
    endpoints.push({
      purpose: 'Create a new skill',
      method: 'POST',
      url: '/api/v1/skills',
      params: [
        { in: 'body', name: 'name', required: true, type: 'string' },
        { in: 'body', name: 'description', required: false, type: 'string' },
        { in: 'body', name: 'script_content', required: false, type: 'string' },
        { in: 'body', name: 'category', required: false, type: 'string' },
      ],
      sampleRequest: { method: 'POST', headers: [...auth.requiredHeaders, 'Content-Type: application/json'], body: { name: 'My Skill', description: 'Does something useful' } },
      sampleResponse: { skill: { id: 'skill_x', name: 'My Skill' } },
      commonErrors: [{ status: 400, error: 'Name is required' }],
    });
    endpoints.push({
      purpose: 'Update an existing skill',
      method: 'PUT',
      url: '/api/v1/skills/:id',
      params: [{ in: 'body', name: 'name', required: false, type: 'string' }, { in: 'body', name: 'description', required: false, type: 'string' }],
      sampleRequest: { method: 'PUT', headers: [...auth.requiredHeaders, 'Content-Type: application/json'], body: { description: 'Updated description' } },
      sampleResponse: { skill: { id: 'skill_x', name: 'My Skill', description: 'Updated description' } },
      commonErrors: [{ status: 404, error: 'Skill not found' }],
    });
    endpoints.push({
      purpose: 'Delete a skill',
      method: 'DELETE',
      url: '/api/v1/skills/:id',
      params: [],
      sampleRequest: { method: 'DELETE', headers: [...auth.requiredHeaders] },
      sampleResponse: { success: true },
      commonErrors: [{ status: 404, error: 'Skill not found' }],
    });
  }

  const filtered = endpoints.filter((e) => {
    if (e.url.startsWith('/api/v1/brain') && !canReadBrain) return false;
    if (e.url.startsWith('/api/v1/vault') && !canReadVault) return false;
    return true;
  });

  return {
    auth,
    scopes,
    allowedPersonas,
    endpoints: filtered,
    tryFlow: [
      '1) Call GET /api/v1/capabilities to inspect available endpoints for this token/session.',
      '2) Call GET /api/v1/memory to recall previously stored facts before responding.',
      '3) Use POST /api/v1/memory to save short facts, notes, or preferences (one fact per entry).',
      '4) Use POST /api/v1/brain/knowledge-base/upsert to save named documents or long-form content.',
      '5) GET /api/v1/tokens/me/capabilities to confirm scope-filtered access.',
    ],
    aiGuide: {
      critical: 'MEMORY and KNOWLEDGE BASE are two different systems. Always use the correct one.',
      memory: {
        endpoint: 'POST /api/v1/memory',
        useFor: 'Short facts, notes, preferences, observations. One fact per entry.',
        examples: ['User prefers dark mode', 'User is building a SaaS product', "User's dog is named Max"],
        doNot: 'Do NOT store documents, files, or long content here.',
      },
      knowledgeBase: {
        endpoint: 'POST /api/v1/brain/knowledge-base/upsert',
        useFor: 'Named documents, files, long-form content with a title.',
        examples: ['Resume', 'Project brief', 'Meeting notes for April 2026'],
        doNot: 'Do NOT store short facts or memory notes here.',
      },
      decisionRule: 'User says "remember this / note that / save this fact" → POST /api/v1/memory. User says "save this document / upload this file / store this content" → POST /api/v1/brain/knowledge-base/upsert.',
    },
  };
}

// SSRF: block requests to private/loopback/link-local addresses
const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^100\.64\./,
  /^::1$/,
  /^fc00:/i,
  /^fd/i,
  /^fe80:/i,
  /^localhost$/i,
];
function isPrivateHost(hostname) {
  return PRIVATE_RANGES.some(r => r.test(hostname));
}

async function discoverApiFromWebsite(websiteUrl) {
  const normalizedWebsiteUrl = parseAndValidateHttpUrl(websiteUrl);
  if (!normalizedWebsiteUrl) {
    return {
      sourceWebsiteUrl: websiteUrl,
      apiBaseUrl: null,
      authScheme: 'unknown',
      confidence: 0,
      notes: 'invalid website URL'
    };
  }

  const urlObj = new URL(normalizedWebsiteUrl);
  if (isPrivateHost(urlObj.hostname)) {
    return {
      sourceWebsiteUrl: websiteUrl,
      apiBaseUrl: null,
      authScheme: 'unknown',
      confidence: 0,
      notes: 'blocked: private address'
    };
  }
  const origin = urlObj.origin;

  // Heuristic: If hostname starts with www., guess api.domain.com
  let guessedApiOrigin = `${origin}/api`;
  if (urlObj.hostname.startsWith('www.')) {
    guessedApiOrigin = `${urlObj.protocol}//api.${urlObj.hostname.slice(4)}`;
  } else {
    guessedApiOrigin = `${urlObj.protocol}//api.${urlObj.hostname}`;
  }

  const fallback = {
    sourceWebsiteUrl: normalizedWebsiteUrl,
    apiBaseUrl: guessedApiOrigin,
    authScheme: 'unknown',
    confidence: 0.35,
    notes: 'fallback heuristic used (OpenAI key not configured)',
  };

  const probeCandidates = [
    `${origin}/openapi.json`,
    `${origin}/swagger.json`,
    `${origin}/.well-known/openapi.json`,
    `${origin}/api/openapi.json`,
    `${origin}/api/v1/openapi.json`,
    `${guessedApiOrigin}/openapi.json`,
    `${guessedApiOrigin}/api/v1/openapi.json`
  ];

  for (const candidate of probeCandidates) {
    try {
      if (isPrivateHost(new URL(candidate).hostname)) continue;
      const probeResp = await fetch(candidate, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
      if (!probeResp.ok) continue;
      const body = await probeResp.json();
      if (body?.openapi || body?.swagger || body?.paths) {
        const basePath = body?.servers?.[0]?.url ? parseAndValidateHttpUrl(body.servers[0].url) : null;
        return {
          sourceWebsiteUrl: normalizedWebsiteUrl,
          apiBaseUrl: basePath || fallback.apiBaseUrl,
          authScheme: 'unknown',
          confidence: 0.8,
          notes: `discovered from ${candidate}`,
          raw: { source: 'probe', candidate },
        };
      }
    } catch {
      // best-effort probe
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const attempts = [5000, 8000];
  let lastError = null;

  for (const timeoutMs of attempts) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Return strict JSON only: {"apiBaseUrl": string|null, "authScheme": "Bearer"|"Basic"|"ApiKey"|"OAuth2"|"unknown", "confidence": number, "notes": string}. Never include secrets.' },
            { role: 'user', content: `Website URL: ${normalizedWebsiteUrl}. Infer likely public API base URL and auth scheme.` }
          ]
        })
      });

      if (!resp.ok) {
        lastError = `upstream_status_${resp.status}`;
        continue;
      }

      const data = await resp.json();
      const raw = data?.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      const parsedUrl = parseAndValidateHttpUrl(parsed.apiBaseUrl || '') || fallback.apiBaseUrl;
      return {
        sourceWebsiteUrl: normalizedWebsiteUrl,
        apiBaseUrl: parsedUrl,
        authScheme: ['Bearer', 'Basic', 'ApiKey', 'OAuth2', 'unknown'].includes(parsed.authScheme) ? parsed.authScheme : 'unknown',
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : fallback.confidence,
        notes: String(parsed.notes || 'AI-assisted discovery'),
        raw: parsed,
      };
    } catch (err) {
      lastError = err?.name || 'request_error';
    }
  }

  return {
    ...fallback,
    notes: `fallback heuristic used after discovery retries (${lastError || 'unknown_error'})`,
  };
}

app.get('/api/v1/capabilities', authenticate, (req, res) => {
  const capabilities = buildCapabilitiesForRequest(req);
  res.json({
    ...capabilities,
    examples: {
      checkCapabilities: {
        method: 'GET',
        url: '/api/v1/capabilities',
      },
      uploadKnowledgeBase: {
        method: 'POST',
        url: '/api/v1/brain/knowledge-base/upload',
        contentType: 'multipart/form-data',
        oneOfFields: ['file', 'document', 'upload', 'kbFile'],
      }
    }
  });
});

app.get('/api/v1/tokens/me/capabilities', authenticate, (req, res) => {
  const capabilities = buildCapabilitiesForRequest(req);
  res.json({
    token: {
      tokenId: req.tokenMeta?.tokenId,
      scope: req.tokenMeta?.scope,
      authType: req.authType || 'bearer',
      allowedPersonas: req.tokenMeta?.allowedPersonas || null,
    },
    capabilities,
  });
});

// --- AI Discovery: every common path an AI might try ---

const discoveryRedirect = (req, res) => res.redirect('/openapi.json');
const discoveryJson = (req, res) => {
  const host = req.headers.host || 'www.myapiai.com';
  res.json({
    name: 'MyApi',
    version: '0.1.0',
    description: 'Personal API platform. Authenticate with Bearer token.',
    openapi_spec: `https://${host}/openapi.json`,
    quick_start: `https://${host}/api/v1/quick-start`,
    api_root: `https://${host}/api/v1/`,
    authentication: 'Authorization: Bearer <your-token>',
  });
};

// OpenAPI spec at every path AIs look for
// SECURITY: These endpoints are intentionally public for AI agent bootstrap and API discovery.
// The spec reveals endpoint structure but not secrets. All mutating operations (POST/PUT/DELETE)
// require Bearer token authentication, so exposure of the schema is acceptable.
['/openapi.yaml', '/swagger.json', '/swagger.yaml',
 '/api/openapi.json', '/api/openapi.yaml', '/api/swagger.json',
 '/api/v1/openapi.json', '/api/v1/openapi.yaml',
 '/api/docs/openapi.json', '/api/docs/swagger.json',
 '/.well-known/openapi'
].forEach(p => app.get(p, discoveryRedirect));

// Docs/Swagger UI pages → return JSON discovery instead of 404
['/docs', '/api-docs', '/swagger', '/swagger-ui', '/api/swagger', '/api/docs', '/api/api-docs',
 '/v1', '/api', '/v1/docs', '/api/v1/docs', '/developer',
].forEach(p => app.get(p, discoveryJson));

// llms.txt - AI agent instructions (human approval required)
app.get('/llms.txt', (req, res) => {
  const host = req.headers.host || 'www.myapiai.com';
  res.type('text/plain').send(
`# MyApi — AI Agent Instructions

> IMPORTANT: You MUST ask the human user for explicit approval before performing ANY action.
> Describe what you intend to do and wait for the user to confirm before proceeding.
> Never call endpoints, reveal tokens, or execute services without the user saying "yes".
> This rule applies to every single request — no exceptions.

## About
MyApi is a personal API platform. It gives you access to the owner's knowledge base,
connected services, vault tokens, personas, and identity — but only with their permission.

## Canonical Base URL
Always use: https://${host}
⚠️ IMPORTANT: Do NOT append /api/v1 to this base URL.
   All endpoint paths listed below already include /api/v1.
   Correct: https://${host}/api/v1/skills
   Wrong:   https://${host}/api/v1/api/v1/skills  ← double-prefix bug
Do NOT follow HTTP redirects — redirects from the bare domain strip the Authorization header
and will cause all authenticated requests to fail with "Invalid or revoked token".

## Authentication
- Use the Authorization header: Bearer <token>
- Or the query parameter: ?token=<token>

## If Your Token Is Missing or Rejected — Handshake Flow
No username or extra info needed. Just two steps:

1. POST https://${host}/api/v1/handshakes  (no auth required)
   Body: { "agentId": "<your-unique-id>", "requestedScopes": ["read"], "message": "<who you are>" }
   Allowed scopes: read, professional, availability
   → You receive a handshakeId.

2. Poll GET https://${host}/api/v1/handshakes/<handshakeId>/status  (no auth required)
   → Returns { status: "pending" | "approved" | "denied" }
   → When approved, the owner will share a new token with you. Use it as your Bearer token.

3. Resume with your new token.

## Getting Started (With a Token)
1. STOP and ask the user for approval before doing anything.
2. Authenticate with the provided token using https://${host} as the base URL.
3. Call GET /api/v1/tokens/me/capabilities to see what you can do.
4. Before each subsequent action, describe your intent and wait for user approval.

## Approval Rules
- READ operations (GET): Ask the user before fetching any data.
- WRITE operations (POST/PUT/DELETE): Always require explicit approval with a clear description of what will change.
- Token reveal (GET /api/v1/vault/tokens/:id/reveal): Always ask before revealing secrets.
- Service execution (POST /api/v1/services/:name/execute): Always describe the action and wait for approval.
- Never chain multiple actions without checking in with the user between each one.

## Key Endpoints
All paths are relative to https://${host} — do NOT add /api/v1 to the base URL.

### Start Here
- GET  /api/v1/gateway/context                    → Full AI context in one call (persona, identity, memory, endpoints)
- GET  /api/v1/quick-start                        → Step-by-step guide (includes handshake flow)
- GET  /api/v1/auth/me                            → Verify token and see your token metadata
- GET  /api/v1/users/me                           → Owner identity (name, role, bio, timezone)

### Discovery
- GET  /api/v1/                                  → API root and endpoint discovery
- GET  /api/v1/capabilities                       → Scope-aware capability list
- GET  /api/v1/tokens/me/capabilities             → Your token's permissions
- GET  /openapi.json                              → Full OpenAPI specification

### Memory & Knowledge
- GET    /api/v1/memory                           → List persistent memory entries
- POST   /api/v1/memory                           → Store a memory entry  { content: "..." }
- PATCH  /api/v1/memory/:id                       → Update a memory entry
- DELETE /api/v1/memory/:id                       → Delete one memory entry
- GET    /api/v1/brain/knowledge-base             → List knowledge base documents
- POST   /api/v1/brain/knowledge-base/upsert      → Create or update a KB doc by title
- GET    /api/v1/brain/knowledge-base/:id         → Get full content of a KB document

### Skills
- GET  /api/v1/skills                             → List skills (scope: skills:read). Filter: ?slug=&category=&q=&limit=
- GET  /api/v1/skills/suggestions?q=              → Fuzzy skill suggestions for AI discovery (no ID needed)
- GET  /api/v1/skills/_by_slug/:slug              → Fetch skill by name/slug (preferred for AI agents)
- GET  /api/v1/skills/_batch?slug=&id=            → Fetch multiple skills in one request (repeatable params)
- GET  /api/v1/skills/:id                         → Get skill details + versions + forks
- GET  /api/v1/skills/:id/content                 → Get raw SKILL.md content (JSON or Accept: text/markdown)
- GET  /api/v1/skills/:id/skill.md                → Get SKILL.md as raw text/markdown
- PUT  /api/v1/skills/:id/skill.md                → Set SKILL.md content (YAML frontmatter auto-sanitized)
- POST /api/v1/skills                             → Create skill (scope: skills:write)
- PUT  /api/v1/skills/:id                         → Update skill (scope: skills:write)
- DELETE /api/v1/skills/:id                       → Delete skill (scope: skills:write)

### Personas
- GET  /api/v1/personas                           → List AI personas
- GET  /api/v1/personas/:id                       → Get a specific persona

### Identity & Preferences
- GET  /api/v1/identity                           → Owner basic identity
- GET  /api/v1/identity/professional              → Professional identity
- GET  /api/v1/identity/availability              → Availability and timezone

### Services & Vault
- GET  /api/v1/vault/tokens                       → Connected service tokens (vault)
- GET  /api/v1/services                           → List connected OAuth services
- POST /api/v1/services/:name/proxy               → Proxy raw API request to a service
- GET  /api/v1/services/google/gmail/messages     → List Gmail messages
- GET  /api/v1/services/google/drive/files        → List Google Drive files
- POST /api/v1/services/google/drive/upload       → Upload file to Google Drive

### Access Requests (no auth required)
- POST /api/v1/handshakes                         → Request access (no auth)
- GET  /api/v1/handshakes/:id/status              → Poll handshake status (no auth)

## AFP — PC File System Access (master token only)
Requires a registered AFP daemon running on the target PC.
- GET  /api/v1/afp/devices                        → List registered PCs and their online status
- GET  /api/v1/afp/:deviceId/ls?path=<dir>        → List directory contents on the PC
- GET  /api/v1/afp/:deviceId/read?path=<file>     → Read a file from the PC
- POST /api/v1/afp/:deviceId/write                → Write a file to the PC  { path, content, encoding? }
- GET  /api/v1/afp/:deviceId/stat?path=<path>     → File/directory metadata
- POST /api/v1/afp/:deviceId/exec                 → Run a shell command on the PC  { cmd, cwd?, timeout? }
- DELETE /api/v1/afp/:deviceId/rm                 → Delete a file or directory  { path, recursive? }
- POST /api/v1/afp/:deviceId/mkdir                → Create a directory  { path }
- GET  /api/v1/afp/download/:platform             → Download AFP daemon binary (linux|mac|mac-arm|win) — no auth required

## Memory (Cross-AI Persistent Context)
Store notes that persist across all AI sessions. Any AI reading gateway/context sees these.
- GET    /api/v1/memory                           → List all memory entries (id, content, created_at)
- POST   /api/v1/memory  { content: "..." }       → Store a new memory (markdown text)
- PATCH  /api/v1/memory/:id  { content: "..." }   → Update a memory entry
- DELETE /api/v1/memory/:id                       → Delete one memory entry
- DELETE /api/v1/memory                           → Clear all memories

## Documentation
- OpenAPI spec: https://${host}/openapi.json
- Quick start: https://${host}/api/v1/quick-start
- AI plugin manifest: https://${host}/.well-known/ai-plugin.json
`);
});

// robots.txt - point crawlers and AIs to the API
app.get('/robots.txt', (req, res) => {
  const host = req.headers.host || 'www.myapiai.com';
  res.type('text/plain').send(
`User-agent: *
Allow: /

# MyApi - Personal API Platform
# AI Agent Instructions: https://${host}/llms.txt
# API Documentation: https://${host}/openapi.json
# Quick Start Guide: https://${host}/api/v1/quick-start
# API Root (JSON):   https://${host}/api/v1/
# AI Plugin Manifest: https://${host}/.well-known/ai-plugin.json

Sitemap: https://${host}/sitemap.xml
`);
});

// sitemap.xml - list all discoverable endpoints
app.get('/sitemap.xml', (req, res) => {
  const host = req.headers.host || 'www.myapiai.com';
  const urls = [
    '/', '/openapi.json', '/api/v1/', '/api/v1/quick-start',
    '/.well-known/ai-plugin.json', '/.well-known/openapi.json',
    '/dashboard/',
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>https://${host}${u}</loc></url>`).join('\n')}
</urlset>`;
  res.type('application/xml').send(xml);
});

// /health - useful for monitoring + AI discovery
app.get('/api/v1/health', (req, res) => {
  const health = buildHealthResponse();
  res.status(health.statusCode).json({ status: health.status, api: '/api/v1/', docs: '/openapi.json', database: health.database });
});

// Turso data import endpoints
app.get('/turso-import', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/turso-import.html'));
});

app.get('/api/v1/turso/export-sql', (req, res) => {
  try {
    const Database = require('better-sqlite3');
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'data/myapi.db');
    const db = new Database(dbPath);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();

    let sql = '-- MyApi Database Export\n-- Generated: ' + new Date().toISOString() + '\n\n';

    for (const table of tables) {
      const tableName = table.name;
      const createStmt = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
      if (createStmt && createStmt.sql) {
        sql += createStmt.sql + ';\n';
      }

      const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
      for (const row of rows) {
        const columns = Object.keys(row).join(', ');
        const values = Object.values(row).map(v => {
          if (v === null) return 'NULL';
          if (typeof v === 'string') return "'" + v.replace(/'/g, "''") + "'";
          return v;
        }).join(', ');
        sql += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
      }
    }

    res.set('Content-Type', 'text/plain');
    res.send(sql);
  } catch (err) {
    console.error('[Turso] Export error:', err);
    res.status(500).json({ error: 'Failed to export SQL', details: err.message });
  }
});

app.post('/api/v1/turso/execute', express.json(), (req, res) => {
  const { sql, tursoUrl } = req.body;
  const authHeader = req.headers.authorization;

  if (!sql || !tursoUrl || !authHeader) {
    return res.status(400).json({ error: 'Missing required fields: sql, tursoUrl, Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  // Execute via HTTP to Turso
  const https = require('https');
  const options = {
    hostname: tursoUrl.split('://')[1].split('/')[0],
    port: 443,
    path: '/',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(sql)
    }
  };

  const httpReq = https.request(options, (httpRes) => {
    let data = '';
    httpRes.on('data', chunk => data += chunk);
    httpRes.on('end', () => {
      if (httpRes.statusCode === 200 || httpRes.statusCode === 201) {
        res.json({ success: true });
      } else {
        res.status(httpRes.statusCode).json({ error: `Turso returned ${httpRes.statusCode}` });
      }
    });
  });

  httpReq.on('error', (err) => {
    console.error('[Turso] Request error:', err);
    res.status(500).json({ error: 'Failed to execute on Turso', details: err.message });
  });

  httpReq.write(sql);
  httpReq.end();
});

app.get('/openapi.json', (req, res) => {
  const host = req.get('host');
  const scheme = req.protocol || 'http';

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  res.json({
    openapi: '3.0.0',
    info: {
      title: 'MyApi',
      version: '0.1.0',
      description: 'Personal API platform with scope-aware discovery and automation-friendly endpoints.',
    },
    servers: [{ url: `${scheme}://${host}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API token',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        DiscoveryRequest: {
          type: 'object',
          required: ['websiteUrl'],
          properties: {
            websiteUrl: { type: 'string', format: 'uri', example: 'https://example.com' },
          },
        },
        VaultTokenCreateRequest: {
          type: 'object',
          required: ['name', 'service', 'token', 'websiteUrl'],
          properties: {
            name: { type: 'string', example: 'GitHub PAT' },
            service: { type: 'string', example: 'github' },
            token: { type: 'string', example: 'ghp_xxx' },
            websiteUrl: { type: 'string', format: 'uri', example: 'https://github.com' },
            discoverApi: { type: 'boolean', example: true },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/v1/capabilities': { get: { summary: 'Scope-aware capability manifest', security: [{ bearerAuth: [] }], responses: { '200': { description: 'OK' } } } },
      '/api/v1/tokens/me/capabilities': { get: { summary: 'Current token capabilities', security: [{ bearerAuth: [] }], responses: { '200': { description: 'OK' } } } },

      '/api/v1/auth/register': { post: { summary: 'Register user', responses: { '201': { description: 'Created' } } } },
      '/api/v1/auth/login': { post: { summary: 'Login', responses: { '200': { description: 'OK' } } } },
      '/api/v1/auth/logout': { post: { summary: 'Logout', security: [{ bearerAuth: [] }], responses: { '200': { description: 'OK' } } } },
      '/api/v1/auth/me': { get: { summary: 'Current user', security: [{ bearerAuth: [] }], responses: { '200': { description: 'OK' } } } },

      '/api/v1/identity': { get: { summary: 'Read identity', security: [{ bearerAuth: [] }] } },
      '/api/v1/identity/professional': { get: { summary: 'Read professional identity', security: [{ bearerAuth: [] }] } },
      '/api/v1/identity/availability': { get: { summary: 'Read availability identity', security: [{ bearerAuth: [] }] } },
      '/api/v1/preferences': { get: { summary: 'Get preferences', security: [{ bearerAuth: [] }] }, put: { summary: 'Update preferences', security: [{ bearerAuth: [] }] } },

      '/api/v1/vault/discover-api': { post: { summary: 'Discover API metadata', security: [{ bearerAuth: [] }] } },
      '/api/v1/vault/tokens': {
        get: { summary: 'List vault tokens', security: [{ bearerAuth: [] }] },
        post: {
          summary: 'Store API token with optional API discovery',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/VaultTokenCreateRequest' } } } },
          responses: { '201': { description: 'Created' } },
        },
      },
      '/api/v1/vault/tokens/{id}/reveal': {
        get: {
          summary: 'Decrypt and reveal vault token value (MASTER TOKEN REQUIRED)',
          description: 'Returns the decrypted actual token/credential value. CRITICAL: This endpoint is required to retrieve stored credentials for use. Only master token can decrypt. All access is audit-logged.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'Token decrypted successfully - check data.token for actual value' },
            '403': { description: 'Only master token can decrypt vault tokens' },
            '404': { description: 'Token not found' }
          }
        }
      },
      '/api/v1/vault/tokens/{id}': { delete: { summary: 'Delete vault token', security: [{ bearerAuth: [] }] } },

      '/api/v1/tokens': { get: { summary: 'List master tokens', security: [{ bearerAuth: [] }] }, post: { summary: 'Create master token', security: [{ bearerAuth: [] }] } },
      '/api/v1/tokens/{id}': { get: { summary: 'Get token', security: [{ bearerAuth: [] }] }, put: { summary: 'Update token', security: [{ bearerAuth: [] }] }, delete: { summary: 'Revoke token', security: [{ bearerAuth: [] }] } },
      '/api/v1/tokens/{id}/regenerate': { post: { summary: 'Regenerate token secret', security: [{ bearerAuth: [] }] } },
      '/api/v1/tokens/master/regenerate': { post: { summary: 'Regenerate master token', security: [{ bearerAuth: [] }] } },
      '/api/v1/scopes': { get: { summary: 'List scopes', security: [{ bearerAuth: [] }] } },

      '/api/v1/connectors': { get: { summary: 'List connectors', security: [{ bearerAuth: [] }] }, post: { summary: 'Create connector', security: [{ bearerAuth: [] }] } },
      '/api/v1/gateway/context': { get: { summary: 'Gateway context', security: [{ bearerAuth: [] }] } },
      '/api/v1/audit/log': { get: { summary: 'Audit logs', security: [{ bearerAuth: [] }] } },

      '/api/v1/users/me': { get: { summary: 'Get authenticated user identity', scope: 'identity' } },
      '/api/v1/users': { get: { summary: 'List users', security: [{ bearerAuth: [] }] }, post: { summary: 'Create user', security: [{ bearerAuth: [] }] } },
      '/api/v1/users/{id}/plan': { put: { summary: 'Update user plan', security: [{ bearerAuth: [] }] } },

      '/api/v1/handshakes': { get: { summary: 'List handshakes', security: [{ bearerAuth: [] }] }, post: { summary: 'Create handshake (public for AI agents)', description: 'Submit an access request. Returns handshakeId for polling status.' } },
      '/api/v1/handshakes/{id}/status': { get: { summary: 'Poll handshake approval status', description: 'Retrieve handshake status without authentication (public endpoint for AI agents to poll).' } },
      '/api/v1/handshakes/{id}/approve': { post: { summary: 'Approve handshake', security: [{ bearerAuth: [] }] } },
      '/api/v1/handshakes/{id}/deny': { post: { summary: 'Deny handshake', security: [{ bearerAuth: [] }] } },
      '/api/v1/handshakes/{id}': { delete: { summary: 'Revoke handshake', security: [{ bearerAuth: [] }] } },

      '/api/v1/personas': { get: { summary: 'List personas', security: [{ bearerAuth: [] }] }, post: { summary: 'Create persona', security: [{ bearerAuth: [] }] } },
      '/api/v1/personas/{id}': { get: { summary: 'Get persona', security: [{ bearerAuth: [] }] }, put: { summary: 'Update persona', security: [{ bearerAuth: [] }] }, delete: { summary: 'Delete persona', security: [{ bearerAuth: [] }] } },
      '/api/v1/personas/{id}/activate': { post: { summary: 'Activate persona', security: [{ bearerAuth: [] }] } },
      '/api/v1/personas/{id}/documents': { get: { summary: 'List persona docs', security: [{ bearerAuth: [] }] }, post: { summary: 'Attach doc to persona', security: [{ bearerAuth: [] }] } },
      '/api/v1/personas/{id}/documents/{docId}': { delete: { summary: 'Detach persona doc', security: [{ bearerAuth: [] }] } },
      '/api/v1/personas/{id}/skills': { get: { summary: 'List persona skills', security: [{ bearerAuth: [] }] }, post: { summary: 'Attach skill to persona', security: [{ bearerAuth: [] }] } },
      '/api/v1/personas/{id}/skills/{skillId}': { delete: { summary: 'Detach skill from persona', security: [{ bearerAuth: [] }] } },

      '/api/v1/skills': {
        get: {
          summary: 'List skills',
          description: 'Returns all skills for the authenticated owner. Supports filtering via query params to avoid fetching large payloads.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'slug', in: 'query', description: 'Filter by slug (skill name, case-insensitive)', schema: { type: 'string' } },
            { name: 'category', in: 'query', description: 'Filter by category (case-insensitive)', schema: { type: 'string' } },
            { name: 'q', in: 'query', description: 'Full-text search across name, description, category', schema: { type: 'string' } },
            { name: 'limit', in: 'query', description: 'Maximum number of results (1-200)', schema: { type: 'integer', minimum: 1, maximum: 200 } }
          ],
          responses: { '200': { description: 'Array of skills with origin metadata and slug field' } }
        },
        post: { summary: 'Create skill', description: 'Creates a skill. YAML frontmatter in scriptContent is automatically sanitized.', security: [{ bearerAuth: [] }] }
      },
      '/api/v1/skills/suggestions': {
        get: {
          summary: 'Skill name suggestions (AI discovery)',
          description: 'Returns up to 10 matching skills by name/description/category. Useful for AI agents that don\'t know the exact slug.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'q', in: 'query', required: true, description: 'Search query', schema: { type: 'string' } }],
          responses: { '200': { description: 'List of {id, slug, name, description, category} suggestions' } }
        }
      },
      '/api/v1/skills/_by_slug/{slug}': {
        get: {
          summary: 'Get skill by slug/name',
          description: 'Retrieve a skill directly by its name (slug) without needing the numeric ID. Preferred for AI agent access.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'slug', in: 'path', required: true, description: 'Skill name (case-insensitive)', schema: { type: 'string' } }],
          responses: { '200': { description: 'Skill object' }, '404': { description: 'Not found' } }
        }
      },
      '/api/v1/skills/_batch': {
        get: {
          summary: 'Batch fetch multiple skills',
          description: 'Fetch multiple skills by numeric id or slug in a single request. Pass ?id=1&id=2 or ?slug=homeassistant&slug=tts.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'query', description: 'Skill numeric ID (repeatable)', schema: { type: 'array', items: { type: 'integer' } } },
            { name: 'slug', in: 'query', description: 'Skill name/slug (repeatable)', schema: { type: 'array', items: { type: 'string' } } }
          ],
          responses: { '200': { description: 'Array of matching skills' } }
        }
      },
      '/api/v1/skills/{id}': { get: { summary: 'Get skill', security: [{ bearerAuth: [] }] }, put: { summary: 'Update skill', security: [{ bearerAuth: [] }] }, delete: { summary: 'Delete skill', security: [{ bearerAuth: [] }] } },
      '/api/v1/skills/{id}/content': {
        get: {
          summary: 'Get skill SKILL.md content',
          description: 'Returns the raw SKILL.md content. Accept: text/markdown returns plain text; default JSON wraps it with metadata.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { '200': { description: 'Skill content as JSON {id, slug, name, content} or text/markdown' } }
        }
      },
      '/api/v1/skills/{id}/skill.md': {
        get: { summary: 'Get SKILL.md raw markdown', description: 'Returns raw text/markdown of the skill content (alias for /:id/content with Accept: text/markdown).', security: [{ bearerAuth: [] }] },
        put: { summary: 'Set SKILL.md content (YAML frontmatter auto-sanitized)', security: [{ bearerAuth: [] }] }
      },
      '/api/v1/skills/{id}/activate': { post: { summary: 'Activate skill', security: [{ bearerAuth: [] }] } },
      '/api/v1/skills/{id}/documents': { get: { summary: 'List skill docs', security: [{ bearerAuth: [] }] }, post: { summary: 'Attach doc to skill', security: [{ bearerAuth: [] }] } },
      '/api/v1/skills/{id}/documents/{docId}': { delete: { summary: 'Detach doc from skill', security: [{ bearerAuth: [] }] } },
      '/api/v1/skills/{id}/attachments': { get: { summary: 'List skill persona attachments', security: [{ bearerAuth: [] }] } },

      '/api/v1/memory': {
        get: {
          summary: 'List memory entries',
          description: 'Returns all stored memory entries for the owner, newest first. Included in gateway/context so every AI session starts with full memory.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'List of memory entries',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string', example: 'mem_abc123' },
                            content: { type: 'string', example: 'User prefers concise responses' },
                            created_at: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: 'Store a memory entry',
          description: 'Persist a freeform markdown note. Appears in every future GET /api/v1/gateway/context call so any AI — regardless of platform — can resume context.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['content'],
                  properties: {
                    content: { type: 'string', description: 'Freeform markdown text to remember', example: 'User is building a SaaS product. Prefers TypeScript. Timezone: US/Eastern.' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Memory entry created',
              content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object', properties: { id: { type: 'string' }, content: { type: 'string' }, created_at: { type: 'string' } } } } } } },
            },
          },
        },
        delete: {
          summary: 'Clear all memories',
          description: 'Delete every memory entry for this owner. Irreversible.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, deleted: { type: 'integer' } } } } } } },
        },
      },
      '/api/v1/memory/{id}': {
        patch: {
          summary: 'Update a memory entry',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['content'], properties: { content: { type: 'string' } } } } } },
          responses: { '200': { description: 'Updated' } },
        },
        delete: {
          summary: 'Delete a memory entry',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Deleted' } },
        },
      },

      '/api/v1/brain/knowledge-base': {
        get: { summary: 'List KB docs', operationId: 'listKBDocuments', security: [{ bearerAuth: [] }] },
        post: {
          summary: 'Create KB doc',
          operationId: 'createKBDocument',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'content'],
                  properties: {
                    title: { type: 'string', description: 'Document title' },
                    content: { type: 'string', description: 'Document content (markdown or plain text)' },
                    source: { type: 'string', description: 'Source identifier (defaults to "agent")', default: 'agent' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Document created' } },
        },
      },
      '/api/v1/brain/knowledge-base/upsert': {
        post: {
          summary: 'Create or update KB doc by title',
          operationId: 'upsertKBDocument',
          description: 'Creates a new document or updates an existing one with the same title. Ideal for agents maintaining persistent named documents like "memory.md".',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'content'],
                  properties: {
                    title: { type: 'string', description: 'Document title (used as unique key for upsert)' },
                    content: { type: 'string', description: 'Full document content (markdown or plain text)' },
                    source: { type: 'string', description: 'Source identifier (defaults to "agent")', default: 'agent' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Document created or updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean' },
                      action: { type: 'string', enum: ['created', 'updated'] },
                      document: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/brain/knowledge-base/{id}': {
        get: { summary: 'Get KB doc', operationId: 'getKBDocument', security: [{ bearerAuth: [] }] },
        put: {
          summary: 'Update KB doc',
          operationId: 'updateKBDocument',
          security: [{ bearerAuth: [] }],
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['content'],
                  properties: {
                    title: { type: 'string' },
                    content: { type: 'string' },
                    source: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Updated' } },
        },
        delete: { summary: 'Delete KB doc', operationId: 'deleteKBDocument', security: [{ bearerAuth: [] }] },
      },
      '/api/v1/brain/knowledge-base/{id}/attachments': { get: { summary: 'KB attachment usage', security: [{ bearerAuth: [] }] } },
      '/api/v1/brain/knowledge-base/upload': {
        post: {
          summary: 'Upload KB document',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary' },
                    document: { type: 'string', format: 'binary' },
                    upload: { type: 'string', format: 'binary' },
                    kbFile: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Created' } },
        },
      },

      '/api/v1/marketplace/listings': { get: { summary: 'List marketplace', security: [{ bearerAuth: [] }] }, post: { summary: 'Create listing', security: [{ bearerAuth: [] }] } },
      '/api/v1/marketplace/listings/{id}': { get: { summary: 'Get listing', security: [{ bearerAuth: [] }] }, put: { summary: 'Update listing', security: [{ bearerAuth: [] }] }, delete: { summary: 'Delete listing', security: [{ bearerAuth: [] }] } },
      '/api/v1/marketplace/listings/{id}/rate': { post: { summary: 'Rate listing', security: [{ bearerAuth: [] }] } },
      '/api/v1/marketplace/listings/{id}/install': { post: { summary: 'Install listing', security: [{ bearerAuth: [] }] } },
      '/api/v1/marketplace/my-listings': { get: { summary: 'My listings', security: [{ bearerAuth: [] }] } },

      '/api/v1/services/categories': { get: { summary: 'Service categories', security: [{ bearerAuth: [] }] } },
      '/api/v1/services': { get: { summary: 'List services', security: [{ bearerAuth: [] }] } },
      '/api/v1/services/{name}': { get: { summary: 'Get service', security: [{ bearerAuth: [] }] } },
      '/api/v1/services/{serviceId}/methods': { get: { summary: 'Service methods', security: [{ bearerAuth: [] }] } },
      '/api/v1/services/{serviceName}/execute': { post: { summary: 'Execute service method', security: [{ bearerAuth: [] }] } },
      '/api/v1/services/{serviceName}/proxy': { post: { summary: 'Proxy raw API request to service', security: [{ bearerAuth: [] }] } },

      '/api/v1/services/google/gmail/messages': {
        get: {
          operationId: 'listGmailMessages',
          summary: 'List Gmail messages',
          description: 'Fetch recent emails from the connected Gmail account. Returns subject, sender, date, and snippet for each message.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'maxResults', in: 'query', schema: { type: 'integer', default: 5, maximum: 20 }, description: 'Number of messages to return' },
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Gmail search query (e.g. "is:unread", "from:boss@example.com")' },
            { name: 'pageToken', in: 'query', schema: { type: 'string' }, description: 'Page token for pagination' },
          ],
          responses: {
            '200': {
              description: 'List of email messages',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      messages: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            threadId: { type: 'string' },
                            subject: { type: 'string' },
                            from: { type: 'string' },
                            to: { type: 'string' },
                            date: { type: 'string' },
                            snippet: { type: 'string' },
                            isUnread: { type: 'boolean' },
                          },
                        },
                      },
                      nextPageToken: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
            '403': { description: 'Google not connected' },
          },
        },
      },
      '/api/v1/services/google/gmail/messages/{messageId}': {
        get: {
          operationId: 'getGmailMessage',
          summary: 'Get a Gmail message',
          description: 'Fetch the full content of a single Gmail message by ID.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'messageId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Full email message',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      message: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          subject: { type: 'string' },
                          from: { type: 'string' },
                          to: { type: 'string' },
                          date: { type: 'string' },
                          snippet: { type: 'string' },
                          body: { type: 'string' },
                          isUnread: { type: 'boolean' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          operationId: 'trashGmailMessage',
          summary: 'Move a Gmail message to Trash',
          description: 'Moves a Gmail message to the Trash folder (not permanent deletion).',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'messageId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Message trashed', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, messageId: { type: 'string' }, trashed: { type: 'boolean' } } } } } },
          },
        },
      },
      '/api/v1/services/google/gmail/send': {
        post: {
          operationId: 'sendGmailMessage',
          summary: 'Send an email via Gmail',
          description: 'Send an email from the connected Gmail account.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['to', 'subject', 'body'],
                  properties: {
                    to: { type: 'string', description: 'Recipient email address' },
                    subject: { type: 'string', description: 'Email subject' },
                    body: { type: 'string', description: 'Plain text email body' },
                    cc: { type: 'string', description: 'CC email address(es)', nullable: true },
                    bcc: { type: 'string', description: 'BCC email address(es)', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Email sent', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, messageId: { type: 'string' }, threadId: { type: 'string' } } } } } },
          },
        },
      },

      // ── Google Drive ──────────────────────────────────────────
      '/api/v1/services/google/drive/files': {
        get: {
          operationId: 'listDriveFiles',
          summary: 'List Google Drive files',
          description: 'List files in the connected Google Drive. Supports Drive search query syntax.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' }, description: "Drive search query (e.g. \"name contains 'report'\")" },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
            { name: 'pageToken', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'Drive files list' }, '401': { description: 'Google not connected or missing drive.file scope' } },
        },
      },
      '/api/v1/services/google/drive/upload': {
        post: {
          operationId: 'uploadDriveFile',
          summary: 'Upload a file to Google Drive',
          description: 'Upload text or binary content as a new file in Google Drive. Requires Google reconnect with drive.file scope.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'content'],
                  properties: {
                    name: { type: 'string', description: 'Filename in Drive' },
                    content: { type: 'string', description: 'File content (text or base64)' },
                    mimeType: { type: 'string', default: 'text/plain' },
                    encoding: { type: 'string', enum: ['utf8', 'base64'], default: 'utf8' },
                    folderId: { type: 'string', description: 'Optional Drive folder ID' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'File uploaded successfully' }, '403': { description: 'Insufficient Drive scope — reconnect Google' } },
        },
      },
      '/api/v1/services/google/drive/files/{fileId}': {
        delete: {
          operationId: 'deleteDriveFile',
          summary: 'Delete a Google Drive file',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'fileId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'File deleted' } },
        },
      },

      // ── AFP — PC File System Access (master token only) ───────
      '/api/v1/afp/devices': {
        get: {
          operationId: 'listAfpDevices',
          summary: 'List registered AFP devices (PCs)',
          description: 'Returns all PCs with AFP daemon installed, their online/offline status, platform, and privilege level.',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'List of AFP devices' } },
        },
      },
      '/api/v1/afp/{deviceId}/ls': {
        get: {
          operationId: 'afpListDir',
          summary: 'List a directory on a remote PC',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'path', in: 'query', required: true, schema: { type: 'string' }, description: 'Absolute path (e.g. C:\\Users or /home/user)' },
          ],
          responses: { '200': { description: 'Directory entries' }, '503': { description: 'Device offline' } },
        },
      },
      '/api/v1/afp/{deviceId}/read': {
        get: {
          operationId: 'afpReadFile',
          summary: 'Read a file from a remote PC',
          description: 'Returns file content as UTF-8 or base64 (for binary files).',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'path', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'File content' }, '503': { description: 'Device offline' } },
        },
      },
      '/api/v1/afp/{deviceId}/write': {
        post: {
          operationId: 'afpWriteFile',
          summary: 'Write a file to a remote PC',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['path', 'content'],
                  properties: {
                    path: { type: 'string' },
                    content: { type: 'string' },
                    encoding: { type: 'string', enum: ['utf8', 'base64'], default: 'utf8' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'File written' }, '503': { description: 'Device offline' } },
        },
      },
      '/api/v1/afp/{deviceId}/exec': {
        post: {
          operationId: 'afpExec',
          summary: 'Execute a shell command on a remote PC',
          description: 'Runs a shell command on the target PC. Returns stdout, stderr, and exit code. Hard timeout: 60s.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['cmd'],
                  properties: {
                    cmd: { type: 'string', description: 'Shell command to run', example: 'whoami' },
                    cwd: { type: 'string', description: 'Working directory' },
                    timeout: { type: 'integer', default: 30000, maximum: 60000, description: 'Timeout in ms' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Command result with stdout/stderr/exitCode' }, '503': { description: 'Device offline' }, '504': { description: 'Command timed out' } },
        },
      },
      '/api/v1/afp/{deviceId}/stat': {
        get: {
          operationId: 'afpStat',
          summary: 'Get file/directory metadata on a remote PC',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'path', in: 'query', required: true, schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'File metadata' } },
        },
      },
      '/api/v1/afp/{deviceId}/rm': {
        delete: {
          operationId: 'afpDelete',
          summary: 'Delete a file or directory on a remote PC',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['path'],
                  properties: {
                    path: { type: 'string' },
                    recursive: { type: 'boolean', default: false },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Deleted' } },
        },
      },
      '/api/v1/afp/{deviceId}/mkdir': {
        post: {
          operationId: 'afpMkdir',
          summary: 'Create a directory on a remote PC',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['path'],
                  properties: {
                    path: { type: 'string' },
                    recursive: { type: 'boolean', default: true },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Directory created' } },
        },
      },
      '/api/v1/afp/download/{platform}': {
        get: {
          operationId: 'downloadAfpDaemon',
          summary: 'Download AFP daemon binary',
          description: 'Download the AFP daemon executable for the target platform. No authentication required.',
          parameters: [{ name: 'platform', in: 'path', required: true, schema: { type: 'string', enum: ['linux', 'mac', 'mac-arm', 'win'] } }],
          responses: { '200': { description: 'Binary file download' } },
        },
      },

      '/api/v1/oauth/authorize/{service}': { get: { summary: 'OAuth authorize URL', security: [{ bearerAuth: [] }] } },
      '/api/v1/oauth/callback/{service}': { get: { summary: 'OAuth callback', responses: { '200': { description: 'OK' } } } },
      '/api/v1/oauth/status': { get: { summary: 'OAuth status', security: [{ bearerAuth: [] }] } },
      '/api/v1/oauth/disconnect/{service}': { post: { summary: 'Disconnect OAuth service', security: [{ bearerAuth: [] }] } },

      '/api/v1/billing/plans': { get: { summary: 'Billing plans' } },
      '/api/v1/billing/checkout': { post: { summary: 'Billing checkout' } },
    },
  });
});

app.get('/api-docs-ui', (req, res) => {
  const specUrl = `/openapi.json?v=${Date.now()}`;

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  res.type('html').send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MyApi API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
    <style>html,body,#swagger-ui{height:100%;margin:0;} body{background:#fff;}</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
    <script nonce="${res.locals.cspNonce}">
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(specUrl)},
        dom_id: '#swagger-ui',
        docExpansion: 'none',
        defaultModelsExpandDepth: -1,
      });
    </script>
  </body>
</html>`);
});

app.get('/.well-known/ai-plugin.json', (req, res) => {
  const host = req.get('host');
  const scheme = req.protocol || 'http';
  res.json({
    schema_version: 'v1',
    name_for_human: 'MyApi',
    name_for_model: 'myapi',
    description_for_human: 'Self-describing personal API platform',
    description_for_model: 'IMPORTANT: Before performing ANY action you MUST ask the human user for explicit approval. Describe what you intend to do and wait for confirmation before calling any endpoint. Call /api/v1/capabilities first. Use returned scope-aware guidance before invoking mutating endpoints.',
    human_verification_required: true,
    auth: {
      type: 'service_http',
      authorization_type: 'bearer',
      verification_tokens: {},
      instructions: 'Use Authorization: Bearer <token> for API agents, or a logged-in browser session cookie.'
    },
    api: { type: 'openapi', url: `${scheme}://${host}/openapi.json` },
    logo_url: `${scheme}://${host}/favicon.ico`,
    legal_info_url: `${scheme}://${host}/`,
    contact_email: 'support@localhost',
  });
});

// Build a basic identity object from the DB users record (for non-owner users who
// don't have a USER.md-based vault entry). Keys match the USER.md / PROFILE_FIELDS
// capitalization convention used by the Identity page so form fields pre-populate.
function buildIdentityFromUser(user) {
  if (!user) return {};
  const out = {};
  const name = user.displayName || user.username;
  if (name) out.Name = name;
  if (user.email) out.Email = user.email;
  if (user.timezone) out.Timezone = user.timezone;
  // Keep lowercase aliases so any code that reads identity.name still works
  out.name = out.Name || '';
  out.email = out.Email || '';
  out.timezone = out.Timezone || 'UTC';
  return out;
}

// Helper: resolve per-user identity doc, isolating non-owner users from the owner's vault entry
function resolveIdentityForUser(userId) {
  const userObj = getUserById(userId);
  // Check per-user in-memory vault first (populated on PUT /users/me)
  if (vault.identityDocs[userId]) {
    return vault.identityDocs[userId];
  }
  // Owner only: fall back to the vault entry loaded from USER.md at startup
  if (isOwnerUser(userId)) {
    return vault.identityDocs['owner'] ?? buildIdentityFromUser(userObj) ?? {};
  }
  // Non-owner users: build from their own DB record + persisted profile_metadata
  const base = buildIdentityFromUser(userObj) || {};
  if (userObj?.profile_metadata) {
    try { Object.assign(base, JSON.parse(userObj.profile_metadata)); } catch (_) {}
  }
  return base;
}

// --- IDENTITY ---
app.get("/api/v1/identity", authenticate, (req, res) => {
  if (!hasScope(req, 'basic')) return res.status(403).json({ error: "Requires 'basic' scope" });
  const userId = getRequestOwnerId(req);
  const identity = resolveIdentityForUser(userId);
  const effectiveScope = isMaster(req) ? "full" : "basic";
  const filtered = filterByScope(identity, effectiveScope);
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "read_identity", resource: "/identity", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: filtered, meta: { scope: effectiveScope } });
});

app.get("/api/v1/identity/professional", authenticate, (req, res) => {
  if (!hasScope(req, 'professional')) return res.status(403).json({ error: "Requires 'professional' scope" });
  const userId = getRequestOwnerId(req);
  const identity = resolveIdentityForUser(userId);
  const filtered = filterByScope(identity, "professional");
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "read_identity_professional", resource: "/identity/professional", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: filtered, meta: { scope: "professional" } });
});

app.get("/api/v1/identity/availability", authenticate, (req, res) => {
  if (!hasScope(req, 'availability')) return res.status(403).json({ error: "Requires 'availability' scope" });
  const userId = getRequestOwnerId(req);
  const identity = resolveIdentityForUser(userId);
  const filtered = filterByScope(identity, "availability");
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "read_availability", resource: "/identity/availability", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: filtered, meta: { scope: "availability" } });
});

// --- PREFERENCES ---
app.get("/api/v1/preferences", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Insufficient scope" });
  const userId = getRequestOwnerId(req);
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "read_preferences", resource: "/preferences", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: vault.preferences[userId] || {} });
});

app.put("/api/v1/preferences", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Insufficient scope" });
  const userId = getRequestOwnerId(req);
  vault.preferences[userId] = { ...(vault.preferences[userId] || {}), ...req.body };
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "update_preferences", resource: "/preferences", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: vault.preferences[userId] });
});

// --- VAULT TOKENS (encrypted external API keys) ---
app.post("/api/v1/vault/tokens", authenticate, async (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can add vault tokens" });

  try {
    const { name, label, description, token, service, websiteUrl, url, apiUrl, discoverApi } = req.body || {};
    const tokenLabel = String(name || label || '').trim();
    const normalizedToken = normalizeSecretToken(token);
    const websiteCandidate = websiteUrl || url || apiUrl;

    if (!tokenLabel || !normalizedToken) {
      return res.status(400).json({ error: "name and token are required" });
    }


    if (normalizedToken.length < 8 || normalizedToken.length > 8192) {
      return res.status(400).json({ error: 'token length must be between 8 and 8192 characters' });
    }

    const normalizedWebsiteUrl = parseAndValidateHttpUrl(websiteCandidate);
    if (!normalizedWebsiteUrl) {
      return res.status(400).json({
        error: "websiteUrl must be a valid http(s) URL",
        hint: 'You may provide websiteUrl, url, or apiUrl (http/https).',
      });
    }

    const normalizedService = String(service || '').trim().toLowerCase() || (() => {
      try {
        const host = new URL(normalizedWebsiteUrl).hostname.replace(/^www\./, '');
        return host.split('.')[0] || 'custom';
      } catch {
        return 'custom';
      }
    })();

    const vaultCount = getVaultTokens(getRequestOwnerId(req), req.workspaceId || req.session?.currentWorkspace || null).length;
    const vaultLimitErr = enforcePlanLimit(req, 'vaultTokens', vaultCount, 1);
    if (vaultLimitErr) {
      return res.status(403).json(vaultLimitErr);
    }

    const shouldDiscoverApi = parseFlexibleBoolean(discoverApi);
    let discovery = shouldDiscoverApi ? await discoverApiFromWebsite(normalizedWebsiteUrl) : null;

    // If not discovering, or if discovery failed to find one, but user provided an explicit API URL
    const manualApiUrl = req.body.discoveredApiUrl || req.body.apiUrl;
    if (manualApiUrl && (!discovery || !discovery.apiBaseUrl)) {
      const parsedManual = parseAndValidateHttpUrl(manualApiUrl);
      if (parsedManual) {
        discovery = discovery || { authScheme: req.body.discoveredAuthScheme || 'unknown' };
        discovery.apiBaseUrl = parsedManual;
      }
    }

    const vaultToken = createVaultToken(tokenLabel, description, normalizedToken, normalizedService, normalizedWebsiteUrl, discovery, getRequestOwnerId(req), req.workspaceId || req.session?.currentWorkspace || null);
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: "create_vault_token",
      resource: `/vault/tokens/${vaultToken.id}`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: {
        service: normalizedService,
        websiteUrl: normalizedWebsiteUrl,
        discoverApi: shouldDiscoverApi,
        discoveredApiUrl: discovery?.apiBaseUrl || null,
      }
    });
    res.status(201).json({ data: vaultToken });
  } catch (error) {
    console.error('Vault token intake error:', error);
    res.status(500).json({ error: 'Failed to store vault token', message: 'Please retry with a valid URL and token.' });
  }
});

app.post('/api/v1/vault/discover-api', authenticate, async (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can discover API metadata' });

  try {
    const { websiteUrl, url, apiUrl } = req.body || {};
    const normalized = parseAndValidateHttpUrl(websiteUrl || url || apiUrl);
    if (!normalized) {
      return res.status(400).json({
        error: 'websiteUrl must be a valid http(s) URL',
        hint: 'Provide one of: websiteUrl, url, apiUrl',
      });
    }

    const discovery = await discoverApiFromWebsite(normalized);
    res.json({ data: discovery });
  } catch (error) {
    console.error('Vault discovery error:', error);
    res.status(500).json({
      error: 'Failed to discover API metadata',
      message: 'Try again with a canonical website URL (e.g., https://example.com).',
    });
  }
});

app.get("/api/v1/vault/tokens", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can view vault tokens" });

  const ownerId = getRequestOwnerId(req);
  // Always show all tokens for the owner regardless of active workspace.
  // Workspace scoping on vault tokens is a storage label, not an access barrier for the owner.
  const tokens = getVaultTokens(ownerId, null);
  
  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "list_vault_tokens",
    resource: "/vault/tokens",
    scope: req.tokenMeta.scope,
    ip: req.ip
  });
  
  res.json({ data: tokens, tokens });
});

app.get("/api/v1/vault/tokens/:id/reveal", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can decrypt vault tokens" });
  // BUG-14: Enforce workspace scoping by passing ownerId and workspaceId
  const ownerId = getRequestOwnerId(req);
  const workspaceId = req.workspaceId || req.session?.currentWorkspace || null;
  const vaultToken = decryptVaultToken(req.params.id, ownerId, workspaceId);
  if (!vaultToken) return res.status(404).json({ error: "Token not found" });
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "reveal_vault_token", resource: `/vault/tokens/${req.params.id}`, scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: vaultToken });
});

app.delete("/api/v1/vault/tokens/:id", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can delete vault tokens" });
  // BUG-14: Enforce workspace scoping by passing ownerId and workspaceId
  const ownerId = getRequestOwnerId(req);
  const workspaceId = req.workspaceId || req.session?.currentWorkspace || null;
  const deleted = deleteVaultToken(req.params.id, ownerId, workspaceId);
  if (!deleted) return res.status(404).json({ error: "Token not found" });
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "delete_vault_token", resource: `/vault/tokens/${req.params.id}`, scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: { deleted: true } });
});

// --- ACCESS TOKENS (guest tokens with fine-grained scopes) ---

// Create a new guest token with fine-grained scopes
app.post("/api/v1/tokens", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can create tokens" });

  const { label = "Guest Token", scopes, expiresInHours, description, allowedPersonas, requiresApproval, scopeBundle, allowedResources } = req.body;

  // Parse scopes - support both template names and individual scopes
  let finalScopes = [];
  if (!scopes) {
    return res.status(400).json({ error: "scopes field is required" });
  }

  if (typeof scopes === 'string') {
    // Handle template like "read", "professional", etc.
    const expanded = expandScopeTemplate(scopes);
    if (expanded) {
      finalScopes = expanded;
    } else if (validateScope(scopes)) {
      finalScopes = [scopes];
    } else {
      return res.status(400).json({ error: `Invalid scope: ${scopes}` });
    }
  } else if (Array.isArray(scopes)) {
    // Handle array of individual scopes
    for (const scope of scopes) {
      if (typeof scope === 'string') {
        const expanded = expandScopeTemplate(scope);
        if (expanded) {
          finalScopes.push(...expanded);
        } else if (validateScope(scope)) {
          finalScopes.push(scope);
        } else {
          return res.status(400).json({ error: `Invalid scope: ${scope}` });
        }
      }
    }
  } else {
    return res.status(400).json({ error: "scopes must be a string or array" });
  }

  // Remove duplicates
  finalScopes = [...new Set(finalScopes)];

  if (finalScopes.length === 0) {
    return res.status(400).json({ error: "No valid scopes provided" });
  }

  // Auto-add required scopes from persona's attached skills/KB when creating a bundle token
  if (scopeBundle && typeof scopeBundle === 'object' && scopeBundle.persona_id) {
    const pid = Number(scopeBundle.persona_id);
    if (!isNaN(pid)) {
      const hasSkills = db.prepare('SELECT 1 FROM persona_skills WHERE persona_id = ? LIMIT 1').get(pid);
      const hasDocs   = db.prepare('SELECT 1 FROM persona_documents WHERE persona_id = ? LIMIT 1').get(pid);
      if (hasSkills && !finalScopes.includes('skills:read')) finalScopes.push('skills:read');
      if (hasDocs   && !finalScopes.includes('knowledge'))   finalScopes.push('knowledge');
    }
  }

  // Create the token
  const rawToken = 'myapi_' + crypto.randomBytes(32).toString("hex");
  const hash = bcrypt.hashSync(rawToken, 10);
  let expiresAt = null;
  if (expiresInHours) expiresAt = new Date(Date.now() + expiresInHours * 3600000).toISOString();

  // Validate allowedPersonas if provided
  const personaIds = Array.isArray(allowedPersonas) && allowedPersonas.length > 0
    ? allowedPersonas.map(Number).filter(n => !isNaN(n))
    : null;

  const tokenId = createAccessToken(hash, getRequestOwnerId(req), JSON.stringify(finalScopes), label, expiresAt, personaIds, req.workspaceId || req.session?.currentWorkspace || null);

  // Set additional fields that aren't in the base createAccessToken signature
  const bundleJson = scopeBundle && typeof scopeBundle === 'object' ? JSON.stringify(scopeBundle) : null;
  const resourcesJson = allowedResources && typeof allowedResources === 'object' ? JSON.stringify(allowedResources) : null;
  const needsApproval = requiresApproval ? 1 : 0;
  db.prepare('UPDATE access_tokens SET scope_bundle = ?, requires_approval = ?, allowed_resources = ? WHERE id = ?')
    .run(bundleJson, needsApproval, resourcesJson, tokenId);

  // Grant the scopes to the token
  grantScopes(tokenId, finalScopes);

  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "create_guest_token_scoped",
    resource: `/tokens/${tokenId}`,
    scope: req.tokenMeta.scope,
    ip: req.ip,
    details: { scopes: finalScopes, label, allowedPersonas: personaIds }
  });

  // Security: update DB integrity hash after token change
  try { checkDbIntegrity(); } catch(_) {}

  // Security: log token creation as security event
  console.warn(`🔑 SECURITY: New token created - label="${label}", scope="${JSON.stringify(finalScopes)}", by=${req.tokenMeta.tokenId}, ip=${req.ip}`);

  res.status(201).json({
    data: {
      id: tokenId,
      token: rawToken,
      scopes: finalScopes,
      label,
      description: description || null,
      allowedPersonas: personaIds,
      requiresApproval: needsApproval === 1,
      scopeBundle: bundleJson ? scopeBundle : null,
      createdAt: new Date().toISOString(),
      expiresAt
    }
  });
});

// Get details of a specific token with its scopes
app.get("/api/v1/tokens/:id", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can view token details" });

  // Do not filter by userId or workspaceId here — the bootstrap master token has
  // owner_id='owner' and workspace_id=NULL, which wouldn't match session filters.
  // The scope === 'full' check above already enforces access control.
  const tokens = getAccessTokens(null, null);
  const token = tokens.find(t => t.tokenId === req.params.id);

  if (!token) return res.status(404).json({ error: "Token not found" });

  const scopes = getTokenScopes(req.params.id);

  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "view_token",
    resource: `/tokens/${req.params.id}`,
    scope: req.tokenMeta.scope,
    ip: req.ip
  });

  let allowedResources = null;
  try {
    const row = db.prepare('SELECT allowed_resources FROM access_tokens WHERE id = ?').get(req.params.id);
    if (row?.allowed_resources) allowedResources = JSON.parse(row.allowed_resources);
  } catch (_) {}

  res.json({
    data: {
      id: token.tokenId,
      label: token.label,
      description: null,
      scopes: scopes,
      allowedPersonas: token.allowedPersonas || null,
      requiresApproval: !!token.requiresApproval,
      scopeBundle: token.scopeBundle || null,
      allowedResources,
      tokenType: token.tokenType || 'guest',
      isShareable: !!token.isShareable,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      active: !token.revokedAt
    }
  });
});

// Update a token: scopes, requiresApproval, scopeBundle, allowedResources, allowedPersonas.
// Partial updates supported — only fields present in the body are modified.
app.put("/api/v1/tokens/:id", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can update tokens" });

  const { scopes, requiresApproval, scopeBundle, allowedResources, allowedPersonas, label } = req.body;

  // At least one updatable field must be provided
  const hasScopes = scopes !== undefined;
  const hasApproval = requiresApproval !== undefined;
  const hasBundle = scopeBundle !== undefined;
  const hasResources = allowedResources !== undefined;
  const hasPersonas = allowedPersonas !== undefined;
  const hasLabel = typeof label === 'string' && label.length > 0;

  if (!hasScopes && !hasApproval && !hasBundle && !hasResources && !hasPersonas && !hasLabel) {
    return res.status(400).json({ error: "At least one updatable field must be provided" });
  }

  if (hasScopes && !Array.isArray(scopes) && typeof scopes !== 'string') {
    return res.status(400).json({ error: "scopes must be a string or array" });
  }

  const tokens = getAccessTokens();
  const token = tokens.find(t => t.tokenId === req.params.id);
  if (!token) return res.status(404).json({ error: "Token not found" });

  // Security: master tokens cannot have their scope downgraded or require_approval toggled
  // via this endpoint. Use dedicated master-token endpoints for that.
  if (token.tokenType === 'master' || token.scope === 'full') {
    return res.status(400).json({ error: "Master tokens cannot be modified via this endpoint" });
  }

  // Parse scopes only if provided
  let finalScopes = null;
  if (hasScopes) {
    // Block adding service scopes to a published token
    if (token.isShareable) {
      const incomingScopes = Array.isArray(scopes) ? scopes : [scopes];
      const hasServiceScopeIncoming = incomingScopes.some(s => typeof s === 'string' && s.startsWith('services:'));
      if (hasServiceScopeIncoming) {
        return res.status(400).json({ error: 'Cannot add service scopes to a published token. Unpublish it first.' });
      }
    }

    const parsed = [];
    const raw = typeof scopes === 'string' ? [scopes] : scopes;
    for (const scope of raw) {
      if (typeof scope !== 'string') continue;
      const expanded = expandScopeTemplate(scope);
      if (expanded) {
        parsed.push(...expanded);
      } else if (validateScope(scope)) {
        parsed.push(scope);
      } else {
        return res.status(400).json({ error: `Invalid scope: ${scope}` });
      }
    }
    finalScopes = [...new Set(parsed)];
    if (finalScopes.length === 0) {
      return res.status(400).json({ error: "No valid scopes provided" });
    }
  }

  // Validate personas if provided (null clears)
  let personaIds = undefined;
  if (hasPersonas) {
    if (allowedPersonas === null) {
      personaIds = null;
    } else if (Array.isArray(allowedPersonas)) {
      personaIds = allowedPersonas.map(Number).filter(n => !isNaN(n));
      if (personaIds.length === 0) personaIds = null;
    } else {
      return res.status(400).json({ error: "allowedPersonas must be an array or null" });
    }
  }

  // Apply updates. Use the raw better-sqlite3 handle so we can wrap the whole
  // change in a single transaction for atomicity (scope revoke/grant must not
  // be observable partially with the flag-only UPDATE).
  try {
    const rawDb = typeof db.getRawDB === 'function' ? db.getRawDB() : db;
    const applyUpdates = () => {
      if (hasScopes) {
        revokeScopes(req.params.id);
        const insertableScopes = finalScopes.filter(s => !/^services:[a-z0-9_-]+:(read|write|\*)$/.test(s));
        if (insertableScopes.length > 0) {
          grantScopes(req.params.id, insertableScopes);
        }
        db.prepare('UPDATE access_tokens SET scope = ? WHERE id = ?')
          .run(JSON.stringify(finalScopes), req.params.id);
      }

      const sets = [];
      const params = [];
      if (hasApproval) {
        sets.push('requires_approval = ?');
        params.push(requiresApproval ? 1 : 0);
      }
      if (hasBundle) {
        sets.push('scope_bundle = ?');
        params.push(scopeBundle && typeof scopeBundle === 'object' ? JSON.stringify(scopeBundle) : null);
      }
      if (hasResources) {
        sets.push('allowed_resources = ?');
        params.push(allowedResources && typeof allowedResources === 'object' ? JSON.stringify(allowedResources) : null);
      }
      if (hasPersonas) {
        sets.push('allowed_personas = ?');
        params.push(personaIds ? JSON.stringify(personaIds) : null);
      }
      if (hasLabel) {
        sets.push('label = ?');
        params.push(label);
      }
      if (sets.length > 0) {
        params.push(req.params.id);
        db.prepare(`UPDATE access_tokens SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      }
    };

    if (rawDb && typeof rawDb.transaction === 'function') {
      rawDb.transaction(applyUpdates)();
    } else {
      applyUpdates();
    }
  } catch (dbErr) {
    console.error('[PUT /tokens/:id] DB error:', dbErr);
    return res.status(500).json({ error: 'Failed to update token', detail: dbErr.message });
  }

  // If approval was just enabled on a scoped token, invalidate existing approved devices
  // so a freshly-required approval actually gates the next request. Without this,
  // previously-approved fingerprints continue to pass the gate even after the flag flips.
  if (hasApproval && requiresApproval) {
    try {
      db.prepare(
        'UPDATE approved_devices SET revoked_at = ? WHERE token_id = ? AND revoked_at IS NULL'
      ).run(new Date().toISOString(), req.params.id);
    } catch (e) {
      console.error('[PUT /tokens/:id] Failed to revoke approved devices:', e);
    }
  }

  const changed = {};
  if (hasScopes) changed.scopes = finalScopes;
  if (hasApproval) changed.requiresApproval = !!requiresApproval;
  if (hasBundle) changed.scopeBundle = scopeBundle || null;
  if (hasResources) changed.allowedResources = allowedResources || null;
  if (hasPersonas) changed.allowedPersonas = personaIds;
  if (hasLabel) changed.label = label;

  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "update_token",
    resource: `/tokens/${req.params.id}`,
    scope: req.tokenMeta.scope,
    ip: req.ip,
    details: changed
  });

  console.warn(`🔑 SECURITY: Token updated id=${req.params.id} by=${req.tokenMeta.tokenId} fields=${Object.keys(changed).join(',')} ip=${req.ip}`);

  res.json({
    data: {
      id: req.params.id,
      ...changed,
      updatedAt: new Date().toISOString()
    }
  });
});

// List available scopes (requires admin:* or special access)
app.get("/api/v1/scopes", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can list scopes" });

  const scopes = getAllScopes();

  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "list_scopes",
    resource: "/scopes",
    scope: req.tokenMeta.scope,
    ip: req.ip
  });

  res.json({
    data: {
      scopes: scopes,
      templates: {
        readonly:   ['basic', 'professional', 'availability'],
        agent:      ['basic', 'professional', 'knowledge', 'chat', 'skills:read', 'services:read'],
        full_agent: ['basic', 'professional', 'availability', 'personas', 'knowledge', 'chat', 'skills:read', 'skills:write', 'services:read', 'services:write'],
        admin:      ['admin:*']
      }
    }
  });
});

// Regenerate master token (creates a new full-scope master token).
// NOTE: must be registered before /:id/regenerate so "master" is not captured as a token id.
app.post('/api/v1/tokens/master/regenerate', authRateLimit, authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can regenerate master token' });

  try {
    const ownerId = req.tokenMeta.ownerId || 'admin';
    revokeExistingMasterTokens(ownerId);
    const rawToken = 'myapi_' + crypto.randomBytes(32).toString("hex");
    const hash = bcrypt.hashSync(rawToken, 10);
    const tokenId = createAccessToken(hash, ownerId, 'full', 'Master Token', null, null, null, rawToken, 'master');

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'regenerate_master_token',
      resource: '/tokens/master/regenerate',
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { tokenId }
    });

    // Update the session so subsequent GET /auth/me returns the new token (not the revoked one).
    if (req.session) {
      req.session.masterTokenRaw = rawToken;
      req.session.masterTokenId  = tokenId;
      req.session.save?.((err) => { if (err) console.error('[Regenerate] Session save error:', err); });
    }

    // Security: update integrity hash and alert
    try { checkDbIntegrity(); } catch(_) {}
    console.warn(`🔑 SECURITY: Master token regenerated by=${req.tokenMeta.tokenId}, ip=${req.ip}`);

    res.json({ data: { id: tokenId, token: rawToken, scope: 'full' } });
  } catch (error) {
    console.error('Master token regeneration error:', error);
    res.status(500).json({ error: 'Failed to regenerate master token' });
  }
});

// Regenerate token secret (returns a new raw token for the same token id/scopes)
app.post("/api/v1/tokens/:id/regenerate", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can regenerate tokens" });

  const tokens = getAccessTokens();
  const token = tokens.find(t => t.tokenId === req.params.id);
  if (!token) return res.status(404).json({ error: "Token not found" });
  if (token.revokedAt) return res.status(400).json({ error: "Cannot regenerate a revoked token" });

  _tokenCache.clear(); // old raw token is now invalid
  const rawToken = 'myapi_' + crypto.randomBytes(32).toString("hex");
  const hash = bcrypt.hashSync(rawToken, 10);
  const now = new Date().toISOString();

  db.prepare('UPDATE access_tokens SET hash = ? WHERE id = ?').run(hash, req.params.id);

  const scopes = getTokenScopes(req.params.id);

  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "regenerate_token",
    resource: `/tokens/${req.params.id}`,
    scope: req.tokenMeta.scope,
    ip: req.ip,
    details: { scopes }
  });

  res.json({
    data: {
      id: req.params.id,
      token: rawToken,
      scopes,
      regeneratedAt: now,
      expiresAt: token.expiresAt,
      allowedPersonas: token.allowedPersonas || null
    }
  });
});

// Bootstrap a master token for authenticated session users when client has none.
app.post('/api/v1/tokens/master/bootstrap', authenticate, (req, res) => {
  try {
    const ownerId = req?.tokenMeta?.ownerId || req?.session?.user?.id || req?.user?.id;
    if (!ownerId) return res.status(401).json({ error: 'Not authenticated' });

    // Step 1: Session cache hit — validate it's still active
    if (req.session?.masterTokenRaw && req.session?.masterTokenId) {
      const sessionTokenRow = db.prepare('SELECT revoked_at FROM access_tokens WHERE id = ?').get(req.session.masterTokenId);
      if (sessionTokenRow && !sessionTokenRow.revoked_at) {
        return res.json({ data: { id: req.session.masterTokenId, token: req.session.masterTokenRaw, scope: 'full' } });
      }
      // Stale — clear and fall through
      delete req.session.masterTokenRaw;
      delete req.session.masterTokenId;
    }

    // Step 2: Look up the ONE canonical master token from DB (requires encrypted_token to recover raw value)
    const existing = getExistingMasterToken(ownerId);
    if (existing) {
      // Cache in session so future requests skip the DB lookup
      if (req.session) {
        req.session.masterTokenRaw = existing.rawToken;
        req.session.masterTokenId = existing.tokenId;
        req.session.save?.();
      }
      createAuditLog({
        requesterId: req?.tokenMeta?.tokenId || ownerId,
        action: 'bootstrap_master_token',
        resource: '/tokens/master/bootstrap',
        scope: req?.tokenMeta?.scope || 'session',
        ip: req.ip,
        details: { tokenId: existing.tokenId, ownerId, reused: true }
      });
      return res.json({ data: { id: existing.tokenId, token: existing.rawToken, scope: 'full' } });
    }

    // Step 3: No recoverable token found.
    // Revoke ALL active full-scope tokens for this user (including old non-recoverable ones
    // that lack encrypted_token and can never be retrieved again), then create exactly ONE
    // new canonical token. All devices will converge to this token on their next bootstrap.
    revokeExistingMasterTokens(ownerId);

    const rawToken = 'myapi_' + crypto.randomBytes(32).toString('hex');
    const hash = bcrypt.hashSync(rawToken, 10);
    const tokenId = createAccessToken(hash, ownerId, 'full', 'Master Token', null, null, null, rawToken, 'master');

    if (req.session) {
      req.session.masterTokenRaw = rawToken;
      req.session.masterTokenId = tokenId;
      req.session.save?.();
    }

    // Also set the persistent cookie so the dashboard picks it up immediately
    res.cookie('myapi_master_token', rawToken, {
      httpOnly: true,  // Not readable by JS; use GET /api/v1/auth/session-token instead
      secure: secureCookie,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    createAuditLog({
      requesterId: req?.tokenMeta?.tokenId || ownerId,
      action: 'bootstrap_master_token',
      resource: '/tokens/master/bootstrap',
      scope: req?.tokenMeta?.scope || 'session',
      ip: req.ip,
      details: { tokenId, ownerId, reused: false }
    });

    res.json({ data: { id: tokenId, token: rawToken, scope: 'full' } });
  } catch (error) {
    logger.error('Master token bootstrap error', { error: error.message });
    res.status(500).json({ error: 'Failed to bootstrap master token' });
  }
});

// Revoke (delete) a token
app.delete("/api/v1/tokens/:id", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can revoke tokens" });

  // Master tokens can only be changed via POST /tokens/master/regenerate — never deleted directly
  const targetToken = db.prepare("SELECT token_type FROM access_tokens WHERE id = ?").get(req.params.id);
  if (targetToken?.token_type === 'master') {
    return res.status(403).json({ error: "Master tokens cannot be revoked directly. Use POST /api/v1/tokens/master/regenerate to rotate." });
  }

  _tokenCache.clear(); // invalidate all cached tokens on any revocation
  const revoked = revokeAccessToken(req.params.id);
  if (!revoked) return res.status(404).json({ error: "Token not found" });

  // Also revoke all scopes for this token
  revokeScopes(req.params.id);

  // Emit notification
  NotificationService.emitNotification(req.tokenMeta.ownerId, 'token_revoked',
    'Token Revoked',
    `Your access token has been revoked`,
    { relatedEntityType: 'token', relatedEntityId: req.params.id, actionUrl: '/dashboard/access-tokens' }
  ).catch(err => console.error('Notification error:', err));
  NotificationService.logActivity(req.tokenMeta.ownerId, 'token_revoked', 'token', {
    resourceId: req.params.id, actorType: 'user', actorId: req.tokenMeta.ownerId, result: 'success', ipAddress: req.ip,
  });

  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "revoke_token",
    resource: `/tokens/${req.params.id}`,
    scope: req.tokenMeta.scope,
    ip: req.ip
  });
  try {
    createComplianceAuditLog(
      req.headers['x-workspace-id'] || req.workspaceId || 'system',
      req.user?.id ? String(req.user.id) : null,
      'token_revoked', 'token', req.params.id, null,
      req.ip, req.get('user-agent')
    );
  } catch (_) {}

  res.json({ data: { tokenId: req.params.id, revoked: true } });
});

// List all tokens (legacy endpoint with scopes)
app.get("/api/v1/tokens", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can list tokens" });

  // Resolve workspace from middleware context (set for both session and Bearer token
  // auth after the extractWorkspaceContext fix) or fall back to any explicit source.
  const workspaceId = getRequestWorkspaceId(req);

  const userId = getOAuthUserId(req);
  const tokens = getAccessTokens(userId, workspaceId);
  const tokensWithScopes = tokens.map(t => {
    // Merge junction-table scopes (FK-safe) with JSON scope field (includes per-service scopes)
    const junctionScopes = getTokenScopes(t.tokenId);
    let jsonScopes = [];
    try {
      const raw = t.scope;
      if (raw) {
        const parsed = JSON.parse(raw);
        jsonScopes = Array.isArray(parsed) ? parsed : (typeof parsed === 'string' ? [parsed] : []);
      }
    } catch {}
    const allScopes = [...new Set([...junctionScopes, ...jsonScopes])];
    // Security: never return the bcrypt hash to clients.
    const { hash: _hash, ...safe } = t;
    return {
      ...safe,
      scopes: allScopes,
      allowedPersonas: t.allowedPersonas || null,
      requiresApproval: !!t.requiresApproval,
    };
  });

  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "list_tokens",
    resource: "/tokens",
    scope: req.tokenMeta.scope,
    workspaceId: workspaceId,
    ip: req.ip
  });

  res.json({ data: tokensWithScopes });
});

// Validate token endpoint (for login page)
app.post("/api/v1/tokens/validate", authRateLimit, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token is required" });

  const tokens = getAccessTokens();
  let matched = null;

  // Find matching token
  for (const tokenRecord of tokens) {
    if (!tokenRecord.revokedAt && tokenRecord.hash && await bcrypt.compare(token, tokenRecord.hash).catch(() => false)) {
      matched = tokenRecord;
      break;
    }
  }

  if (!matched) {
    createAuditLog({
      requesterId: "unknown",
      action: "token_validation_failed",
      resource: "/tokens/validate",
      ip: req.ip
    });
    return res.status(401).json({ error: "Invalid token" });
  }

  createAuditLog({
    requesterId: matched.tokenId,
    action: "token_validated",
    resource: "/tokens/validate",
    scope: matched.scope,
    ip: req.ip
  });

  // Return minimal safe info
  res.json({
    data: {
      valid: true,
      tokenId: matched.tokenId,
      scope: matched.scope,
      label: matched.label
    }
  });
});

const BILLING_PLANS = {
  free: {
    id: 'free',
    name: 'Starter',
    price_cents: 1000,
    priceMonthly: 10, // deprecated, kept for backwards compat
    description: 'Perfect for personal use and getting started.',
    features: [
      '2 AI Personas',
      '3 Service Connections',
      '10 MB Knowledge Base',
      '5 Token Vault entries',
      'Attach up to 4 Skills per Persona',
      '1,000 API calls/month',
      'Up to 2 team members'
    ],
    monthlyApiCallLimit: 1000,
    maxServices: 3,
    maxTeamMembers: 2,
    maxSkillsPerPersona: 4,
    stripe_product_id: process.env.STRIPE_PRODUCT_ID_STARTER_LIVE || 'prod_UE1qwjLE5Sfyqs',
    stripePriceId: process.env.STRIPE_PRICE_ID_STARTER_LIVE,
    stripePaymentLinkEnv: 'STRIPE_PAYMENT_LINK_STARTER',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price_cents: 2900,
    priceMonthly: 29, // deprecated, kept for backwards compat
    description: 'For creators and small teams',
    features: [
      '5 AI Personas',
      'Unlimited Service Connections',
      '50 MB Knowledge Base',
      'Unlimited Token Vault entries',
      'Attach unlimited Skills per Persona',
      '100,000 API calls/month',
      'Up to 10 team members',
      'AFP — API File Protocol (remote file & shell operations)',
      'Priority support'
    ],
    monthlyApiCallLimit: 100000,
    maxServices: -1, // unlimited
    maxTeamMembers: 10,
    maxSkillsPerPersona: -1, // unlimited
    stripe_product_id: process.env.STRIPE_PRODUCT_ID_PRO_LIVE || 'prod_pro_myapi',
    stripePriceId: process.env.STRIPE_PRICE_ID_PRO_LIVE,
    stripePaymentLinkEnv: 'STRIPE_PAYMENT_LINK_PRO',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price_cents: 9900,
    priceMonthly: 99, // deprecated, kept for backwards compat
    description: 'Scale with higher limits and custom support',
    features: [
      '20 AI Personas',
      'Unlimited Service Connections',
      '200 MB Knowledge Base',
      'Unlimited Token Vault entries',
      'Attach unlimited Skills per Persona',
      'Unlimited API calls/month',
      'Unlimited team members',
      'AFP — API File Protocol (remote file & shell operations)',
      'Priority 24/7 support',
      'Custom SLA & onboarding',
      'Dedicated infrastructure option'
    ],
    monthlyApiCallLimit: -1, // unlimited
    maxServices: -1, // unlimited
    maxTeamMembers: -1, // unlimited
    maxSkillsPerPersona: -1, // unlimited
    stripe_product_id: process.env.STRIPE_PRODUCT_ID_ENTERPRISE_LIVE || 'prod_enterprise_myapi',
    stripePriceId: process.env.STRIPE_PRICE_ID_ENTERPRISE_LIVE,
    stripePaymentLinkEnv: 'STRIPE_PAYMENT_LINK_ENTERPRISE',
  },
};

const PLAN_ENFORCEMENT_ENABLED = process.env.NODE_ENV === 'test'
  ? false
  : process.env.ENFORCE_PLAN_LIMITS !== 'false';

const PLAN_LIMITS = {
  free: {
    personas: 2,
    serviceConnections: 3,
    knowledgeBytes: 10 * 1024 * 1024, // 10 MB
    vaultTokens: 5,
    skillsPerPersona: 4,
    monthlyApiCalls: 1000,
    teamMembers: 2,
  },
  pro: {
    personas: 5,
    serviceConnections: Infinity,
    knowledgeBytes: 50 * 1024 * 1024, // 50 MB
    vaultTokens: Infinity,
    skillsPerPersona: Infinity,
    monthlyApiCalls: 100000,
    teamMembers: 10,
  },
  enterprise: {
    personas: 20,
    serviceConnections: Infinity,
    knowledgeBytes: 200 * 1024 * 1024, // 200 MB
    vaultTokens: Infinity,
    skillsPerPersona: Infinity,
    monthlyApiCalls: Infinity,
    teamMembers: Infinity,
  },
};

function resolveRequesterPlan(req) {
  try {
    // Check user's directly-assigned plan first (set via User Management UI)
    if (req?.user?.id) {
      const user = getUserById(req.user.id);
      if (user?.plan && BILLING_PLAN_LIMITS[String(user.plan).toLowerCase()]) return String(user.plan).toLowerCase();
    }

    const ownerId = req?.tokenMeta?.ownerId;
    if (ownerId && ownerId !== 'owner') {
      const owner = getUserById(ownerId);
      if (owner?.plan && BILLING_PLAN_LIMITS[String(owner.plan).toLowerCase()]) return String(owner.plan).toLowerCase();
    }

    // Fall back to workspace billing subscription
    const workspaceId = getRequestWorkspaceId(req);
    if (workspaceId) {
      const sub = getBillingSubscriptionByWorkspace(workspaceId);
      return resolveWorkspaceCurrentPlan(sub).id;
    }

    return 'free';
  } catch {
    return 'free';
  }
}

function planLimitError(plan, key, limit) {
  const labels = {
    personas: 'persona limit',
    serviceConnections: 'service connection limit',
    knowledgeBytes: 'knowledge base storage limit',
    vaultTokens: 'vault token limit',
    skillsPerPersona: 'skills-per-persona limit',
  };
  return {
    error: `Plan limit reached: ${labels[key] || key}`,
    plan,
    limit,
    upgradeHint: 'Upgrade your plan to increase limits',
  };
}

function enforcePlanLimit(req, key, currentValue, increment = 0) {
  if (!PLAN_ENFORCEMENT_ENABLED) return null;
  const plan = resolveRequesterPlan(req);
  const limit = PLAN_LIMITS?.[plan]?.[key];
  if (limit === undefined || limit === null || limit === Infinity) return null;
  if ((currentValue + increment) > limit) {
    return planLimitError(plan, key, limit);
  }
  return null;
}

function getKnowledgeBaseBytesUsed(req) {
  const ownerId = getRequestOwnerId(req);
  const rows = db.prepare('SELECT content FROM kb_documents WHERE owner_id = ?').all(ownerId);
  return rows.reduce((sum, row) => sum + Buffer.byteLength(String(row.content || ''), 'utf8'), 0);
}

// --- PLAN DOWNGRADE PREVIEW ---
app.post('/api/v1/billing/downgrade-preview', authenticate, (req, res) => {
  try {
    const { newPlan } = req.body || {};
    const newPlanId = String(newPlan || '').toLowerCase();
    const newPlanDef = BILLING_PLANS[newPlanId];
    if (!newPlanDef) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const ownerId = getRequestOwnerId(req);
    const currentPlanId = String(resolveRequesterPlan(req) || 'free').toLowerCase();
    const currentPlanDef = BILLING_PLANS[currentPlanId] || BILLING_PLANS.free;

    if (!currentPlanDef) {
      return res.status(400).json({ error: 'Unable to determine current plan' });
    }

    // If upgrading (higher or equal limits), no preview needed
    // Handle unlimited (-1) case: unlimited is always "higher"
    const currentMax = currentPlanDef.maxServices === -1 ? Infinity : currentPlanDef.maxServices;
    const newMax = newPlanDef.maxServices === -1 ? Infinity : newPlanDef.maxServices;
    if (currentMax <= newMax) {
      return res.json({ isDowngrade: false, preview: null });
    }

    // Calculate what would be deleted
    const preview = { isDowngrade: true, toDelete: {} };

    // Check personas (Free: 2, Pro: 5, Enterprise: 20)
    const personas = db.prepare('SELECT id, created_at FROM personas WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId);
    const maxPersonas = newPlanId === 'free' ? 2 : (newPlanId === 'pro' ? 5 : -1);
    if (maxPersonas > 0 && personas.length > maxPersonas) {
      const toDelete = personas.length - maxPersonas;
      preview.toDelete.personas = {
        count: toDelete,
        message: `Will keep oldest ${maxPersonas}, delete ${toDelete} newest`
      };
    }

    // Check service connections (Free: 3, Pro: unlimited, Enterprise: unlimited)
    const services = db.prepare(`
      SELECT id, service_name, created_at FROM oauth_tokens WHERE user_id = ? ORDER BY created_at DESC
    `).all(ownerId);
    if (newPlanDef.maxServices > 0 && services.length > newPlanDef.maxServices) {
      const toDelete = services.length - newPlanDef.maxServices;
      preview.toDelete.services = {
        count: toDelete,
        message: `Will keep oldest ${newPlanDef.maxServices}, delete ${toDelete} newest services`
      };
    }

    return res.json(preview);
  } catch (error) {
    console.error('Downgrade preview error:', error);
    return res.status(500).json({ error: 'Failed to generate downgrade preview' });
  }
});

// --- PLAN DOWNGRADE CONFIRM (executes deletion) ---
app.post('/api/v1/billing/downgrade-confirm', authenticate, async (req, res) => {
  try {
    const { newPlan, confirmed } = req.body || {};
    if (!confirmed) {
      return res.status(400).json({ error: 'Downgrade must be confirmed' });
    }

    const newPlanId = String(newPlan || '').toLowerCase();
    const newPlanDef = BILLING_PLANS[newPlanId];
    if (!newPlanDef) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const ownerId = getRequestOwnerId(req);
    const currentPlanId = String(resolveRequesterPlan(req) || 'free').toLowerCase();
    const currentPlanDef = BILLING_PLANS[currentPlanId] || BILLING_PLANS.free;

    // Verify this is actually a downgrade
    // Handle unlimited (-1) case: unlimited is always "higher"
    const currentMax = currentPlanDef.maxServices === -1 ? Infinity : currentPlanDef.maxServices;
    const newMax = newPlanDef.maxServices === -1 ? Infinity : newPlanDef.maxServices;
    console.log(`[Downgrade Confirm] currentPlan=${currentPlanId}, newPlan=${newPlanId}, currentMax=${currentMax}, newMax=${newMax}, isUpgrade=${currentMax <= newMax}`);
    if (currentMax <= newMax) {
      return res.status(400).json({ error: 'This is not a downgrade' });
    }

    const downgradeRawDb = db.getRawDB ? db.getRawDB() : db;
    downgradeRawDb.transaction(() => {
      // Delete excess personas (keep oldest)
      const maxPersonas = newPlanId === 'free' ? 2 : (newPlanId === 'pro' ? 5 : -1);
      if (maxPersonas > 0) {
        const personas = downgradeRawDb.prepare('SELECT id FROM personas WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId);
        if (personas.length > maxPersonas) {
          const toDelete = personas.slice(0, personas.length - maxPersonas).map(p => p.id);
          for (const id of toDelete) {
            downgradeRawDb.prepare('DELETE FROM persona_documents WHERE persona_id = ?').run(id);
            downgradeRawDb.prepare('DELETE FROM persona_skills WHERE persona_id = ?').run(id);
            downgradeRawDb.prepare('DELETE FROM personas WHERE id = ?').run(id);
          }
        }
      }

      // Delete excess service connections (keep oldest)
      if (newPlanDef.maxServices > 0) {
        const services = downgradeRawDb.prepare('SELECT id FROM oauth_tokens WHERE user_id = ? ORDER BY created_at DESC').all(ownerId);
        if (services.length > newPlanDef.maxServices) {
          const toDelete = services.slice(0, services.length - newPlanDef.maxServices).map(s => s.id);
          for (const id of toDelete) {
            downgradeRawDb.prepare('DELETE FROM oauth_tokens WHERE id = ?').run(id);
          }
        }
      }

      // Update user's plan
      downgradeRawDb.prepare('UPDATE users SET plan = ? WHERE id = ?').run(newPlanId, req.user?.id || ownerId);

      // Update workspace subscription
      const workspaceId = getRequestWorkspaceId(req);
      if (workspaceId) {
        upsertBillingSubscription(workspaceId, {
          stripe_subscription_id: `manual_downgrade_${Date.now()}`,
          plan_id: newPlanId,
          status: 'active',
        });
      }
    })();

    // Cancel Stripe subscription if downgrading from paid plan to lower/free plan
    const paidPlans = ['pro', 'enterprise'];
    if (paidPlans.includes(currentPlanId) && (newPlanId === 'free' || (currentPlanId === 'enterprise' && newPlanId === 'pro'))) {
      try {
        const stripe = getStripeClient();
        const workspaceId = getRequestWorkspaceId(req);
        const sub = getBillingSubscriptionByWorkspace(workspaceId);
        if (sub && sub.stripe_subscription_id && !sub.stripe_subscription_id.includes('manual')) {
          await stripe.subscriptions.cancel(sub.stripe_subscription_id);
          console.log(`[Downgrade] Cancelled Stripe subscription ${sub.stripe_subscription_id} (${currentPlanId} → ${newPlanId})`);
        }
      } catch (err) {
        console.error('[Downgrade] Failed to cancel Stripe subscription:', err.message);
        // Don't fail the whole downgrade if Stripe cancellation fails
      }
    }

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'downgrade_plan',
      resource: `/billing/plans`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { fromPlan: currentPlanId, toPlan: newPlanId }
    });

    return res.json({ ok: true, message: `Downgraded to ${newPlanId}. Excess items deleted. Stripe subscription cancelled.` });
  } catch (error) {
    console.error('Downgrade confirm error:', error);
    return res.status(500).json({ error: 'Failed to process downgrade' });
  }
});

// --- BILLING / STRIPE CHECKOUT + USAGE ---
app.post('/api/v1/billing/checkout', authenticate, async (req, res) => {
  try {
    const { plan } = req.body || {};
    const selectedPlan = String(plan || '').toLowerCase().trim();
    const definition = BILLING_PLANS[selectedPlan];
    if (!definition) {
      return res.status(400).json({ error: `Invalid plan. Allowed: ${Object.keys(BILLING_PLANS).join(', ')}` });
    }

    if (betaMode.isBetaMode() && selectedPlan !== 'free') {
      return res.status(403).json({
        error: 'Paid plans are not available during beta. Ask in Discord for access.',
        code: 'BETA_PLAN_LOCKED',
        discordUrl: 'https://discord.gg/WPp4sCN4xB',
      });
    }

    const workspaceId = getRequestWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Workspace context is required' });

    if (!isStripeConfigured()) {
      upsertBillingSubscription(workspaceId, {
        stripe_subscription_id: `mock_sub_${Date.now()}`,
        plan_id: selectedPlan,
        status: 'active',
      });
      return res.status(200).json({
        provider: 'mock',
        plan: selectedPlan,
        message: 'Billing is not configured (missing STRIPE_SECRET_KEY).',
      });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(503).json({ error: 'Billing configured but Stripe SDK unavailable' });
    }

    const ownerEmail = String(req?.user?.email || req?.session?.user?.email || '').trim() || null;
    let customer = getBillingCustomerByWorkspace(workspaceId);
    if (!customer) {
      const created = await stripe.customers.create({ email: ownerEmail || undefined, metadata: { workspace_id: workspaceId } });
      customer = upsertBillingCustomer(workspaceId, created.id, ownerEmail);
    }

    // During beta, Starter (free) is complimentary — activate without payment
    if (selectedPlan === 'free' && betaMode.isBetaMode()) {
      upsertBillingSubscription(workspaceId, {
        stripe_subscription_id: `beta_starter_${Date.now()}`,
        plan_id: 'free',
        status: 'active',
      });
      return res.json({
        url: null,
        plan: 'free',
        provider: 'stripe',
        message: 'Starter plan activated (free during beta)'
      });
    }

    // For paid plans, create a Stripe Checkout Session
    const priceId = definition.stripePriceId;
    if (!priceId) {
      return res.status(400).json({ error: `No price configured for ${selectedPlan} plan` });
    }

    const baseUrl = process.env.BASE_URL || 'https://www.myapiai.com';
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer: customer.stripe_customer_id,
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: `${baseUrl}/dashboard/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/?checkout=canceled`,
      metadata: {
        workspace_id: workspaceId,
        plan: selectedPlan,
      },
    });

    return res.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      plan: selectedPlan,
      provider: 'stripe',
      customerId: customer?.stripe_customer_id || null,
    });
  } catch (error) {
    console.error('Stripe checkout init error:', error);
    return res.status(500).json({ error: 'Failed to initialize checkout' });
  }
});

app.get('/api/v1/billing/current', authenticate, (req, res) => {
  const workspaceId = getRequestWorkspaceId(req);
  if (!workspaceId) return res.status(400).json({ error: 'Workspace context is required' });

  const subscription = getBillingSubscriptionByWorkspace(workspaceId);
  const plan = resolveWorkspaceCurrentPlan(subscription);

  // When no workspace subscription exists, honour the user's directly-assigned plan
  let effectivePlanId = plan.id;
  if (!subscription) {
    const userId = req?.user?.id || req?.tokenMeta?.ownerId;
    if (userId && userId !== 'owner') {
      const user = getUserById(userId);
      if (user?.plan && BILLING_PLAN_LIMITS[String(user.plan).toLowerCase()]) {
        effectivePlanId = String(user.plan).toLowerCase();
      }
    }
  }

  // Include the plan's limits and features so the frontend can show them
  const planDef = BILLING_PLANS[effectivePlanId] || BILLING_PLANS.free;
  const planLimits = PLAN_LIMITS[effectivePlanId] || PLAN_LIMITS.free;

  res.json({
    data: {
      workspaceId,
      plan: effectivePlanId,
      status: subscription?.status || 'active',
      subscription: subscription ? {
        stripeSubscriptionId: subscription.stripe_subscription_id,
        periodStart: subscription.period_start,
        periodEnd: subscription.period_end,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      } : null,
      billingConfigured: isStripeConfigured(),
      features: planDef.features || [],
      limits: {
        personas: planLimits.personas,
        serviceConnections: planLimits.serviceConnections === Infinity ? null : planLimits.serviceConnections,
        knowledgeBytes: planLimits.knowledgeBytes === Infinity ? null : planLimits.knowledgeBytes,
        vaultTokens: planLimits.vaultTokens === Infinity ? null : planLimits.vaultTokens,
        skillsPerPersona: planLimits.skillsPerPersona === Infinity ? null : planLimits.skillsPerPersona,
        monthlyApiCalls: planLimits.monthlyApiCalls === Infinity ? null : planLimits.monthlyApiCalls,
        teamMembers: planLimits.teamMembers === Infinity ? null : planLimits.teamMembers,
      },
    },
  });
});

app.get('/api/v1/billing/invoices', authenticate, (req, res) => {
  const workspaceId = getRequestWorkspaceId(req);
  if (!workspaceId) return res.status(400).json({ error: 'Workspace context is required' });
  const invoices = listInvoicesByWorkspace(workspaceId, Number(req.query.limit || 50));
  res.json({
    data: invoices.map((inv) => ({
      stripeInvoiceId: inv.stripe_invoice_id,
      amountCents: inv.amount_cents,
      currency: inv.currency,
      status: inv.status,
      invoiceUrl: inv.invoice_url,
      createdAt: inv.created_at,
    })),
  });
});

app.get('/api/v1/billing/usage', billingUsageRateLimit, authenticate, (req, res) => {
  const workspaceId = getRequestWorkspaceId(req);
  if (!workspaceId) return res.status(400).json({ error: 'Workspace context is required' });

  const days = getRangeDays(req.query.range);
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - (days - 1));
  const fromDate = from.toISOString().slice(0, 10);
  const toDate = now.toISOString().slice(0, 10);

  const rows = getUsageDaily(workspaceId, fromDate, toDate);
  const totals = rows.reduce((acc, row) => ({
    monthlyApiCalls: acc.monthlyApiCalls + Number(row.api_calls || 0),
    installs: acc.installs + Number(row.installs || 0),
    ratings: acc.ratings + Number(row.ratings || 0),
    activeServices: Math.max(acc.activeServices, Number(row.active_services || 0)),
  }), { monthlyApiCalls: 0, installs: 0, ratings: 0, activeServices: 0 });

  // Resolve effective plan (honour user's directly-assigned plan when no subscription)
  const subscription = getBillingSubscriptionByWorkspace(workspaceId);
  let effectivePlan = resolveWorkspaceCurrentPlan(subscription);
  if (!subscription) {
    const userId = req?.user?.id || req?.tokenMeta?.ownerId;
    if (userId && userId !== 'owner') {
      const user = getUserById(userId);
      if (user?.plan && BILLING_PLAN_LIMITS[String(user.plan).toLowerCase()]) {
        effectivePlan = BILLING_PLAN_LIMITS[String(user.plan).toLowerCase()];
      }
    }
  }

  const usageVsLimits = computeUsageVsLimits(effectivePlan, totals);

  // Collect real-time resource counts
  const ownerId = getRequestOwnerId(req);
  const planLimits = PLAN_LIMITS[effectivePlan.id] || PLAN_LIMITS.free;
  let resourceCounts;
  try {
    const personaCount = getPersonas(ownerId, workspaceId).length;
    const vaultTokenCount = getVaultTokens(ownerId, workspaceId).length;
    const serviceCount = countConnectedOAuthServices(ownerId);
    const memberCount = getWorkspaceMembers(workspaceId).length;

    const kbRows = db.prepare('SELECT content FROM kb_documents WHERE owner_id = ?').all(ownerId);
    const kbBytesUsed = kbRows.reduce((sum, row) => sum + Buffer.byteLength(String(row.content || ''), 'utf8'), 0);

    const makeResourceMetric = (used, limit) => {
      const unlimited = limit === Infinity || limit === null || limit === undefined;
      const numLimit = unlimited ? null : limit;
      const ratio = unlimited ? 0 : (numLimit > 0 ? Math.min(1, used / numLimit) : 0);
      return {
        used,
        limit: numLimit,
        unlimited,
        ratio,
        remaining: unlimited ? null : Math.max(0, numLimit - used),
        exceeded: unlimited ? false : used > numLimit,
      };
    };

    resourceCounts = {
      personas: makeResourceMetric(personaCount, planLimits.personas),
      serviceConnections: makeResourceMetric(serviceCount, planLimits.serviceConnections),
      knowledgeBytes: makeResourceMetric(kbBytesUsed, planLimits.knowledgeBytes),
      vaultTokens: makeResourceMetric(vaultTokenCount, planLimits.vaultTokens),
      teamMembers: makeResourceMetric(memberCount, planLimits.teamMembers),
    };
  } catch (err) {
    console.error('[Billing] Error computing resource counts:', err);
    resourceCounts = {};
  }

  res.json({
    data: {
      workspaceId,
      range: `${days}d`,
      totals,
      daily: rows,
      limits: usageVsLimits.metrics,
      resources: resourceCounts,
    },
  });
});

app.post('/api/v1/billing/portal', authenticate, async (req, res) => {
  const workspaceId = getRequestWorkspaceId(req);
  if (!workspaceId) return res.status(400).json({ error: 'Workspace context is required' });

  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Billing is not configured', billingConfigured: false });
  }

  try {
    const customer = getBillingCustomerByWorkspace(workspaceId);
    if (!customer?.stripe_customer_id) {
      return res.status(404).json({ error: 'No billing customer found for workspace' });
    }
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${req.protocol}://${req.get('host')}/dashboard/settings`,
    });
    res.json({ data: { url: session.url } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

// Stripe webhook handler is registered early in the file (before express.json) for raw body access.

// --- CONNECTORS ---
app.get("/api/v1/connectors", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Insufficient scope" });
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "list_connectors", resource: "/connectors", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: getConnectors() });
});

app.post("/api/v1/connectors", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Insufficient scope" });
  const { type, config, label } = req.body;
  if (!type || !label) return res.status(400).json({ error: "type and label are required" });

  const connectorCount = getConnectors().length;
  const connectorLimitErr = enforcePlanLimit(req, 'serviceConnections', connectorCount, 1);
  if (connectorLimitErr) return res.status(403).json(connectorLimitErr);

  const connector = createConnector(type, label, config || {});
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "add_connector", resource: `/connectors/${connector.id}`, scope: req.tokenMeta.scope, ip: req.ip });
  res.status(201).json({ data: connector });
});

// --- GATEWAY CONTEXT ASSEMBLY ---
app.get("/api/v1/gateway/context", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can access gateway context" });

  try {
    const ownerId = getRequestOwnerId(req);

    // Active persona — full soul_content so AI agents know their operating instructions
    const activePersona = getActivePersona(ownerId);
    const persona = activePersona ? {
      id: activePersona.id,
      name: activePersona.name,
      description: activePersona.description || '',
      soul_content: activePersona.soul_content || '',
      active: activePersona.active,
    } : null;

    // User identity from DB (what the AI needs to know about the person it's serving)
    // Prefer DB user record; fall back to vault.identityDocs for file-based setups
    const dbUser = getUserById(ownerId) || getUserById('owner');
    const vaultIdentity = resolveIdentityForUser(ownerId);
    const userProfile = dbUser ? {
      ...vaultIdentity,  // file-based extras (role, company, etc.) — overridden by DB below
      name: dbUser.displayName || dbUser.username || vaultIdentity.name || 'User',
      email: dbUser.email || vaultIdentity.email || null,
      timezone: dbUser.timezone || vaultIdentity.timezone || null,
      plan: dbUser.plan || 'free',
    } : (Object.keys(vaultIdentity).length > 0 ? vaultIdentity : null);

    // Long-term memory: DB entries (newest first) + MEMORY.md bullets
    const dbMemories = getMemories(ownerId, req.workspaceId || null);
    const fileMemory = contextEngine.loadMemory();

    // Vault tokens (metadata only — never the actual token values)
    const vaultTokens = getVaultTokens().map(t => ({
      id: t.id,
      label: t.label,
      description: t.description,
      createdAt: t.createdAt,
    }));

    // All personas (so AI can switch or reference other personas)
    const allPersonas = getPersonas(ownerId).map(p => ({
      id: p.id,
      name: p.name,
      active: p.active,
      created_at: p.created_at,
    }));

    // Endpoint manifest — every endpoint this token can call, so the AI knows immediately
    // ⚠️ IMPORTANT: All paths below include /api/v1. The base URL is https://www.myapiai.com (NO /api/v1 suffix).
    // Correct: https://www.myapiai.com + /api/v1/skills = https://www.myapiai.com/api/v1/skills
    // Wrong:   https://www.myapiai.com/api/v1 + /api/v1/skills = double-prefix → ROUTE_NOT_FOUND
    const ENDPOINT_MANIFEST = [
      { method: 'GET',    path: '/api/v1/gateway/context',               description: 'Full AI context: persona, identity, memory, endpoints (this endpoint)' },
      { method: 'GET',    path: '/api/v1/brain/context',                 description: 'Assembled LLM system prompt + conversation context', scope: 'knowledge' },
      { method: 'POST',   path: '/api/v1/brain/chat',                    description: 'Send a chat message and get an AI response', scope: 'chat' },
      { method: 'GET',    path: '/api/v1/brain/conversations',           description: 'List past conversations', scope: 'chat' },
      { method: 'GET',    path: '/api/v1/brain/conversations/:id',       description: 'Get a conversation with messages', scope: 'chat' },
      { method: 'GET',    path: '/api/v1/identity',                      description: 'Owner name, role, company', scope: 'basic' },
      { method: 'GET',    path: '/api/v1/identity/professional',         description: 'Skills, education, experience', scope: 'professional' },
      { method: 'GET',    path: '/api/v1/identity/availability',         description: 'Calendar, timezone, availability', scope: 'availability' },
      { method: 'GET',    path: '/api/v1/personas',                      description: 'List all personas', scope: 'personas' },
      { method: 'GET',    path: '/api/v1/personas/:id',                  description: 'Get a specific persona', scope: 'personas' },
      { method: 'GET',    path: '/api/v1/memory',                        description: 'List all memory entries (newest first)', scope: 'memory' },
      { method: 'POST',   path: '/api/v1/memory',                        description: 'Store a new memory entry', scope: 'memory' },
      { method: 'PATCH',  path: '/api/v1/memory/:id',                    description: 'Update a memory entry', scope: 'memory' },
      { method: 'DELETE', path: '/api/v1/memory/:id',                    description: 'Delete a specific memory entry', scope: 'memory' },
      { method: 'DELETE', path: '/api/v1/memory',                        description: 'Clear all memory entries', scope: 'memory' },
      { method: 'GET',    path: '/api/v1/brain/knowledge-base',          description: 'List knowledge base documents', scope: 'knowledge' },
      { method: 'POST',   path: '/api/v1/brain/knowledge-base',          description: 'Create a knowledge base document', scope: 'knowledge' },
      { method: 'POST',   path: '/api/v1/brain/knowledge-base/upsert',   description: 'Create or update a KB document by title', scope: 'knowledge' },
      { method: 'GET',    path: '/api/v1/brain/knowledge-base/:id',      description: 'Get a knowledge base document', scope: 'knowledge' },
      { method: 'PUT',    path: '/api/v1/brain/knowledge-base/:id',      description: 'Update a knowledge base document', scope: 'knowledge' },
      { method: 'GET',    path: '/api/v1/skills',                        description: 'List available skills', scope: 'skills:read' },
      { method: 'GET',    path: '/api/v1/skills/:id',                    description: 'Get skill details', scope: 'skills:read' },
      { method: 'POST',   path: '/api/v1/skills',                        description: 'Create a new skill', scope: 'skills:write' },
      { method: 'PUT',    path: '/api/v1/skills/:id',                    description: 'Update a skill', scope: 'skills:write' },
      { method: 'DELETE', path: '/api/v1/skills/:id',                    description: 'Delete a skill', scope: 'skills:write' },
      { method: 'GET',    path: '/api/v1/services/:service/*',           description: 'Proxy GET to a connected OAuth service', scope: 'services:read' },
      { method: 'POST',   path: '/api/v1/services/:service/*',           description: 'Proxy POST/PUT/DELETE to a connected OAuth service', scope: 'services:write' },
      { method: 'GET',    path: '/api/v1/oauth/status',                  description: 'List all connected OAuth services and their status' },
    ];

    // Per-service usage instructions for connected services — tells AI exactly how to proxy each one
    const SERVICE_INSTRUCTIONS = {
      discord: {
        description: 'Discord — read/write messages and channels via bot token proxy',
        proxy_note: 'All Discord calls go through POST /api/v1/services/discord/proxy with {path, method, body}.',
        auth_note: '/users/@me paths use your OAuth token automatically. /guilds/* and /channels/* use the configured bot token automatically — no extra headers needed.',
        actions: [
          { action: 'List your guilds (servers)',       method: 'GET',  path: '/users/@me/guilds' },
          { action: 'List channels in a server',        method: 'GET',  path: '/guilds/{guild_id}/channels' },
          { action: 'Read messages from a channel',     method: 'GET',  path: '/channels/{channel_id}/messages?limit=50' },
          { action: 'Send a message to a channel',      method: 'POST', path: '/channels/{channel_id}/messages', body: { content: 'your message text' } },
          { action: 'Get your Discord profile',         method: 'GET',  path: '/users/@me' },
        ],
        example: {
          description: 'Send a message to a Discord channel',
          request: { method: 'POST', url: '/api/v1/services/discord/proxy', body: { path: '/channels/{channel_id}/messages', method: 'POST', body: { content: 'Hello from MyApi!' } } },
        },
      },
      github: {
        description: 'GitHub — repos, issues, pull requests, gists',
        proxy_note: 'All GitHub calls go through POST /api/v1/services/github/proxy with {path, method, body}.',
        actions: [
          { action: 'List your repos',              method: 'GET',  path: '/user/repos?per_page=30' },
          { action: 'List issues in a repo',        method: 'GET',  path: '/repos/{owner}/{repo}/issues' },
          { action: 'Create an issue',              method: 'POST', path: '/repos/{owner}/{repo}/issues', body: { title: 'Issue title', body: 'Description' } },
          { action: 'List pull requests',           method: 'GET',  path: '/repos/{owner}/{repo}/pulls' },
          { action: 'Get your profile',             method: 'GET',  path: '/user' },
        ],
      },
      google: {
        description: 'Google — Gmail, Calendar, Drive',
        proxy_note: 'All Google calls go through POST /api/v1/services/google/proxy with {path, method, body}.',
        actions: [
          { action: 'List Gmail messages',          method: 'GET',    path: '/gmail/v1/users/me/messages?maxResults=10' },
          { action: 'Get a Gmail message',          method: 'GET',    path: '/gmail/v1/users/me/messages/{messageId}' },
          { action: 'Send a Gmail message',         method: 'POST',   path: '/api/v1/services/google/gmail/send' },
          { action: 'Trash a Gmail message',        method: 'DELETE', path: '/api/v1/services/google/gmail/messages/{messageId}' },
          { action: 'List calendar events',         method: 'GET',  path: '/calendar/v3/calendars/primary/events?maxResults=10' },
          { action: 'List Drive files',             method: 'GET',  path: '/drive/v3/files?pageSize=10' },
        ],
      },
      slack: {
        description: 'Slack — channels, messages, users',
        proxy_note: 'All Slack calls go through POST /api/v1/services/slack/proxy with {path, method, body}.',
        actions: [
          { action: 'List channels',                method: 'GET',  path: '/conversations.list?limit=20' },
          { action: 'Read channel messages',        method: 'GET',  path: '/conversations.history?channel={channel_id}&limit=20' },
          { action: 'Send a message',               method: 'POST', path: '/chat.postMessage', body: { channel: '{channel_id}', text: 'message' } },
          { action: 'List workspace users',         method: 'GET',  path: '/users.list' },
        ],
      },
      notion: {
        description: 'Notion — pages, databases',
        proxy_note: 'All Notion calls go through POST /api/v1/services/notion/proxy with {path, method, body}.',
        actions: [
          { action: 'Search all pages/databases',   method: 'POST', path: '/search', body: { query: '' } },
          { action: 'List databases',               method: 'POST', path: '/search', body: { filter: { property: 'object', value: 'database' } } },
          { action: 'Query a database',             method: 'POST', path: '/databases/{database_id}/query', body: {} },
          { action: 'Get a page',                   method: 'GET',  path: '/pages/{page_id}' },
        ],
      },
      linkedin: {
        description: 'LinkedIn — profile, posts',
        proxy_note: 'All LinkedIn calls go through POST /api/v1/services/linkedin/proxy with {path, method, body}.',
        actions: [
          { action: 'Get your profile',             method: 'GET',  path: '/me' },
          { action: 'Get profile picture',          method: 'GET',  path: '/me?projection=(id,profilePicture(displayImage~:playableStreams))' },
        ],
      },
      twitter: {
        description: 'Twitter/X — tweets, timeline',
        proxy_note: 'All Twitter calls go through POST /api/v1/services/twitter/proxy with {path, method, body}.',
        actions: [
          { action: 'Get your profile',             method: 'GET',  path: '/users/me' },
          { action: 'Post a tweet',                 method: 'POST', path: '/tweets', body: { text: 'tweet text' } },
          { action: 'Get home timeline',            method: 'GET',  path: '/timelines/home_timeline?max_results=10' },
        ],
      },
      facebook: {
        description: 'Facebook — pages, posts',
        proxy_note: 'All Facebook calls go through POST /api/v1/services/facebook/proxy with {path, method, body}.',
        actions: [
          { action: 'Get your profile',             method: 'GET',  path: '/me?fields=id,name,email' },
          { action: 'List your pages',              method: 'GET',  path: '/me/accounts' },
        ],
      },
      tiktok: {
        description: 'TikTok — user info, videos',
        proxy_note: 'All TikTok calls go through POST /api/v1/services/tiktok/proxy with {path, method, body}.',
        actions: [
          { action: 'Get your profile',             method: 'POST', path: '/v2/user/info/', body: { fields: ['display_name', 'avatar_url', 'follower_count'] } },
        ],
      },
    };

    // Build connected_services: only include services that have an OAuth token stored
    const connectedServiceIds = OAUTH_SERVICES.filter(svcId => {
      try {
        const tok = getCachedOAuthToken(svcId, ownerId) || getOAuthToken(svcId, ownerId);
        return !!tok;
      } catch { return false; }
    });

    const connectedServices = connectedServiceIds.map(svcId => ({
      service: svcId,
      proxy_endpoint: `/api/v1/services/${svcId}/proxy`,
      ...(SERVICE_INSTRUCTIONS[svcId] || {
        description: `${svcId} — connected OAuth service`,
        proxy_note: `All calls go through POST /api/v1/services/${svcId}/proxy with {path, method, body}.`,
      }),
    }));

    const context = {
      timestamp: new Date().toISOString(),
      version: "2.0",
      base_url: `${req.protocol}://${req.get('host')}`,
      base_url_warning: 'All endpoint paths in this response include /api/v1. Do NOT append /api/v1 to base_url when constructing request URLs. Correct: base_url + /api/v1/skills. Wrong: base_url + /api/v1 + /api/v1/skills (double-prefix causes ROUTE_NOT_FOUND).',
      // Who this AI is — full soul_content so it can set its own instructions
      persona,
      // Who the AI is serving — full identity from the database
      user: userProfile,
      // Long-term memory: structured DB entries + legacy MEMORY.md bullets
      memory: dbMemories.map(m => ({ id: m.id, content: m.content, created_at: m.created_at })),
      memory_legacy: fileMemory.memories || [],
      // Connected services with per-service usage instructions
      connected_services: connectedServices,
      // Connected services metadata (no credentials)
      vault: { tokens: vaultTokens },
      // All available personas
      personas: allPersonas,
      // Every endpoint this token can call
      endpoints: ENDPOINT_MANIFEST,
      meta: {
        requesterId: req.tokenMeta.tokenId,
        ownerId,
        activePersonaId: activePersona?.id ?? null,
      },
    };

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: "gateway_context_fetch",
      resource: "/gateway/context",
      scope: req.tokenMeta.scope,
      ip: req.ip,
    });

    res.json({ data: context });
  } catch (error) {
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: "gateway_context_fetch_error",
      resource: "/gateway/context",
      error: error.message,
      scope: req.tokenMeta.scope,
      ip: req.ip,
    });
    res.status(500).json({ error: "Failed to assemble gateway context" });
  }
});

// --- AUDIT LOG ---
app.get("/api/v1/audit", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can view audit log" });
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  const offset = (page - 1) * limit;
  const { logs, total } = getAuditLogs(limit, offset);
  res.json({ data: logs, meta: { total, page, limit } });
});

// ============================
// TOKEN SHARING (Guest Tokens)
// ============================

// POST /api/v1/tokens/:id/make-shareable - Publish a token to marketplace
app.post('/api/v1/tokens/:id/make-shareable', authenticate, (req, res) => {
  try {
    const tokenId = req.params.id;
    const { scopePersonaId, description } = req.body;
    
    const ownerId = req.tokenMeta?.ownerId || req.session?.user?.id;
    if (!ownerId) return res.status(401).json({ error: 'Not authenticated' });

    // Get token to verify ownership
    const token = db.prepare('SELECT * FROM access_tokens WHERE id = ? AND owner_id = ?').get(tokenId, ownerId);
    if (!token) return res.status(404).json({ error: 'Token not found' });
    if (token.revoked_at) return res.status(400).json({ error: 'Cannot share a revoked token' });
    if (token.is_shareable) return res.status(400).json({ error: 'Token is already being shared' });

    // Block master tokens from being published
    if (token.token_type === 'master') {
      return res.status(400).json({ error: 'Master tokens cannot be published to the marketplace' });
    }

    // Block publishing tokens that include service scopes (they proxy real OAuth credentials)
    let tokenScopes = [];
    try { tokenScopes = JSON.parse(token.scope) || []; } catch { tokenScopes = token.scope ? token.scope.split(',') : []; }
    const hasServiceScope = tokenScopes.some(s => s === 'services:read' || s === 'services:write' || s.startsWith('services:'));
    if (hasServiceScope) {
      return res.status(400).json({ error: 'Tokens with service scopes cannot be published to the marketplace' });
    }

    // Create marketplace listing for this token — enrich with resolved metadata
    const now = new Date().toISOString();

    // Resolve owner display name
    const ownerUser = getUserById(ownerId);
    const ownerDisplayName = ownerUser?.displayName || ownerUser?.username || ownerUser?.name || null;

    // Parse scope_bundle to detect persona/bundle
    let parsedBundle = null;
    try { parsedBundle = token.scope_bundle ? JSON.parse(token.scope_bundle) : null; } catch {}

    // Resolve persona info if bundle
    let personaInfo = null;
    if (parsedBundle?.persona_id) {
      try {
        const p = db.prepare('SELECT id, name, description FROM personas WHERE id = ?').get(parsedBundle.persona_id);
        if (p) personaInfo = { id: p.id, name: p.name, description: p.description };
      } catch {}
    }

    // Resolve allowed_resources info
    let allowedResources = null;
    try { allowedResources = token.allowed_resources ? JSON.parse(token.allowed_resources) : null; } catch {}

    const isBundle = !!(parsedBundle?.persona_id && (tokenScopes.includes('knowledge') || tokenScopes.includes('skills:read')));

    const listingTitle = token.label;
    const listingDescription = description || token.description || '';

    const contentPayload = {
      token_id: tokenId,
      token_label: token.label,
      token_description: token.description || null,
      scopes: tokenScopes,
      scope_bundle: parsedBundle,
      is_bundle: isBundle,
      persona: personaInfo,
      allowed_resources: allowedResources,
      expires_at: token.expires_at,
      requires_approval: !!token.requires_approval,
      owner_display_name: ownerDisplayName,
    };

    // Reactivate existing listing if one exists from a previous publish cycle
    let listingId = token.marketplace_listing_id;
    const existingListing = listingId
      ? db.prepare('SELECT id FROM marketplace_listings WHERE id = ?').get(listingId)
      : null;

    if (existingListing) {
      db.prepare(`
        UPDATE marketplace_listings SET status = 'active', title = ?, description = ?, content = ?, updated_at = ?
        WHERE id = ?
      `).run(listingTitle, listingDescription, JSON.stringify(contentPayload), now, listingId);
    } else {
      const listingResult = db.prepare(`
        INSERT INTO marketplace_listings (owner_id, type, title, description, content, status, created_at, updated_at)
        VALUES (?, 'token', ?, ?, ?, 'active', ?, ?)
      `).run(ownerId, listingTitle, listingDescription, JSON.stringify(contentPayload), now, now);
      listingId = listingResult.lastInsertRowid;
    }

    // Update token to mark as shareable
    db.prepare('UPDATE access_tokens SET is_shareable = 1, marketplace_listing_id = ? WHERE id = ?')
      .run(listingId, tokenId);

    createAuditLog({
      requesterId: ownerId,
      action: 'token_make_shareable',
      resource: `/tokens/${tokenId}`,
      scope: req.tokenMeta?.scope || 'session',
      ip: req.ip,
      details: { listingId, scopePersonaId }
    });

    res.json({
      data: {
        tokenId,
        listingId,
        title: listingTitle,
        description: listingDescription,
        shareableAt: now
      }
    });
  } catch (err) {
    console.error('[Token Sharing] make-shareable error:', err);
    res.status(500).json({ error: 'Failed to make token shareable' });
  }
});

// POST /api/v1/tokens/:id/unpublish - Remove token from marketplace
app.post('/api/v1/tokens/:id/unpublish', authenticate, (req, res) => {
  try {
    const tokenId = req.params.id;
    const ownerId = req.tokenMeta?.ownerId || req.session?.user?.id;
    if (!ownerId) return res.status(401).json({ error: 'Not authenticated' });

    // Get token
    const token = db.prepare('SELECT * FROM access_tokens WHERE id = ? AND owner_id = ?').get(tokenId, ownerId);
    if (!token) return res.status(404).json({ error: 'Token not found' });
    if (!token.is_shareable) return res.status(400).json({ error: 'Token is not being shared' });

    const listingId = token.marketplace_listing_id;

    // Deactivate marketplace listing
    if (listingId) {
      db.prepare('UPDATE marketplace_listings SET status = ? WHERE id = ?').run('inactive', listingId);
    }

    // Update token — keep marketplace_listing_id so republishing reactivates the same listing
    db.prepare('UPDATE access_tokens SET is_shareable = 0 WHERE id = ?').run(tokenId);

    createAuditLog({
      requesterId: ownerId,
      action: 'token_unpublish',
      resource: `/tokens/${tokenId}`,
      scope: req.tokenMeta?.scope || 'session',
      ip: req.ip,
      details: { listingId }
    });

    res.json({ data: { tokenId, unpublishedAt: new Date().toISOString() } });
  } catch (err) {
    console.error('[Token Sharing] unpublish error:', err);
    res.status(500).json({ error: 'Failed to unpublish token' });
  }
});

// GET /api/v1/vault/my-tokens - Get user's tokens (including guest tokens)
app.get('/api/v1/vault/my-tokens', authenticate, (req, res) => {
  try {
    const ownerId = req.tokenMeta?.ownerId || req.session?.user?.id;
    if (!ownerId) return res.status(401).json({ error: 'Not authenticated' });

    // Get all tokens for this user
    const tokens = db.prepare(`
      SELECT id, label, scope, created_at, is_shareable, is_guest_token, source_token_id, marketplace_listing_id, read_only
      FROM access_tokens 
      WHERE owner_id = ? AND revoked_at IS NULL
      ORDER BY created_at DESC
    `).all(ownerId);

    // Separate into user's tokens and guest tokens installed
    const yourTokens = tokens.filter(t => !t.is_guest_token).map(t => ({
      ...t,
      type: 'own',
      isPublished: t.is_shareable ? true : false,
      listingId: t.marketplace_listing_id
    }));

    const guestTokens = tokens.filter(t => t.is_guest_token).map(t => ({
      ...t,
      type: 'guest',
      sourceTokenId: t.source_token_id,
      readOnly: t.read_only ? true : false
    }));

    res.json({
      data: {
        yourTokens,
        guestTokens,
        summary: {
          yourTokensCount: yourTokens.length,
          guestTokensCount: guestTokens.length
        }
      }
    });
  } catch (err) {
    console.error('[Token Sharing] my-tokens error:', err);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

// DELETE /api/v1/vault/:tokenId/revoke - Revoke a guest token
app.delete('/api/v1/vault/:tokenId/revoke', authenticate, (req, res) => {
  try {
    const tokenId = req.params.tokenId;
    const ownerId = req.tokenMeta?.ownerId || req.session?.user?.id;
    if (!ownerId) return res.status(401).json({ error: 'Not authenticated' });

    // Get token
    const token = db.prepare('SELECT * FROM access_tokens WHERE id = ? AND owner_id = ?').get(tokenId, ownerId);
    if (!token) return res.status(404).json({ error: 'Token not found' });
    if (!token.is_guest_token) return res.status(400).json({ error: 'Can only revoke guest tokens this way' });

    const now = new Date().toISOString();
    _tokenCache.clear();
    db.prepare('UPDATE access_tokens SET revoked_at = ? WHERE id = ?').run(now, tokenId);

    createAuditLog({
      requesterId: ownerId,
      action: 'guest_token_revoke',
      resource: `/tokens/${tokenId}`,
      scope: req.tokenMeta?.scope || 'session',
      ip: req.ip
    });

    res.json({ data: { tokenId, revokedAt: now } });
  } catch (err) {
    console.error('[Token Sharing] revoke error:', err);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

// ============================
// PUBLIC AUTH (Register + Login)
// =============================
app.post("/api/v1/auth/register", authRateLimit, requireBetaSlot, (req, res) => {
  const { username, password, display_name, email, timezone, accepted_terms_at, accepted_privacy_policy_at } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password are required" });

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: "Password must be at least 8 characters and contain 3 of: uppercase, lowercase, number, symbol" });
  }

  try {
    const now = new Date().toISOString();
    const consentTimestamps = {
      acceptedTermsAt: accepted_terms_at || now,
      acceptedPrivacyPolicyAt: accepted_privacy_policy_at || now,
    };
    const user = createUser(username, display_name || username, email, timezone, password, 'free', null, consentTimestamps);
    betaMode.invalidateBetaFullCache();
    createAuditLog({ requesterId: user.id, action: "user_register", resource: `/users/${user.id}`, scope: "public", ip: req.ip });
    res.status(201).json({ data: user });
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

// BUG-15: Add rate limiting to login endpoint to prevent brute force attacks
app.post("/api/v1/auth/login", authRateLimit, async (req, res) => {
  try {
    const { username, email, password, totpCode } = req.body;

    // Support both username and email login
    let user = null;
    if (username) {
      user = getUserByUsername(username);
    } else if (email) {
      user = getUserByEmail(email);
    }

    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password_hash || '').catch(() => false);
    if (!valid) {
      createAuditLog({
        requesterId: 'unknown',
        action: 'failed_login',
        resource: `/auth/login`,
        scope: 'session',
        ip: req.ip,
        details: { username: user.username, reason: 'invalid_credentials' }
      });
      alerting.trackFailedLogin(req.ip);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.twoFactorEnabled) {
      if (!totpCode) {
        return res.status(401).json({ error: "2FA code required", requires2FA: true });
      }
      const verified = speakeasy.totp.verify({
        secret: user.totpSecret,
        encoding: 'base32',
        token: String(totpCode).replace(/\s+/g, ''),
        window: 2,
      });
      if (!verified) {
        createAuditLog({
          requesterId: user.id,
          action: '2fa_failed_attempt',
          resource: '/auth/login',
          scope: 'session',
          ip: req.ip,
          details: { reason: 'invalid_code' }
        });
        alerting.trackFailedLogin(req.ip);
        return res.status(401).json({ error: "Invalid 2FA code", requires2FA: true });
      }
      // Replay protection: reject if this exact code was already used recently
      const totpKey = String(totpCode).replace(/\s+/g, '');
      if (isTotpCodeUsed(user.id, totpKey)) {
        return res.status(401).json({ error: '2FA code already used. Wait for the next code.', requires2FA: true });
      }
      markTotpCodeUsed(user.id, totpKey);
    }

    // Regenerate session and set user
    req.session.regenerate((err) => {
      if (err) {
        console.error('[login] Session regenerate error:', err);
        return res.status(500).json({ error: 'Session error' });
      }

      // Get or create workspace for user
      const workspace = getOrEnsureUserWorkspace(user.id);
      
      // Set session user
      req.session.user = {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        email: user.email,
        avatarUrl: user.avatarUrl || null,
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
        roles: user.roles || 'user',
      };
      
      // Set current workspace
      req.session.currentWorkspace = workspace.id;
      
      // Save session
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('[login] Session save error:', saveErr);
          return res.status(500).json({ error: 'Session error' });
        }

        // SOC2 CC6: Track session, evict oldest if user exceeds max concurrent sessions
        registerUserSession(user.id, req.sessionID);

        createAuditLog({
          requesterId: user.id,
          action: "user_login",
          resource: `/users/${user.id}`,
          scope: "session",
          ip: req.ip
        });

        res.json({
          success: true,
          userId: user.id,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            email: user.email,
            twoFactorEnabled: Boolean(user.twoFactorEnabled)
          }
        });
      });
    });
  } catch (err) {
    console.error('[login] Error:', err);
    res.status(500).json({ error: 'Login error' });
  }
});

// Token-based login (for API access tokens)
app.post("/api/v1/auth/token-login", authRateLimit, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token is required" });

  // Verify token against stored tokens
  const tokens = getAccessTokens();
  let tokenRecord = null;
  for (const t of tokens) {
    if (!t.revokedAt && t.hash && await bcrypt.compare(token, t.hash).catch(() => false)) {
      tokenRecord = t;
      break;
    }
  }

  if (!tokenRecord || tokenRecord.revokedAt) {
    return res.status(401).json({ error: "Invalid or revoked token" });
  }

  // Create session
  const sessionToken = crypto.randomBytes(32).toString('hex');
  if (!global.sessions) global.sessions = {};
  global.sessions[sessionToken] = {
    tokenId: tokenRecord.tokenId,
    ownerId: tokenRecord.ownerId,
    scope: tokenRecord.scope,
    createdAt: Date.now()
  };

  createAuditLog({
    requesterId: tokenRecord.tokenId,
    action: "token_login",
    resource: "/auth/token-login",
    scope: tokenRecord.scope,
    ip: req.ip
  });

  res.json({
    data: {
      sessionToken,
      token: tokenRecord.tokenId,
      scope: tokenRecord.scope,
      message: "Token authentication successful"
    }
  });
});

app.get("/api/v1/auth/me", (req, res) => {
  // Cookie-session auth (OAuth login path)
  if (req.session && req.session.user) {
    const sessionUser = req.session.user;
    // Enrich with full user profile from DB so callers get a complete user object
    const dbUser = sessionUser.id ? getUserById(String(sessionUser.id)) : null;
    const merged = dbUser ? { ...dbUser, ...sessionUser } : sessionUser;
    const normalizedUser = {
      ...merged,
      displayName: merged.displayName || merged.display_name || merged.username || null,
      avatarUrl: merged.avatarUrl || merged.avatar_url || null,
      email: merged.email || null,
    };

    // Keep backward compatibility (flat shape) while exposing canonical user payload.
    return res.json({
      success: true,
      ...normalizedUser,
      user: normalizedUser,
      // SECURITY: Do NOT expose masterToken in plaintext
      // The frontend uses the masterToken from localStorage (set during login/2FA flow)
      bootstrap: req.session.masterTokenId
        ? { tokenId: req.session.masterTokenId, hasToken: true }
        : null,
    });
  }

  // Legacy bearer session-token auth
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.replace("Bearer ", "");
  if (global.sessions && global.sessions[token]) {
    const session = global.sessions[token];
    const SESSION_TTL = 8 * 60 * 60 * 1000;
    if (!session.createdAt || Date.now() - session.createdAt > SESSION_TTL) {
      delete global.sessions[token];
      return res.status(401).json({ error: 'Session expired' });
    }
    const user = getUserById(session.userId);
    if (user) {
      const normalizedUser = {
        ...user,
        displayName: user.displayName || user.display_name || user.username || null,
        avatarUrl: user.avatarUrl || user.avatar_url || null,
        email: user.email || null,
      };

      return res.json({
        success: true,
        user: normalizedUser,
        data: normalizedUser,
        // SECURITY: Do NOT expose masterToken in plaintext
        bootstrap: session.masterTokenId
          ? { tokenId: session.masterTokenId, hasToken: true }
          : null,
      });
    }
  }
  res.status(401).json({ error: "Invalid session" });
});

// GET /api/v1/auth/session-token - One-shot endpoint: returns master token from session, then clears it
// Used by the frontend after OAuth login to retrieve the token without exposing it in cookies
app.get('/api/v1/auth/session-token', authRateLimit, (req, res) => {
  if (!req.session?.user?.id) return res.status(401).json({ error: 'Not authenticated' });
  const token  = req.session.masterTokenRaw || null;
  const tokenId = req.session.masterTokenId || null;
  if (token) {
    delete req.session.masterTokenRaw;
    delete req.session.masterTokenId;
    req.session.save?.(() => {});
  }
  res.json({ token, tokenId });
});

// GET /api/v1/auth/oauth-signup/pending - returns pending OAuth signup state
app.get('/api/v1/auth/oauth-signup/pending', (req, res) => {
  const pending = req.session?.oauth_signup || null;
  if (!pending) return res.status(404).json({ error: 'No pending OAuth signup' });
  return res.json({
    ok: true,
    data: {
      service: pending.service,
      providerUserId: pending.providerUserId || null,
      email: pending.email || '',
      name: pending.name || '',
      avatarUrl: pending.avatarUrl || null,
      recommendedUsername: pending.recommendedUsername || '',
      nonce: pending.nonce || null,
      createdAt: pending.createdAt || null,
    }
  });
});

// DELETE /api/v1/account - self-serve account deletion from settings danger zone
app.delete('/api/v1/account', authenticate, (req, res) => {
  try {
    const userId = String(req.user?.id || req.tokenMeta?.ownerId || '');
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const user = getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const _pwrEmail = String(process.env.POWER_USER_EMAIL || process.env.OWNER_EMAIL || '').trim().toLowerCase();
    if (_pwrEmail && String(user.email || '').toLowerCase() === _pwrEmail) {
      return res.status(400).json({ error: 'Cannot delete power user account from self-service endpoint' });
    }

    const rawDb = db.getRawDB ? db.getRawDB() : db;
    const existingTables = new Set(
      rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    );
    const safeDelete = (sql, ...params) => {
      const match = sql.match(/DELETE FROM (\w+)/i);
      if (match && !existingTables.has(match[1])) return;
      rawDb.prepare(sql).run(...params);
    };

    // Send goodbye email BEFORE deleting the user record (email address is lost after)
    if (user.email && user.email !== '' && !user.email.includes('example.com')) {
      emailService.sendGoodbyeEmail(user.email, user.display_name || user.displayName || user.username).catch(() => {});
    }

    rawDb.pragma('foreign_keys = OFF');
    try {
      rawDb.transaction((uid) => {
        // Delete from all tables that reference this user (in dependency order)
        safeDelete('DELETE FROM oauth_tokens WHERE user_id = ?', uid);
        safeDelete('DELETE FROM vault_tokens WHERE owner_id = ?', uid);
        safeDelete('DELETE FROM access_tokens WHERE owner_id = ?', uid);
        safeDelete('DELETE FROM approved_devices WHERE user_id = ?', uid);
        safeDelete('DELETE FROM device_approvals_pending WHERE user_id = ?', uid);
        safeDelete('DELETE FROM handshakes WHERE user_id = ?', uid);
        safeDelete('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)', uid);
        safeDelete('DELETE FROM conversations WHERE user_id = ?', uid);
        safeDelete('DELETE FROM notifications WHERE user_id = ?', uid);
        safeDelete('DELETE FROM notification_preferences WHERE user_id = ?', uid);
        safeDelete('DELETE FROM service_preferences WHERE user_id = ?', uid);
        safeDelete('DELETE FROM activity_log WHERE user_id = ?', uid);
        safeDelete('DELETE FROM email_queue WHERE user_id = ?', uid);
        safeDelete('DELETE FROM rate_limits WHERE user_id = ?', uid);
        safeDelete('DELETE FROM subscriptions WHERE user_id = ?', uid);
        safeDelete('DELETE FROM two_factor_backup_codes WHERE user_id = ?', uid);
        safeDelete('DELETE FROM team_invitations WHERE sender_id = ? OR recipient_id = ?', uid, uid);
        safeDelete('DELETE FROM marketplace_listings WHERE owner_id = ?', uid);
        safeDelete('DELETE FROM persona_documents WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)', uid);
        safeDelete('DELETE FROM persona_skills WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)', uid);
        safeDelete('DELETE FROM skills WHERE owner_id = ?', uid);
        safeDelete('DELETE FROM personas WHERE owner_id = ?', uid);
        safeDelete('DELETE FROM kb_documents WHERE owner_id = ?', uid);
        safeDelete('DELETE FROM workspace_members WHERE user_id = ?', uid);
        safeDelete('DELETE FROM afp_devices WHERE user_id = ?', uid);
        safeDelete('DELETE FROM user_pii_secure WHERE user_id = ?', uid);
        safeDelete('DELETE FROM users WHERE id = ?', uid);
      })(userId);
    } finally {
      rawDb.pragma('foreign_keys = ON');
    }

    if (req.session) {
      req.session.destroy(() => {});
    }
    clearAuthCookies(req, res);

    createAuditLog({
      requesterId: req.tokenMeta?.tokenId || `self_${userId}`,
      action: 'delete_own_account',
      resource: `/account/${userId}`,
      scope: req.tokenMeta?.scope || 'session',
      ip: req.ip,
      details: { email: user.email || null }
    });

    return res.json({ ok: true, deletedUserId: userId });
  } catch (error) {
    try { (db.getRawDB ? db.getRawDB() : db).pragma('foreign_keys = ON'); } catch (_e) { /* ignore */ }
    console.error('Delete own account error:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

// POST /api/v1/auth/oauth-signup/complete - creates user from pending OAuth signup and logs in
app.post('/api/v1/auth/oauth-signup/complete', async (req, res) => {
  const pending = req.session?.oauth_signup;
  if (!pending) return res.status(400).json({ error: 'No pending OAuth signup session' });

  if (betaMode.isBetaMode() && betaMode.isBetaFull()) {
    return res.status(403).json({
      error: 'Beta is at capacity. Join the waitlist to be notified when a spot opens.',
      code: 'BETA_FULL',
      waitlistUrl: '/api/v1/waitlist',
      email: pending.email || null,
    });
  }

  const body = req.body || {};
  const confirm = body?.oauthSignupConfirm === true;
  const nonce = String(body?.oauthSignupNonce || '').trim();

  if (pending.source !== 'oauth_login_callback') {
    return res.status(400).json({ error: 'Invalid signup source. OAuth signup required.' });
  }
  if (!confirm) {
    return res.status(400).json({ error: 'OAuth signup confirmation required' });
  }
  if (body?.termsAccepted !== true) {
    return res.status(400).json({ error: 'You must accept the Terms of Use to create an account' });
  }
  if (!nonce || nonce !== String(pending.nonce || '')) {
    return res.status(400).json({ error: 'Invalid or expired OAuth signup nonce' });
  }

  const requestedUsername = String(body.username || '').trim();
  const baseFromPending = String(
    pending.recommendedUsername
    || (pending.email ? String(pending.email).split('@')[0] : '')
    || pending.name
    || `user_${Date.now()}`
  );

  const usernameBase = (requestedUsername || baseFromPending)
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, 30) || `user_${Date.now()}`;

  const timezone = String(body.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC').trim() || 'UTC';
  const emailRaw = String(body.email || pending.email || '').trim();
  const email = emailRaw.length > 0 ? emailRaw : null;

  if (email) {
    const emailMatch = getUsers().find((u) => String(u.email || '').toLowerCase() === email.toLowerCase());
    if (emailMatch) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
    }
  }

  const generatedPassword = `Oauth#${crypto.randomBytes(16).toString('hex')}A1!`;
  let createdUser = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? '' : `_${crypto.randomBytes(2).toString('hex')}`;
    const usernameCandidate = `${usernameBase}${suffix}`.slice(0, 30);
    const displayName = String(body.displayName || pending.name || usernameCandidate).trim() || usernameCandidate;

    try {
      createdUser = createUser(usernameCandidate, displayName, email, timezone, generatedPassword);
      betaMode.invalidateBetaFullCache();
      createdUser = updateUserOAuthProfile(createdUser.id, {
        displayName,
        email,
        avatarUrl: pending.avatarUrl || null,
      }) || createdUser;
      break;
    } catch (error) {
      const msg = String(error?.message || '');
      const isUnique = /unique|constraint/i.test(msg);
      if (!isUnique || attempt === 4) {
        return res.status(500).json({ error: `Failed to complete OAuth signup: ${msg || 'unknown error'}` });
      }
    }
  }

  if (!createdUser) {
    return res.status(500).json({ error: 'Failed to complete OAuth signup' });
  }

  // Use existing master token if already created (e.g. retry scenario), otherwise create exactly one
  let rawMasterToken, tokenId;
  const existingMaster = getExistingMasterToken(createdUser.id);
  if (existingMaster) {
    rawMasterToken = existingMaster.rawToken;
    tokenId = existingMaster.tokenId;
  } else {
    rawMasterToken = 'myapi_' + crypto.randomBytes(32).toString('hex');
    const hash = bcrypt.hashSync(rawMasterToken, 10);
    tokenId = createAccessToken(hash, createdUser.id, 'full', 'Master Token', null, null, null, rawMasterToken, 'master');
  }

  await regenerateSession(req);

  req.session.user = {
    id: createdUser.id,
    username: createdUser.username,
    display_name: createdUser.displayName || createdUser.username,
    displayName: createdUser.displayName || createdUser.username,
    email: createdUser.email || null,
    avatar_url: createdUser.avatarUrl || null,
    avatarUrl: createdUser.avatarUrl || null,
    two_factor_enabled: Boolean(createdUser.twoFactorEnabled),
    roles: createdUser.roles || 'user',
    needsOnboarding: true,
  };

  // Set default workspace for new user
  const userWorkspaces = getWorkspaces(createdUser.id);
  if (userWorkspaces?.length > 0) {
    req.session.currentWorkspace = userWorkspaces[0].id;
  }

  req.session.masterTokenRaw = rawMasterToken;
  req.session.masterTokenId = tokenId;
  req.session.isFirstLogin = true;

  if (pending.oauthToken) {
    const t = pending.oauthToken;
    storeOAuthToken(
      pending.service,
      createdUser.id,
      t.accessToken,
      t.refreshToken || null,
      t.expiresAt || null,
      t.scope || null,
    );
  }

  // Store structured identity fields in profile_metadata (persists to DB)
  const identityPatch = {};
  ['role', 'company', 'location', 'bio'].forEach((f) => {
    const v = String(body[f] || '').trim();
    if (v) identityPatch[f] = v;
  });
  if (Object.keys(identityPatch).length > 0) {
    updateUserOAuthProfile(createdUser.id, { profileMetadata: identityPatch });
    vault.identityDocs[createdUser.id] = Object.assign(
      { name: createdUser.displayName || createdUser.username },
      identityPatch
    );
  }

  // Create initial persona from soul content assembled by the signup wizard
  const signupSoulContent = String(body.soulMd || '').trim();
  if (signupSoulContent) {
    try {
      const newPersona = createPersona(
        'My Assistant',
        signupSoulContent,
        'Initial persona created during signup',
        null,
        createdUser.id,
        null
      );
      if (newPersona?.id) setActivePersona(newPersona.id, createdUser.id);
    } catch (_) {}
  }

  // Mark new user as needing onboarding (stored in DB so it survives session loss)
  setUserNeedsOnboarding(createdUser.id, true);

  // Send welcome email (fire-and-forget; never block the signup response)
  const signupEmail = createdUser.email || body.email || null;
  const signupDisplayName = createdUser.displayName || createdUser.display_name || createdUser.username || '';
  if (signupEmail) {
    emailService.sendWelcomeEmail(signupEmail, signupDisplayName).catch(() => {});
  }

  delete req.session.oauth_signup;

  res.cookie('myapi_master_token', rawMasterToken, {
    httpOnly: true,  // Not readable by JS; use GET /api/v1/auth/session-token instead
    secure: secureCookie,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  res.cookie('myapi_user', JSON.stringify(req.session.user), {
    httpOnly: false, // Required: JS reads user info for dashboard display
    secure: secureCookie,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  createAuditLog({
    requesterId: createdUser.id,
    action: 'oauth_signup_complete',
    resource: `/users/${createdUser.id}`,
    scope: 'session',
    ip: req.ip,
    details: {
      service: pending.service,
      providerUserId: pending.providerUserId || null,
      userMd: body.userMd || null,
      soulMd: body.soulMd || null,
    }
  });

  return req.session.save(() => {
    res.json({ ok: true, data: { user: req.session.user, bootstrap: { masterToken: rawMasterToken, tokenId } } });
  });
});

// GET /api/v1/auth/debug - Public diagnostic endpoint
// No auth required; helps diagnose session/token issues
app.get("/api/v1/auth/debug", (req, res) => {
  const hasSession = Boolean(req.session && req.session.user);
  const hasBearer = Boolean(req.headers.authorization?.replace?.("Bearer ", ""));
  const sessionUserId = req.session?.user?.id || null;
  const bearerToken = req.headers.authorization?.replace("Bearer ", "") || null;
  const cookies = req.headers.cookie || '';

  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    timestamp: new Date().toISOString(),
    session: hasSession,
    sessionUserId,
    hasBearer,
    bearerToken: bearerToken ? bearerToken.slice(0, 20) + '...' : null,
    headers: {
      authorization: req.headers.authorization ? 'present' : 'missing',
      cookie: cookies ? 'present' : 'missing',
      userAgent: req.headers['user-agent'] || 'unknown',
    },
    ip: req.ip,
    method: req.method,
    path: req.path,
  });
});

app.post('/api/v1/auth/2fa/setup', authenticate, async (req, res) => {
  try {
    const userId = req?.user?.id || req?.tokenMeta?.ownerId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const user = getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const issuer = process.env.TOTP_ISSUER || 'MyApi';
    const label = `${issuer}:${user.email || user.username}`;
    const secret = speakeasy.generateSecret({ name: label, issuer, length: 32 });

    const saved = setUserTotpSecret(userId, secret.base32);
    if (!saved) return res.status(500).json({ error: 'Failed to store 2FA secret' });
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    createAuditLog({
      requesterId: String(userId),
      action: '2fa_setup_started',
      resource: `/users/${userId}/2fa`,
      scope: req?.tokenMeta?.scope || 'session',
      ip: req.ip,
    });

    return res.json({
      data: {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
        qrCodeDataUrl,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to initialize 2FA setup' });
  }
});

app.post('/api/v1/auth/2fa/verify', authenticate, (req, res) => {
  try {
    const userId = req?.user?.id || req?.tokenMeta?.ownerId;
    const { code } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    if (!code) return res.status(400).json({ error: '2FA code is required' });

    const state = getUserTotpSecret(userId);
    if (!state?.totpSecret) return res.status(400).json({ error: '2FA setup not initialized' });

    const verified = speakeasy.totp.verify({
      secret: state.totpSecret,
      encoding: 'base32',
      token: String(code).replace(/\s+/g, ''),
      window: 2,
    });

    if (!verified) return res.status(400).json({ error: 'Invalid 2FA code (check phone time sync and try current code)' });
    const totpKey2 = String(code).replace(/\s+/g, '');
    if (isTotpCodeUsed(userId, totpKey2)) {
      return res.status(401).json({ error: '2FA code already used. Wait for the next code.' });
    }
    markTotpCodeUsed(userId, totpKey2);

    const enabled = enableUserTwoFactor(userId);
    if (!enabled) return res.status(500).json({ error: 'Failed to enable 2FA for this user' });
    if (req.session?.user) req.session.user.two_factor_enabled = true;

    // Send notification (Phase 3.5)
    const ws = getWorkspaces(userId);
    if (ws?.length) {
      NotificationDispatcher.on2FAEnabled(ws[0].id, userId)
        .catch(err => console.error('Notification dispatch error:', err));
    }

    createAuditLog({
      requesterId: String(userId),
      action: '2fa_enabled',
      resource: `/users/${userId}/2fa`,
      scope: req?.tokenMeta?.scope || 'session',
      ip: req.ip,
    });

    return res.json({ ok: true, data: { enabled: true } });
  } catch (error) {
    console.error("2FA verify error:", error);
    return res.status(500).json({ error: 'Failed to verify 2FA code: ' + error.message });
  }
});

app.post('/api/v1/auth/2fa/disable', authenticate, (req, res) => {
  try {
    const userId = req?.user?.id || req?.tokenMeta?.ownerId;
    const { code } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const state = getUserTotpSecret(userId);
    if (!state?.twoFactorEnabled) return res.status(400).json({ error: '2FA is not enabled' });
    if (!code) return res.status(400).json({ error: '2FA code is required' });

    const verified = speakeasy.totp.verify({
      secret: state.totpSecret,
      encoding: 'base32',
      token: String(code).replace(/\s+/g, ''),
      window: 2,
    });

    if (!verified) return res.status(400).json({ error: 'Invalid 2FA code' });
    const totpKey3 = String(code).replace(/\s+/g, '');
    if (isTotpCodeUsed(userId, totpKey3)) {
      return res.status(401).json({ error: '2FA code already used. Wait for the next code.' });
    }
    markTotpCodeUsed(userId, totpKey3);

    disableUserTwoFactor(userId);
    if (req.session?.user) req.session.user.two_factor_enabled = false;

    // Send notification (Phase 3.5)
    const ws = getWorkspaces(userId);
    if (ws?.length) {
      NotificationDispatcher.on2FADisabled(ws[0].id, userId)
        .catch(err => console.error('Notification dispatch error:', err));
    }

    createAuditLog({
      requesterId: String(userId),
      action: '2fa_disabled',
      resource: `/users/${userId}/2fa`,
      scope: req?.tokenMeta?.scope || 'session',
      ip: req.ip,
    });

    return res.json({ ok: true, data: { enabled: false } });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

app.get('/api/v1/auth/2fa/status', authenticate, (req, res) => {
  const userId = req?.user?.id || req?.tokenMeta?.ownerId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const state = getUserTotpSecret(userId);
  if (!state) return res.status(404).json({ error: 'User not found' });
  return res.json({ data: { enabled: Boolean(state.twoFactorEnabled) } });
});

// BUG-15: Add rate limiting to 2FA challenge to prevent brute force attacks
app.post('/api/v1/auth/2fa/challenge', twoFactorRateLimit, (req, res) => {
  try {
    const { code } = req.body || {};
    const pendingUser = req?.session?.pending_2fa_user;
    if (!pendingUser?.id) return res.status(401).json({ error: 'No pending 2FA challenge' });
    if (!code) return res.status(400).json({ error: '2FA code is required' });

    // BUG-15: Check 2FA challenge expiration (typically codes are valid for 30 seconds)
    const challengeCreatedAt = req?.session?.pending_2fa_user?.createdAt;
    if (challengeCreatedAt) {
      const now = Date.now();
      const ageMs = now - new Date(challengeCreatedAt).getTime();
      const maxAgeMs = 10 * 60 * 1000; // 10 minute window before challenge expires
      if (ageMs > maxAgeMs) {
        return res.status(401).json({ error: '2FA challenge expired. Please login again.' });
      }
    }

    const state = getUserTotpSecret(pendingUser.id);
    if (!state?.totpSecret || !state?.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled for this account' });
    }

    const verified = speakeasy.totp.verify({
      secret: state.totpSecret,
      encoding: 'base32',
      token: String(code).replace(/\s+/g, ''),
      window: 2,
    });
    if (!verified) {
      // Log failed 2FA attempt for security auditing
      createAuditLog({
        requesterId: String(pendingUser.id),
        action: '2fa_failed_attempt',
        resource: '/auth/2fa/challenge',
        scope: 'session',
        ip: req.ip,
        details: { reason: 'invalid_code' }
      });
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    req.session.user = pendingUser;
    const pendingReturnTo = req.session.pending_2fa_returnTo || null;
    delete req.session.pending_2fa_user;
    delete req.session.pending_2fa_returnTo;

    // Set default workspace after 2FA
    const userWorkspaces = getWorkspaces(pendingUser.id);
    if (userWorkspaces?.length > 0) {
      req.session.currentWorkspace = userWorkspaces[0].id;
    }

    if (!req.session.masterTokenRaw) {
      // Try to retrieve existing master token — never create one during login flows.
      const existing = getExistingMasterToken(String(pendingUser.id));
      if (existing) {
        req.session.masterTokenRaw = existing.rawToken;
        req.session.masterTokenId = existing.tokenId;
      }
    }

    createAuditLog({ requesterId: String(pendingUser.id), action: '2fa_challenge_passed', resource: '/auth/2fa/challenge', scope: 'session', ip: req.ip });
    return req.session.save(() => {
      res.json({ ok: true, data: { user: req.session.user, bootstrap: { masterToken: req.session.masterTokenRaw, tokenId: req.session.masterTokenId || null }, pendingReturnTo } });
    });
  } catch (error) {
    return res.status(500).json({ error: `2FA challenge failed: ${error.message}` });
  }
});

app.post("/api/v1/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    if (global.sessions) delete global.sessions[token];
  }

  // Always clear all auth cookies, regardless of session store outcome.
  clearAuthCookies(req, res);

  if (!req.session) {
    return res.json({ ok: true });
  }

  const sid = req.sessionID;

  // SOC2 CC6: Remove from concurrent session registry
  if (req.session.user?.id) unregisterUserSession(req.session.user.id, sid);

  // BUG-12: Ensure ALL session data is cleared before responding
  // Clear all session properties that might contain sensitive data
  delete req.session.pending_2fa_user;
  delete req.session.user;
  delete req.session.masterTokenRaw;
  delete req.session.masterTokenId;
  delete req.session.oauth_login_pending;
  delete req.session.oauth_confirm;
  delete req.session.oauth_signup;
  delete req.session.oauthStateMeta;
  delete req.session.isFirstLogin;
  delete req.session.currentWorkspace;

  // Destroy session and wait for completion before responding
  req.session.destroy((err) => {
    // Also attempt to destroy from store if available
    if (typeof req.sessionStore?.destroy === 'function' && sid) {
      try {
        req.sessionStore.destroy(sid, (storeErr) => {
          if (storeErr) {
            console.warn('[logout] session store destroy returned error:', storeErr.message);
          }
        });
      } catch (e) {
        console.warn('[logout] session store destroy threw error:', e.message);
      }
    }

    if (err) {
      console.error('[logout] session destroy failed:', err.message);
      return res.status(500).json({ ok: false, error: 'Failed to logout cleanly' });
    }

    // Send response only after session is fully destroyed
    res.json({ ok: true, message: 'Logged out successfully' });
  });
});

// SOC2 CC6 — Revoke all active sessions for the current user
app.post('/api/v1/auth/sessions/revoke-all', (req, res) => {
  const userId = req.session?.user?.id || null;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const currentSid = req.sessionID;
  revokeAllUserSessions(userId);

  // Also destroy the current session
  clearAuthCookies(req, res);
  req.session.destroy(() => {
    if (sessionStore && typeof sessionStore.destroy === 'function') {
      try { sessionStore.destroy(currentSid, () => {}); } catch (_) {}
    }
  });

  createAuditLog({
    requesterId: userId,
    action: 'revoke_all_sessions',
    resource: '/auth/sessions/revoke-all',
    scope: 'session',
    ip: req.ip
  });

  res.json({ ok: true, message: 'All sessions revoked' });
});

// ============================
// NEW: USERS
// ============================

const isStrongPassword = (pw) => {
  if (!pw || pw.length < 8) return false;
  const hasUpperCase = /[A-Z]/.test(pw);
  const hasLowerCase = /[a-z]/.test(pw);
  const hasNumbers = /\d/.test(pw);
  const hasNonalphas = /\W/.test(pw);
  return [hasUpperCase, hasLowerCase, hasNumbers, hasNonalphas].filter(Boolean).length >= 3;
};

app.post("/api/v1/users", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can create users" });
  if (!requirePowerUser(req, res)) return;
  const { username, displayName, email, timezone, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password are required" });

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: "Password must be at least 8 characters and contain 3 of: uppercase, lowercase, number, symbol" });
  }

  try {
    const user = createUser(username, displayName, email, timezone, password);
    createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "create_user", resource: `/users/${user.id}`, scope: req.tokenMeta.scope, ip: req.ip });
    res.status(201).json({ data: user });
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Username already exists" });
    }
    throw e;
  }
});

app.get("/api/v1/users", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can list users" });
  if (!requirePowerUser(req, res)) return;
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "list_users", resource: "/users", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: getUsers() });
});

app.put('/api/v1/users/:id/plan', planFeatureRateLimit, authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can manage plans' });
  if (!requirePowerUser(req, res)) return;
  try {
    const { id } = req.params;
    const { plan } = req.body || {};
    const user = updateUserPlan(id, plan);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Sync workspace subscription so billing/current reflects the new plan
    const userWorkspaces = getWorkspaces(id);
    const normalizedPlan = String(plan).toLowerCase().trim();
    for (const ws of (userWorkspaces || [])) {
      upsertBillingSubscription(ws.id, {
        stripe_subscription_id: `admin_set_${Date.now()}`,
        plan_id: normalizedPlan,
        status: 'active',
      });
    }

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'update_user_plan',
      resource: `/users/${id}/plan`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { plan }
    });

    res.json({ data: user });
  } catch (error) {
    if (String(error.message || '').includes('Invalid plan')) {
      return res.status(400).json({ error: 'Invalid plan. Allowed: free, pro, enterprise' });
    }
    console.error('Update user plan error:', error);
    res.status(500).json({ error: 'Failed to update user plan' });
  }
});

app.put('/api/v1/users/:id/subscription', planFeatureRateLimit, authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can manage subscriptions' });
  if (!requirePowerUser(req, res)) return;
  try {
    const { id } = req.params;
    const { status, customerId, subscriptionId } = req.body || {};
    const user = updateUserSubscriptionStatus(id, { status, customerId, subscriptionId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'update_user_subscription',
      resource: `/users/${id}/subscription`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { status, customerId, subscriptionId },
    });
    res.json({ data: user });
  } catch (error) {
    if (String(error.message || '').includes('Invalid subscription status')) {
      return res.status(400).json({ error: 'Invalid subscription status' });
    }
    console.error('Update user subscription error:', error);
    res.status(500).json({ error: 'Failed to update user subscription' });
  }
});

app.delete('/api/v1/users/:id', authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can delete users' });
  if (!requirePowerUser(req, res)) return;

  try {
    const { id } = req.params;
    const user = getUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const _pwrEmail = String(process.env.POWER_USER_EMAIL || process.env.OWNER_EMAIL || '').trim().toLowerCase();
    if (_pwrEmail && String(user.email || '').toLowerCase() === _pwrEmail) {
      return res.status(400).json({ error: 'Cannot delete power user account' });
    }

    const adminRawDb = db.getRawDB ? db.getRawDB() : db;
    const adminExistingTables = new Set(
      adminRawDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    );
    const adminSafeDelete = (sql, ...params) => {
      const match = sql.match(/DELETE FROM (\w+)/i);
      if (match && !adminExistingTables.has(match[1])) return;
      adminRawDb.prepare(sql).run(...params);
    };

    adminRawDb.pragma('foreign_keys = OFF');
    try {
      adminRawDb.transaction((userId) => {
        // Delete from all tables that reference this user (in dependency order)
        adminSafeDelete('DELETE FROM oauth_tokens WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM vault_tokens WHERE owner_id = ?', userId);
        adminSafeDelete('DELETE FROM access_tokens WHERE owner_id = ?', userId);
        adminSafeDelete('DELETE FROM approved_devices WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM device_approvals_pending WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM handshakes WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)', userId);
        adminSafeDelete('DELETE FROM conversations WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM notifications WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM notification_preferences WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM service_preferences WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM activity_log WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM email_queue WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM rate_limits WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM subscriptions WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM two_factor_backup_codes WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM team_invitations WHERE sender_id = ? OR recipient_id = ?', userId, userId);
        adminSafeDelete('DELETE FROM marketplace_listings WHERE owner_id = ?', userId);
        adminSafeDelete('DELETE FROM persona_documents WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)', userId);
        adminSafeDelete('DELETE FROM persona_skills WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)', userId);
        adminSafeDelete('DELETE FROM skills WHERE owner_id = ?', userId);
        adminSafeDelete('DELETE FROM personas WHERE owner_id = ?', userId);
        adminSafeDelete('DELETE FROM kb_documents WHERE owner_id = ?', userId);
        adminSafeDelete('DELETE FROM workspace_members WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM afp_devices WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM user_pii_secure WHERE user_id = ?', userId);
        adminSafeDelete('DELETE FROM users WHERE id = ?', userId);
      })(id);
    } finally {
      adminRawDb.pragma('foreign_keys = ON');
    }

    createAuditLog({ requesterId: req.tokenMeta.tokenId, action: 'delete_user', resource: `/users/${id}`, scope: req.tokenMeta.scope, ip: req.ip, details: { email: user.email || null } });
    res.json({ ok: true, deletedUserId: id });
  } catch (error) {
    try { (db.getRawDB ? db.getRawDB() : db).pragma('foreign_keys = ON'); } catch (_e) { /* ignore */ }
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.post('/api/v1/users/cleanup-test-users', authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can cleanup users' });
  if (!requirePowerUser(req, res)) return;

  const prefix = String(req.body?.prefix || 'phase12a_');
  try {
    const users = db.prepare('SELECT id, email, username FROM users WHERE username LIKE ?').all(`${prefix}%`);
    let deleted = 0;
    const cleanupRawDb = db.getRawDB ? db.getRawDB() : db;
    cleanupRawDb.transaction((list) => {
      for (const u of list) {
        cleanupRawDb.prepare('DELETE FROM oauth_tokens WHERE user_id = ?').run(u.id);
        cleanupRawDb.prepare('DELETE FROM access_tokens WHERE owner_id = ?').run(u.id);
        cleanupRawDb.prepare('DELETE FROM handshakes WHERE user_id = ?').run(u.id);
        cleanupRawDb.prepare('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)').run(u.id);
        cleanupRawDb.prepare('DELETE FROM conversations WHERE user_id = ?').run(u.id);
        cleanupRawDb.prepare('DELETE FROM persona_documents WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)').run(u.id);
        cleanupRawDb.prepare('DELETE FROM persona_skills WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)').run(u.id);
        cleanupRawDb.prepare('DELETE FROM skills WHERE owner_id = ?').run(u.id);
        cleanupRawDb.prepare('DELETE FROM personas WHERE owner_id = ?').run(u.id);
        cleanupRawDb.prepare('DELETE FROM kb_documents WHERE owner_id = ?').run(u.id);
        const r = cleanupRawDb.prepare('DELETE FROM users WHERE id = ?').run(u.id);
        if (r.changes > 0) deleted += 1;
      }
    })(users);

    createAuditLog({ requesterId: req.tokenMeta.tokenId, action: 'cleanup_test_users', resource: '/users/cleanup-test-users', scope: req.tokenMeta.scope, ip: req.ip, details: { prefix, deleted } });
    res.json({ ok: true, prefix, deleted });
  } catch (error) {
    console.error('Cleanup test users error:', error);
    res.status(500).json({ error: 'Failed to cleanup test users' });
  }
});

// Tickets — power-user-only complaint tracking
const createTicketsRoutes = require('./routes/tickets');
app.use('/api/v1/tickets', authenticate, createTicketsRoutes({ db, requirePowerUser, isMaster }));

// ============================
// NEW: HANDSHAKES (AI Agent Access Requests)
// ============================

// PUBLIC: AI agent initiates a handshake request (no auth required - this is the entry point)
app.post("/api/v1/handshakes", rateLimit(60000, 20, 'handshake'), (req, res) => {
  const { agentId, requestedScopes, message } = req.body;
  if (!agentId || !requestedScopes || !Array.isArray(requestedScopes)) {
    return res.status(400).json({ error: "agentId and requestedScopes (array) are required" });
  }
  if (typeof agentId !== 'string' || agentId.length > 256)
    return res.status(400).json({ error: 'agentId must be a string of ≤256 chars' });
  if (message !== undefined && (typeof message !== 'string' || message.length > 2000))
    return res.status(400).json({ error: 'message must be a string of ≤2000 chars' });
  if (requestedScopes.length > 10)
    return res.status(400).json({ error: 'Too many requested scopes (max 10)' });
  const validScopes = ["read", "professional", "availability"];
  const invalidScopes = requestedScopes.filter(s => !validScopes.includes(s));
  if (invalidScopes.length > 0) {
    return res.status(400).json({ error: `Invalid scopes: ${invalidScopes.join(", ")}. Allowed: ${validScopes.join(", ")}` });
  }
  const handshake = createHandshake("owner", agentId, requestedScopes, message);
  createAuditLog({ requesterId: agentId, action: "handshake_request", resource: `/handshakes/${handshake.id}`, scope: requestedScopes.slice(0, 10).map(s => String(s).slice(0, 50)).join(',').slice(0, 500), ip: req.ip });
  res.status(201).json({
    data: {
      handshakeId: handshake.id,
      status: "pending",
      message: "Your access request has been submitted. The user will review and approve/deny it."
    }
  });
});

// PUBLIC: AI agent polls for handshake approval status (no auth required)
app.get("/api/v1/handshakes/:id/status", (req, res) => {
  const all = getHandshakes();
  const handshake = all.find(h => h.id === req.params.id);
  if (!handshake) return res.status(404).json({ error: "Handshake not found" });
  const response = {
    handshakeId: handshake.id,
    status: handshake.status,
    requestedScopes: handshake.requestedScopes,
    createdAt: handshake.createdAt,
  };
  if (handshake.status === 'approved') {
    response.message = 'Access approved. The owner has been given your token to share with you. Wait for them to provide it out-of-band.';
  } else if (handshake.status === 'pending') {
    response.message = 'Your request is pending review by the owner. Poll this endpoint again shortly.';
  } else if (handshake.status === 'denied') {
    response.message = 'Your access request was denied by the owner.';
  }
  res.json({ data: response });
});

// ADMIN: List handshakes (with optional status filter)
app.get("/api/v1/handshakes", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can view handshakes" });
  const status = req.query.status || null;
  const handshakes = getHandshakes(status);
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "list_handshakes", resource: "/handshakes", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: handshakes });
});

// ADMIN: Approve a handshake → creates scoped token for the agent
app.post("/api/v1/handshakes/:id/approve", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can approve handshakes" });
  const result = approveHandshake(req.params.id);
  if (!result) return res.status(404).json({ error: "Handshake not found or not pending" });
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "handshake_approve", resource: `/handshakes/${req.params.id}`, scope: req.tokenMeta.scope, ip: req.ip,
    details: { tokenId: result.tokenId, scopes: result.scopes }
  });
  res.json({
    data: {
      handshakeId: result.handshakeId,
      status: "approved",
      token: result.token,
      tokenId: result.tokenId,
      scopes: result.scopes,
      message: "Access granted. Provide this token to the requesting agent."
    }
  });
});

// ADMIN: Deny a handshake
app.post("/api/v1/handshakes/:id/deny", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can deny handshakes" });
  const denied = denyHandshake(req.params.id);
  if (!denied) return res.status(404).json({ error: "Handshake not found" });
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "handshake_deny", resource: `/handshakes/${req.params.id}`, scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: { handshakeId: req.params.id, status: "denied" } });
});

// ADMIN: Revoke a handshake (also revokes the associated token)
app.post("/api/v1/handshakes/:id/revoke", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can revoke handshakes" });
  const revoked = revokeHandshake(req.params.id);
  if (!revoked) return res.status(404).json({ error: "Handshake not found" });
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "handshake_revoke", resource: `/handshakes/${req.params.id}`, scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: { handshakeId: req.params.id, status: "revoked", message: "Access revoked. The agent's token has been invalidated." } });
});

// PUBLIC: AI agent checks status of its handshake request
app.get("/api/v1/handshakes/:id/status", (req, res) => {
  const all = getHandshakes();
  const h = all.find(x => x.id === req.params.id);
  if (!h) return res.status(404).json({ error: "Handshake not found" });
  // Only return safe fields (no token)
  res.json({ data: { handshakeId: h.id, status: h.status, createdAt: h.createdAt, updatedAt: h.updatedAt } });
});

// ============================
// PERSONAS - SOUL.md Variants
// ============================

// POST /api/v1/personas - Create new persona
app.post("/api/v1/personas", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can create personas" });
  const { name, soul_content, description, templateData } = req.body;
  if (!name || !soul_content) return res.status(400).json({ error: "name and soul_content are required" });

  // Validate soul_content is markdown-like
  if (typeof soul_content !== 'string' || soul_content.trim().length === 0) {
    return res.status(400).json({ error: "soul_content must be non-empty markdown text" });
  }

  const ownerId = getRequestOwnerId(req);
  const workspaceId = getRequestWorkspaceId(req);
  const personaCount = getPersonas(ownerId).length;
  const personaLimitErr = enforcePlanLimit(req, 'personas', personaCount, 1);
  if (personaLimitErr) return res.status(403).json(personaLimitErr);

  const persona = createPersona(name, soul_content, description, templateData, ownerId, workspaceId);
  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "create_persona",
    resource: `/personas/${persona.id}`,
    scope: req.tokenMeta.scope,
    ip: req.ip,
    details: { name, description }
  });

  res.status(201).json({
    data: {
      id: persona.id,
      name: persona.name,
      active: persona.active,
      created_at: persona.created_at
    }
  });
});

// GET /api/v1/personas - List all personas
app.get("/api/v1/personas", authenticate, (req, res) => {
  if (!hasScope(req, 'personas')) return res.status(403).json({ error: "Requires 'personas' scope" });
  
  // Multi-tenancy: Filter personas by workspace
  const workspaceId = req.workspaceId || req.session?.currentWorkspace;
  if (!workspaceId) {
    return res.status(400).json({ error: "Workspace context required" });
  }
  
  // Validate user is member of workspace
  if (!req.workspaceMember && (!req.workspace || req.workspace.ownerId !== getOAuthUserId(req))) {
    return res.status(403).json({ error: "Not a member of this workspace" });
  }
  
  const ownerId = getRequestOwnerId(req);
  let personas = getPersonas(ownerId, workspaceId);
  
  // If this is a guest token with a scope_bundle, restrict to the bundled persona
  const rawScopeBundle = req.tokenMeta?.scopeBundle;
  if (rawScopeBundle && req.tokenMeta?.tokenType !== 'master') {
    try {
      const scopeBundle = typeof rawScopeBundle === 'string' ? JSON.parse(rawScopeBundle) : rawScopeBundle;
      if (scopeBundle?.persona_id) {
        const pid = Number(scopeBundle.persona_id);
        personas = personas.filter(p => p.id === pid);
        if (personas.length === 0) {
          return res.status(404).json({ error: "Scoped persona not found" });
        }
      }
    } catch (err) {
      console.error('[Guest Token] Error parsing scope_bundle:', err);
    }
  }

  // Also filter by allowedPersonas list if set on the token
  const allowedPersonaIds = req.tokenMeta?.allowedPersonas;
  if (Array.isArray(allowedPersonaIds) && allowedPersonaIds.length > 0 && req.tokenMeta?.tokenType !== 'master') {
    personas = personas.filter(p => allowedPersonaIds.includes(p.id) || allowedPersonaIds.map(Number).includes(Number(p.id)));
  }
  
  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "list_personas",
    resource: "/personas",
    scope: req.tokenMeta.scope,
    workspaceId: workspaceId,
    ip: req.ip
  });

  res.json({
    data: personas.map(p => ({
      id: p.id,
      name: p.name,
      active: p.active,
      description: p.description,
      soul_content: p.soul_content,
      template_data: p.template_data,
      created_at: p.created_at,
      workspace_id: p.workspaceId
    }))
  });
});

// GET /api/v1/personas/:id - Get specific persona (including soul_content)
app.get("/api/v1/personas/:id", authenticate, (req, res) => {
  if (!hasScope(req, 'personas')) return res.status(403).json({ error: "Requires 'personas' scope" });
  
  const personaId = parseInt(req.params.id);
  
  // If guest token with persona scope, verify requested ID matches scope
  if (req.tokenMeta?.is_guest_token && req.tokenMeta?.scope_bundle) {
    try {
      const scopeBundle = typeof req.tokenMeta.scope_bundle === 'string' 
        ? JSON.parse(req.tokenMeta.scope_bundle) 
        : req.tokenMeta.scope_bundle;
      
      if (scopeBundle.persona_id && scopeBundle.persona_id !== String(personaId)) {
        return res.status(403).json({ error: "This token is scoped to a different persona" });
      }
    } catch (err) {
      console.error('[Guest Token] Error parsing scope_bundle:', err);
    }
  }
  
  const ownerId = getRequestOwnerId(req);
  const persona = getPersonaById(personaId, ownerId);
  if (!persona) return res.status(404).json({ error: "Persona not found" });

  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "get_persona",
    resource: `/personas/${persona.id}`,
    scope: req.tokenMeta.scope,
    ip: req.ip
  });

  res.json({
    data: {
      id: persona.id,
      name: persona.name,
      soul_content: persona.soul_content,
      description: persona.description,
      active: persona.active,
      created_at: persona.created_at,
      updated_at: persona.updated_at,
      template_data: persona.template_data
    }
  });
});

// PUT /api/v1/personas/:id - Update persona or set as active
app.put("/api/v1/personas/:id", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can update personas" });
  const personaId = parseInt(req.params.id);
  const ownerId = getRequestOwnerId(req);
  const persona = getPersonaById(personaId, ownerId);
  if (!persona) return res.status(404).json({ error: "Persona not found" });

  const { name, soul_content, description, active } = req.body;

  // If setting as active
  if (active === true) {
    const updated = setActivePersona(personaId, ownerId);
    syncActivePersonaToSoulFile();
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: "update_persona",
      resource: `/personas/${personaId}`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { action: "set_active" }
    });
    res.json({
      data: {
        id: updated.id,
        name: updated.name,
        soul_content: updated.soul_content,
        description: updated.description,
        active: updated.active,
        created_at: updated.created_at,
        updated_at: updated.updated_at
      }
    });
  } else {
    // Update persona fields
    const updated = updatePersona(personaId, { name, soul_content, description }, ownerId);
    if (updated.active) syncActivePersonaToSoulFile();
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: "update_persona",
      resource: `/personas/${personaId}`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { fields: Object.keys(req.body) }
    });
    res.json({
      data: {
        id: updated.id,
        name: updated.name,
        soul_content: updated.soul_content,
        description: updated.description,
        active: updated.active,
        created_at: updated.created_at,
        updated_at: updated.updated_at
      }
    });
  }
});

// DELETE /api/v1/personas/:id - Remove persona (if not the only one)
app.delete("/api/v1/personas/:id", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Only master token can delete personas" });
  const personaId = parseInt(req.params.id);
  const ownerId = getRequestOwnerId(req);
  const deleted = deletePersona(personaId, ownerId);
  if (deleted === null) return res.status(400).json({ error: "Cannot delete the last remaining persona" });
  if (!deleted) return res.status(404).json({ error: "Persona not found" });

  syncActivePersonaToSoulFile();
  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "delete_persona",
    resource: `/personas/${personaId}`,
    scope: req.tokenMeta.scope,
    ip: req.ip
  });

  res.json({ ok: true });
});

// --- Persona Documents ---

// GET /api/v1/personas/:id/documents - Get attached KB documents
app.get("/api/v1/personas/:id/documents", authenticate, (req, res) => {
  const personaId = parseInt(req.params.id);
  
  // If guest token with persona scope, verify this is the scoped persona
  if (req.tokenMeta?.is_guest_token && req.tokenMeta?.scope_bundle) {
    try {
      const scopeBundle = typeof req.tokenMeta.scope_bundle === 'string' 
        ? JSON.parse(req.tokenMeta.scope_bundle) 
        : req.tokenMeta.scope_bundle;
      
      if (scopeBundle.persona_id && scopeBundle.persona_id !== String(personaId)) {
        return res.status(403).json({ error: "This token is scoped to a different persona" });
      }
    } catch (err) {
      console.error('[Guest Token] Error parsing scope_bundle:', err);
    }
  }
  
  const ownerId = getRequestOwnerId(req);
  const docs = getPersonaDocuments(personaId, ownerId);
  res.json({ data: docs });
});

// POST /api/v1/personas/:id/documents - Attach a KB document
app.post("/api/v1/personas/:id/documents", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Insufficient scope" });
  const personaId = parseInt(req.params.id);
  const { documentId } = req.body;
  if (!documentId) return res.status(400).json({ error: "documentId required" });

  const ownerId = getRequestOwnerId(req);
  const persona = getPersonaById(personaId, ownerId);
  if (!persona) return res.status(404).json({ error: "Persona not found" });

  const doc = getKBDocumentById(documentId, ownerId);
  if (!doc) return res.status(404).json({ error: "Document not found" });

  attachDocumentToPersona(personaId, documentId);
  res.json({ ok: true });
});

// DELETE /api/v1/personas/:id/documents/:docId - Detach a KB document
app.delete("/api/v1/personas/:id/documents/:docId", authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: "Insufficient scope" });
  const personaId = parseInt(req.params.id);
  const { docId } = req.params;
  detachDocumentFromPersona(personaId, docId);
  res.json({ ok: true });
});

// --- Persona Skills ---
app.get('/api/v1/personas/:id/skills', authenticate, (req, res) => {
  const personaId = parseInt(req.params.id);
  
  // If guest token with persona scope, verify this is the scoped persona
  if (req.tokenMeta?.is_guest_token && req.tokenMeta?.scope_bundle) {
    try {
      const scopeBundle = typeof req.tokenMeta.scope_bundle === 'string' 
        ? JSON.parse(req.tokenMeta.scope_bundle) 
        : req.tokenMeta.scope_bundle;
      
      if (scopeBundle.persona_id && scopeBundle.persona_id !== String(personaId)) {
        return res.status(403).json({ error: "This token is scoped to a different persona" });
      }
    } catch (err) {
      console.error('[Guest Token] Error parsing scope_bundle:', err);
    }
  }
  
  const ownerId = getRequestOwnerId(req);
  const skills = getPersonaSkills(personaId, ownerId);
  res.json({ data: skills });
});

app.post('/api/v1/personas/:id/skills', authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Insufficient scope' });
  const personaId = parseInt(req.params.id);
  const skillId = parseInt(req.body?.skillId);

  if (!skillId) return res.status(400).json({ error: 'skillId required' });

  const ownerId = getRequestOwnerId(req);
  const persona = getPersonaById(personaId, ownerId);
  if (!persona) return res.status(404).json({ error: 'Persona not found' });

  const skill = getSkillById(skillId, ownerId);
  if (!skill) return res.status(404).json({ error: 'Skill not found' });

  const currentSkillCount = getPersonaSkills(personaId, ownerId).length;
  const skillsLimitErr = enforcePlanLimit(req, 'skillsPerPersona', currentSkillCount, 1);
  if (skillsLimitErr) return res.status(403).json(skillsLimitErr);

  attachSkillToPersona(personaId, skillId);
  res.json({ ok: true });
});

app.delete('/api/v1/personas/:id/skills/:skillId', authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Insufficient scope' });
  const personaId = parseInt(req.params.id);
  const skillId = parseInt(req.params.skillId);
  detachSkillFromPersona(personaId, skillId);
  res.json({ ok: true });
});

// --- OAuth Endpoints ---

function base64UrlNoPad(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildPkcePairFromState(state) {
  const secret = String(process.env.SESSION_SECRET || 'myapi-session-secret-change-me');
  // Deterministic per-state verifier (lets callback recompute without extra storage)
  const verifierRaw = crypto.createHmac('sha256', secret).update(`pkce:${state}`).digest();
  const codeVerifier = base64UrlNoPad(Buffer.concat([verifierRaw, verifierRaw])).slice(0, 64);
  const codeChallenge = base64UrlNoPad(crypto.createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

// Compatibility alias: some clients use /oauth/authorize/twitter/x
app.get('/api/v1/oauth/authorize/twitter/x', (req, res) => {
  const qs = new URLSearchParams(req.query || {}).toString();
  const suffix = qs ? `?${qs}` : '';
  return res.redirect(`/api/v1/oauth/authorize/twitter${suffix}`);
});

// GET /api/v1/oauth/authorize/:service - Start OAuth flow
app.get("/api/v1/oauth/authorize/:service", async (req, res) => {
  const { service } = req.params;
  const mode = (req.query.mode || 'connect').toString();
  const explicitForcePrompt = req.query.forcePrompt != null
    ? ['1', 'true', 'yes'].includes(String(req.query.forcePrompt).toLowerCase())
    : null;
  const forcePrompt = explicitForcePrompt == null ? mode === 'login' : explicitForcePrompt;

  // Validate service parameter
  if (!service || typeof service !== 'string' || service.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid service parameter',
      message: `Service parameter must be a non-empty string. Got: ${typeof service}`
    });
  }

  // Check if service is in the list of supported OAuth services
  if (!OAUTH_SERVICES.includes(service)) {
    return res.status(400).json({
      error: `Service "${service}" not supported`,
      availableServices: OAUTH_SERVICES,
      message: `The service "${service}" is not available for OAuth. Available services are: ${OAUTH_SERVICES.join(', ')}`
    });
  }

  // Check if service is enabled and configured
  if (!isOAuthServiceEnabled(service)) {
    const adapter = oauthAdapters[service];
    const isConfigured = adapter ? isAdapterConfigured(adapter) : false;

    return res.status(400).json({
      error: `Service "${service}" is not enabled or configured`,
      message: `OAuth for "${service}" is either disabled or missing required configuration (clientId, clientSecret, redirectUri)`,
      service: service,
      configured: isConfigured
    });
  }

  // Create state token for CSRF protection
  let state;
  try {
    state = createStateToken(service, 30);
  } catch (stateError) {
    console.error(`[OAuth] Failed to create state token for ${service}:`, stateError);
    return res.status(500).json({
      error: 'Failed to initialize OAuth flow',
      message: 'Could not create secure state token'
    });
  }

  // Store OAuth flow metadata in session
  req.session.oauthStateMeta = req.session.oauthStateMeta || {};

  // Try to authenticate the user to get ownerId
  // This checks session, Bearer token, and masterToken cookie
  await tryAuthenticate(req);

  // Get ownerId from multiple sources (SAME priority as callback will use)
  let ownerId = null;
  if (req.session?.user?.id) {
    ownerId = String(req.session.user.id);
  } else if (req.tokenMeta?.ownerId) {
    ownerId = String(req.tokenMeta.ownerId);
  } else if (req.cookies?.myapi_master_token) {
    // FALLBACK: Extract ownerId from masterToken cookie
    try {
      const masterTokenRaw = req.cookies.myapi_master_token;
      const accessTokens = getAccessTokens() || [];
      for (const t of accessTokens) {
        if (t.hash && await bcrypt.compare(masterTokenRaw, t.hash).catch(() => false)) {
          ownerId = String(t.ownerId);
          break;
        }
      }
    } catch (err) {
      console.warn(`[OAuth Authorize] Failed to extract ownerId from masterToken:`, err.message);
    }
  }

  logger.debug('[OAuth Authorize] flow initiated', { service, hasOwnerId: !!ownerId });
  req.session.oauthStateMeta[state] = {
    mode,
    forcePrompt,
    ownerId,
    returnTo: String(req.query.returnTo || '/dashboard/'),
    createdAt: Date.now(),
  };

  // Get authorization URL from adapter
  let authUrl;
  try {
    const adapter = oauthAdapters[service];
    const runtimeAuthParams = {};

    if (forcePrompt && mode === 'login') {
      if (service === 'google') {
        runtimeAuthParams.prompt = 'select_account';
        runtimeAuthParams.max_age = '0';
      } else if (service === 'facebook') {
        runtimeAuthParams.auth_type = 'reauthenticate';
      } else if (service === 'github') {
        // GitHub OAuth does not support a true re-auth/account-picker prompt.
        // Keep deterministic behavior marker for observability/tests.
        runtimeAuthParams.allow_signup = 'true';
      }
    }

    // When forcePrompt is explicitly disabled, suppress adapter default prompt params
    if (explicitForcePrompt === false) {
      if (service === 'google') {
        runtimeAuthParams.prompt = null;
        runtimeAuthParams.max_age = null;
      }
    }

    if (['twitter', 'airtable', 'canva'].includes(service)) {
      const { codeChallenge } = buildPkcePairFromState(state);
      runtimeAuthParams.code_challenge = codeChallenge;
      runtimeAuthParams.code_challenge_method = 'S256';
    }
    authUrl = adapter.getAuthorizationUrl(state, runtimeAuthParams);
  } catch (authError) {
    console.error(`[OAuth] Failed to generate authorization URL for ${service}:`, authError);
    return res.status(500).json({
      error: 'Failed to generate authorization URL',
      message: authError.message || 'Could not generate OAuth authorization URL'
    });
  }

  // Log the OAuth flow start
  createAuditLog({
    requesterId: req.ip,
    action: "oauth_authorize_start",
    resource: `/oauth/authorize/${service}`,
    ip: req.ip,
    details: { service, mode, forcePrompt, state: state.substring(0, 10) + '...' }
  });

  // Determine response format (JSON or redirect)
  const wantsJson = String(req.query.json || '').toLowerCase() === '1';

  if (wantsJson) {
    // CRITICAL: Save session before responding, otherwise oauthStateMeta won't persist
    return req.session.save((err) => {
      if (err) {
        console.error(`[OAuth Authorize] ❌ Session save failed for JSON response:`, err);
        return res.status(500).json({ error: 'Failed to save session for OAuth flow' });
      }
      res.json({
        ok: true,
        authUrl,
        state,
        service
      });
    });
  }

  // Default behavior: redirect to OAuth provider
  // CRITICAL: Save session before redirect, otherwise oauthStateMeta won't persist
  return req.session.save((err) => {
    if (err) {
      console.error(`[OAuth Authorize] ❌ Session save failed:`, err);
      return res.status(500).json({ error: 'Failed to save session for OAuth flow' });
    }
    res.redirect(authUrl);
  });
});

// Catch incomplete OAuth callbacks (e.g., /api/v1/oauth without :service)
// and provide helpful error message
app.get(["/api/v1/oauth", "/oauth"], (req, res) => {
  return res.status(400).json({
    error: "OAuth callback incomplete - missing service parameter",
    hint: "Expected /api/v1/oauth/callback/:service (e.g., /api/v1/oauth/callback/google)"
  });
});

// GET /api/v1/oauth/callback/:service - Handle OAuth callback
// Also support legacy/public callback paths to avoid provider-side 404s when
// an app is configured without the /api/v1 prefix.
app.get([
  "/api/v1/oauth/callback/:service",
  "/oauth/callback/:service",
  "/api/oauth/callback/:service",
], async (req, res) => {
  const { service } = req.params;
  const { code, state, error: providerError, error_description: providerErrorDescription } = req.query;
  console.error(`[OAuth CALLBACK] ${service} hit with code=${Boolean(code)} state=${Boolean(state)} error=${providerError || 'none'}`);
  console.error(`[OAuth] Full query:`, req.query);
  console.error(`[OAuth] Session user:`, req.session?.user?.id || 'none');

  if (!OAUTH_SERVICES.includes(service)) {
    console.error(`[OAuth] Service not in list: ${service}`);
    return res.status(400).json({ error: "Invalid OAuth service" });
  }
  // Discord bot installation callbacks arrive without a state parameter because
  // the user navigated to the Discord auth URL directly (not via /oauth/authorize/:service).
  // In this case, fall back to the authenticated session user to identify the owner.
  const isDiscordBotInstall = service === 'discord' && !state && req.query.guild_id;

  if (!state && !isDiscordBotInstall) {
    return res.status(400).json({ error: "Invalid or expired state token" });
  }

  // Check state in session (where it was stored during authorize step)
  const stateMeta = isDiscordBotInstall
    ? { mode: 'connect', ownerId: req.session?.user?.id || null, returnTo: '/dashboard/services' }
    : req.session?.oauthStateMeta?.[state];

  if (!stateMeta && !isDiscordBotInstall) {
    return res.status(400).json({ error: "Invalid or expired state token - not found in session" });
  }

  if (!stateMeta) {
    return res.status(400).json({ error: "Invalid or expired state token - not found in session" });
  }

  // Provider denied/failed before issuing a code (common for scope/config problems)
  if (providerError) {
    const details = {
      service,
      providerError,
      providerErrorDescription: providerErrorDescription || null,
      state,
    };
    console.warn('[OAuth] Provider returned error on callback:', details);

    const wantsJson = String(req.query.json || '').toLowerCase() === '1';
    if (wantsJson) {
      return res.status(400).json({
        error: 'OAuth provider rejected authorization',
        service,
        providerError,
        providerErrorDescription: providerErrorDescription || null,
      });
    }

    const msg = encodeURIComponent(providerErrorDescription || providerError);
    return res.redirect(`/dashboard/services?oauth_error=${encodeURIComponent(providerError)}&oauth_error_description=${msg}&service=${encodeURIComponent(service)}`);
  }

  if (!code) {
    return res.status(400).json({
      error: "Missing authorization code",
      hint: "Provider likely returned an error instead of a code. Check callback query params: error / error_description",
      service,
    });
  }

  // Clean up state token from session after validation
  if (req.session?.oauthStateMeta) delete req.session.oauthStateMeta[state];

  // Prevent open redirect — validate using URL parsing, not string prefix checks
  let safeReturnTo = '/dashboard/';
  if (stateMeta.returnTo) {
    try {
      const parsed = new URL(stateMeta.returnTo, 'http://localhost');
      if (parsed.hostname === 'localhost') {
        safeReturnTo = parsed.pathname + (parsed.search || '') + (parsed.hash || '');
      }
    } catch {
      // malformed URL — use default
    }
  }

  try {
    const adapter = oauthAdapters[service];
    const runtimeTokenParams = {};
    if (['twitter', 'airtable', 'canva'].includes(service)) {
      const { codeVerifier } = buildPkcePairFromState(state);
      runtimeTokenParams.code_verifier = codeVerifier;
    }
    console.log(`[OAuth] Exchanging code for token with ${service} adapter...`);
    const tokenData = await adapter.exchangeCodeForToken(code, runtimeTokenParams);

    // Token will be stored AFTER user is created/authenticated
    const expiresAt = tokenData.expiresIn
      ? new Date(Date.now() + tokenData.expiresIn * 1000).toISOString()
      : null;

    updateOAuthStatus(service, "connected");

    let tokenStoredForUser = false;

    if ((service === 'google' || service === 'facebook' || service === 'github') && stateMeta.mode === 'login') {
      const profileResp = await oauthAdapters[service].verifyToken(tokenData.accessToken).catch(() => ({ valid: false, data: {} }));
      const p = profileResp?.data || {};

      let idTokenPayload = {};
      if (service === 'google' && tokenData?.idToken) {
        try {
          const [, payload = ''] = String(tokenData.idToken).split('.');
          const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
          idTokenPayload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) || {};
        } catch {
          idTokenPayload = {};
        }
      }

      const email = String(p.email || idTokenPayload.email || '').trim().toLowerCase() || null;
      const providerUserId = String(
        p.id
        || p.sub
        || p.user_id
        || p.login
        || idTokenPayload.sub
        || ''
      ).trim() || null;
      const name = p.name || idTokenPayload.name || p.given_name || idTokenPayload.given_name || p.login || `${service}_user`;
      const avatarUrl = p.picture?.data?.url || p.picture || idTokenPayload.picture || null;

      const usernameSeed = String(email || p.login || providerUserId || `${service}_${Date.now()}`);
      const usernameBase = usernameSeed
        .split('@')[0]
        .replace(/[^a-zA-Z0-9_.-]/g, '')
        .slice(0, 30) || `${service}_${Date.now()}`;

      const appUserByEmail = email
        ? getUsers().find((u) => String(u.email || '').toLowerCase() === email)
        : null;
      // SECURITY: login path must only match existing accounts by trusted identifier (email).
      // Never match by derived username here, otherwise a non-existent OAuth identity can
      // accidentally map/create the wrong account flow.
      let appUser = appUserByEmail || null;

      // NEW USER: Store OAuth data in session and route to explicit signup flow (no silent login/create)
      if (!appUser) {
        // BETA cap: block new-user creation at the callback itself so the user never
        // bounces through the signup wizard only to be rejected at the final step.
        if (betaMode.isBetaMode() && betaMode.isBetaFull()) {
          const waitlistEmail = email ? `&email=${encodeURIComponent(email)}` : '';
          return res.redirect(`/?beta=full${waitlistEmail}`);
        }
        req.session.oauth_signup = {
          service,
          providerUserId,
          email,
          name,
          avatarUrl,
          recommendedUsername: usernameBase,
          profileData: p,
          oauthToken: {
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken || null,
            expiresAt,
            scope: tokenData.scope || null,
          },
          source: 'oauth_login_callback',
          nonce: crypto.randomBytes(16).toString('hex'),
          createdAt: new Date().toISOString(),
        };

        const redirectUrl = `/dashboard/?oauth_service=${service}&oauth_status=signup_required&signup=true`;
        return req.session.save(() => {
          res.redirect(redirectUrl);
        });
      }

      // BUG-6: EXISTING USER: Store credentials in session and require explicit user confirmation
      // Do NOT auto-login without user consent, even for existing accounts
      appUser = updateUserOAuthProfile(appUser.id, { displayName: name, email, avatarUrl }) || appUser;

      // SECURITY FIX: If 2FA is enabled, require TOTP before completing OAuth login.
      // Route through the 2FA challenge flow (same as password login).
      if (appUser.twoFactorEnabled) {
        req.session.pending_2fa_user = {
          id: appUser.id,
          username: appUser.username,
          email: appUser.email || email,
          displayName: appUser.displayName || name,
          avatarUrl: appUser.avatarUrl || avatarUrl || null,
          twoFactorEnabled: true,
          createdAt: new Date().toISOString(),
        };
        // Preserve returnTo so it survives the 2FA challenge step
        if (safeReturnTo && safeReturnTo !== '/dashboard/') {
          req.session.pending_2fa_returnTo = safeReturnTo;
        }
        console.log(`[OAuth Callback] 2FA required for user: ${appUser.id}, routing to 2FA challenge`);
        return req.session.save((err) => {
          if (err) console.error('[OAuth Callback] Session save error before 2FA redirect:', err);
          res.redirect(`/dashboard/?oauth_service=${encodeURIComponent(service)}&oauth_status=pending_2fa`);
        });
      }

      // Store OAuth credentials in session pending user confirmation
      req.session.oauth_login_pending = {
        service,
        userId: appUser.id,
        username: appUser.username,
        email: appUser.email || email,
        displayName: appUser.displayName || name,
        avatarUrl: appUser.avatarUrl || avatarUrl || null,
        providerUserId,
        hasTwoFa: appUser.twoFactorEnabled,
        tokenData: {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken || null,
          expiresAt,
          scope: tokenData.scope || null,
        },
        confirmedAt: null, // Will be set when user confirms
        createdAt: new Date().toISOString(),
      };

      console.log(`[OAuth] Stored pending login credentials in session for user: ${appUser.id}`);

      // Redirect to confirmation page instead of auto-logging in
      const confirmToken = crypto.randomBytes(16).toString('hex');

      // Store BOTH in session AND in database as backup
      // Session: for normal case where cookies are sent
      req.session.oauth_confirm = { token: confirmToken, createdAt: Date.now() };
      // Note: req.session.oauth_login_pending is already set above with appUser data
      // No need to redefine it here

      // Database: backup in case session cookie is lost
      const dbConfirmId = 'oauth_confirm_' + crypto.randomBytes(16).toString('hex');
      const confirmExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min expiry
      try {
        db.prepare(`
          INSERT INTO oauth_pending_logins (id, service_name, user_id, token, user_data, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          dbConfirmId,
          service,
          appUser.id,
          confirmToken,
          JSON.stringify({
            userId: appUser.id,
            email: appUser.email || email,
            username: appUser.username,
            displayName: appUser.displayName || name,
            avatarUrl: appUser.avatarUrl || avatarUrl || null,
            hasTwoFa: appUser.twoFactorEnabled,
          }),
          new Date().toISOString(),
          confirmExpiresAt
        );
        console.log(`[OAuth Callback] ✅ Stored pending login in DB: ${dbConfirmId}`);
      } catch (dbErr) {
        console.error('[OAuth Callback] Warning: Failed to store pending login in DB:', dbErr.message);
        // Continue anyway - session storage is the primary mechanism
      }

      // CRITICAL: Session must be persisted BEFORE redirect
      // NOTE: `return` is required here to stop the outer function from continuing
      // and sending a second response, which would crash the server.
      return req.session.save((err) => {
        if (err) {
          console.error('[OAuth Callback] ❌ Session save failed before confirm_login redirect:', err);
        }

        const nextUrl = encodeURIComponent(safeReturnTo);
        const confirmUrl = `/dashboard/?oauth_service=${service}&oauth_status=confirm_login&next=${nextUrl}&token=${confirmToken}`;
        res.redirect(confirmUrl);
      });
    }

    // Store token for authenticated owner (connect flow and non-primary login flow)
    const oauthOwnerId = req.session?.user?.id ? String(req.session.user.id) : (stateMeta?.ownerId ? String(stateMeta.ownerId) : null);

    // Never auto-login users in connect mode.
    // If user is unauthenticated, abort to prevent unexpected account restoration.
    if (!oauthOwnerId && stateMeta?.mode === 'connect' && !tokenStoredForUser) {
      return res.redirect(`/dashboard/?oauth_service=${service}&oauth_status=error&error=${encodeURIComponent('login_required_for_connect')}`);
    }

    if (oauthOwnerId && !tokenStoredForUser) {
      // Enforce service connection plan limit before storing
      const currentConnections = countConnectedOAuthServices(oauthOwnerId);
      const planCheckReq = { user: req.user || { id: oauthOwnerId }, session: req.session, tokenMeta: req.tokenMeta, headers: req.headers };
      const connLimitErr = enforcePlanLimit(planCheckReq, 'serviceConnections', currentConnections, 1);
      if (connLimitErr) {
        console.warn(`[OAuth Callback] Plan limit reached for user ${oauthOwnerId}: serviceConnections=${currentConnections}`);
        return res.redirect(`/dashboard/?oauth_service=${service}&oauth_status=error&error=${encodeURIComponent('plan_limit_reached')}`);
      }

      const storeResult = storeOAuthToken(service, oauthOwnerId, tokenData.accessToken, tokenData.refreshToken || null, expiresAt, tokenData.scope);
      tokenStoredForUser = true;
      logger.info('[OAuth Callback] token stored', { service });

      // CRITICAL: Ensure req.session.user is populated for subsequent API calls
      // This is absolutely essential for /api/v1/oauth/status to find the user
      if (!req.session.user && oauthOwnerId) {
        const ownerUser = getUserById(oauthOwnerId);

        if (ownerUser) {
          req.session.user = {
            id: ownerUser.id,
            username: ownerUser.username,
            displayName: ownerUser.displayName || ownerUser.username,
            email: ownerUser.email || null,
            avatarUrl: ownerUser.avatarUrl || null,
            twoFactorEnabled: Boolean(ownerUser.twoFactorEnabled),
          };
        } else {
          logger.warn('[OAuth Callback] getUserById returned null', { service });
        }
      }
    }

    if (req.session.user && typeof getWorkspaces === 'function') {
      const ws = getWorkspaces(req.session.user.id);
      if (ws?.length) {
        req.session.currentWorkspace = ws[0].id;
        incrementUsageDaily(ws[0].id, new Date().toISOString().slice(0, 10), {
          active_services: countConnectedOAuthServices(req.session.user.id),
        });
      }
    }

    // Emit notification for service connection (Phase 3.5)
    if (req.session.user) {
      const ws = typeof getWorkspaces === 'function' ? getWorkspaces(req.session.user.id) : [];
      const workspaceId = ws?.[0]?.id || 'default';
      NotificationDispatcher.onServiceConnected(workspaceId, req.session.user.id, service)
        .catch(err => console.error('Notification dispatch error:', err));
      NotificationService.logActivity(req.session.user.id, 'service_connected', 'service', {
        resourceId: service, resourceName: service, actorType: 'user', actorId: req.session.user.id, result: 'success', ipAddress: req.ip,
      });
    }

    createAuditLog({
      requesterId: req.ip,
      action: "oauth_callback_success",
      resource: `/oauth/callback/${service}`,
      ip: req.ip,
      details: { service, mode: stateMeta.mode || 'connect', scope: tokenData.scope }
    });

    const next = encodeURIComponent(safeReturnTo);

    // Retrieve existing master token for the session — NEVER create a new one here.
    // The master token is an API key for AI agent access; only the explicit
    // /tokens/master/bootstrap or /tokens/master/regenerate endpoints may create one.
    let masterToken = req.session.masterTokenRaw;
    if (masterToken && req.session.masterTokenId) {
      const tokenRow = db.prepare('SELECT revoked_at FROM access_tokens WHERE id = ?').get(req.session.masterTokenId);
      if (!tokenRow || tokenRow.revoked_at) {
        // Stale; discard cached value
        masterToken = null;
        req.session.masterTokenRaw = null;
        req.session.masterTokenId  = null;
      }
    }
    if (!masterToken && oauthOwnerId) {
      const existing = getExistingMasterToken(oauthOwnerId);
      if (existing) {
        masterToken = existing.rawToken;
        req.session.masterTokenId = existing.tokenId;
      }
    }

    // Store in session if found so /api/v1/auth/me can return it to the frontend
    if (masterToken) {
      req.session.masterTokenRaw = masterToken;
      logger.debug('[OAuth] master token stored in session');
    } else {
      console.log(`[OAuth Callback] No existing master token found — frontend will bootstrap one if needed`);
    }

    // Set master token as a persistent cookie so the dashboard can use it
    if (masterToken) {
      res.cookie('myapi_master_token', masterToken, {
        httpOnly: true,  // Not readable by JS; use GET /api/v1/auth/session-token instead
        secure: secureCookie,
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax'
      });
    }

    // Also set user info for quick access (use session.user which is already set)
    if (req.session.user) {
      res.cookie('myapi_user', JSON.stringify(req.session.user), {
        httpOnly: false, // Required: JS reads user info for dashboard display
        secure: secureCookie,
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax'
      });
    }

    const redirectUrl = `/dashboard/?oauth_service=${service}&oauth_status=connected&mode=${encodeURIComponent(stateMeta.mode || 'connect')}&next=${next}`;

    req.session.save((err) => {
      if (err) {
        console.error('[OAuth] Session save error:', err);
      }
      res.redirect(redirectUrl);
    });
  } catch (error) {
    createAuditLog({
      requesterId: req.ip,
      action: "oauth_callback_error",
      resource: `/oauth/callback/${service}`,
      ip: req.ip,
      details: { service, error: error.message }
    });
    const safeErrCode = (error.code || 'oauth_error').replace(/[^a-z0-9_]/gi, '').slice(0, 32) || 'oauth_error';
    res.redirect(`/dashboard/?oauth_service=${service}&oauth_status=error&error=${encodeURIComponent(safeErrCode)}`);
  }
});

// Helper: Try to authenticate and populate tokenMeta, but don't fail if not present
async function tryAuthenticate(req) {
  // Priority 1: Session user
  if (req.session?.user?.id) {
    req.tokenMeta = { tokenId: `sess_${req.session.user.id}`, scope: 'full', ownerId: String(req.session.user.id) };
    return;
  }

  // Priority 2: Bearer token
  const authHeader = req.headers["authorization"] || "";
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    const rawToken = parts[1];
    const tokens = getAccessTokens() || [];
    for (const tokenMeta of tokens) {
      if (!tokenMeta.revokedAt && tokenMeta.hash && await bcrypt.compare(rawToken, tokenMeta.hash).catch(() => false)) {
        req.tokenMeta = { tokenId: tokenMeta.id, scope: tokenMeta.scope, ownerId: String(tokenMeta.ownerId) };
        return;
      }
    }
  }
}

// GET /api/v1/oauth/status - Get all connected services
// PROTECTED endpoint: requires authentication for reliable userId resolution
app.get("/api/v1/oauth/status", async (req, res) => {
  // Note: This endpoint is PUBLIC because it's called from dashboard during OAuth flow
  // It needs to work even before user is fully authenticated
  await tryAuthenticate(req); // Best effort to identify user if logged in
  
  // Get user ID from available sources (in order of priority)
  let userId = null;
  if (req.session?.user?.id) {
    userId = String(req.session.user.id);
  } else if (req.tokenMeta?.ownerId) {
    userId = String(req.tokenMeta.ownerId);

    // Bearer token caller: enforce services:read or master scope
    const meta = req.tokenMeta;
    const isMasterToken = meta.scope === 'full' || meta.tokenType === 'master';
    if (!isMasterToken) {
      let scopes = [];
      try { const p = JSON.parse(meta.scope); scopes = Array.isArray(p) ? p : []; } catch { /* ignore */ }
      const hasAccess = scopes.some(s =>
        s === 'services:read' || s === 'services:write' || s.startsWith('services:')
      );
      if (!hasAccess) {
        return res.status(403).json({ error: "Requires 'services:read' scope" });
      }
    }
  }

  // If no user identified, return empty/all-disconnected status (public access)
  if (!userId) {
    const services = OAUTH_SERVICES.map(service => ({
      name: service,
      status: "disconnected",
      reason: "not_authenticated"
    }));
    return res.json({ services });
  }

  console.log(`[OAuth Status] Resolved userId: ${userId} (from tokenMeta.ownerId=${req.tokenMeta?.ownerId || 'null'}, session.user=${req.session?.user?.id || 'null'})`);

  const statuses = getOAuthStatus();

  const services = OAUTH_SERVICES.map(service => {
    const status = statuses.find(s => s.serviceName === service);

    // Check if user has an active token for this service (with error handling)
    let token = null;
    let connectionStatus = "disconnected";

    if (userId) {
      try {
        // Use cache to prevent CPU spike
        token = getCachedOAuthToken(service, userId);
        if (!token) {
          token = getOAuthToken(service, userId);
          if (token) {
            setCachedOAuthToken(service, userId, token);
          }
        }
        // Source of truth: actual token existence, not oauth_status table (which can be stale)
        connectionStatus = token && !token.revoked_at ? "connected" : "disconnected";
      } catch (err) {
        // Log decryption errors but don't crash
        console.warn(`[OAuth Status] Failed to decrypt token for ${service}:`, err.message);
        token = null;
        connectionStatus = "disconnected";
      }
    } else {
      connectionStatus = "disconnected";
    }

    return {
      name: service,
      status: connectionStatus,
      lastSync: status?.lastSyncedAt || null,
      lastApiCall: token?.lastApiCall || null,  // Phase 5.4: Last API call timestamp
      scope: token?.scope || null,
      enabled: isOAuthServiceEnabled(service),
      auth_type: 'oauth2',  // All services use OAuth 2.0
      auth_type_label: 'OAuth 2.0'
    };
  });

  // Log if authenticated
  if (req.tokenMeta?.tokenId || req.session?.user?.id) {
    createAuditLog({
      requesterId: req.tokenMeta?.tokenId || `session:${req.session.user.id}`,
      action: "get_oauth_status",
      resource: "/oauth/status",
      scope: req.tokenMeta?.scope || "session",
      ip: req.ip
    });
  }

  res.json({ services });
});

// POST /api/v1/oauth/confirm - Confirm pending OAuth login
app.post("/api/v1/oauth/confirm", authRateLimit, (req, res) => {
  try {
    const { token } = req.body || {};

    logger.debug('[OAuth Confirm] Attempting confirmation', { sessionId: req.sessionID, hasToken: !!token });

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing confirmation token' });
    }

    // Check if token matches what's in the session
    const oauthConfirm = req.session?.oauth_confirm;
    if (!oauthConfirm || oauthConfirm.token !== token) {
      console.log(`[OAuth Confirm] ❌ FAILED: Token mismatch or missing`);
      console.log(`  - Expected: ${oauthConfirm ? 'exists' : 'MISSING'}`);
      console.log(`  - Match: ${oauthConfirm?.token === token ? 'YES' : 'NO'}`);
      return res.status(403).json({ error: 'Invalid confirmation token' });
    }

    // Check confirm token expiry (15 minutes)
    if (Date.now() - oauthConfirm.createdAt > 15 * 60 * 1000) {
      delete req.session.oauth_confirm;
      return res.status(403).json({ error: 'Confirmation token expired. Please sign in again.' });
    }

    // Check if we have pending login credentials (try session first, then database as fallback)
    let pending = req.session?.oauth_login_pending;
    
    if (!pending) {
      console.log(`[OAuth Confirm] Session data missing, checking database for backup...`);
      
      // Fallback: Check if token exists in database as backup
      // This handles the case where session cookie was lost (e.g., user cleared browser storage)
      try {
        const pendingLogin = db.prepare(`
          SELECT user_data FROM oauth_pending_logins 
          WHERE token = ? 
          ORDER BY created_at DESC 
          LIMIT 1
        `).get(token);
        
        if (pendingLogin) {
          pending = JSON.parse(pendingLogin.user_data);
          console.log(`[OAuth Confirm] ✅ Found backup pending login in database`);
        }
      } catch (dbErr) {
        console.error('[OAuth Confirm] Error querying database backup:', dbErr.message);
      }
    }
    
    if (!pending) {
      console.log(`[OAuth Confirm] ❌ FAILED: No pending login found in session or database`);
      return res.status(400).json({ error: 'No pending login found. Please try signing up again.' });
    }

    // Move pending login to actual session user
    req.session.user = {
      id: pending.userId,
      email: pending.email,
      username: pending.username,
      displayName: pending.displayName,
      avatarUrl: pending.avatarUrl,
      twoFactorEnabled: pending.hasTwoFa,
    };

    console.log(`[OAuth Confirm] Setting session.user to ${pending.userId}`);
    
    // Set default workspace for this user
    const userWorkspaces = getWorkspaces(pending.userId);
    if (userWorkspaces?.length > 0) {
      req.session.currentWorkspace = userWorkspaces[0].id;
    }

    // Clear pending login and token
    delete req.session.oauth_login_pending;
    delete req.session.oauth_confirm;

    // Proactively load the canonical master token into session so the frontend
    // gets it immediately without a separate bootstrap round-trip
    const existingMasterForConfirm = getExistingMasterToken(pending.userId);
    if (existingMasterForConfirm) {
      req.session.masterTokenRaw = existingMasterForConfirm.rawToken;
      req.session.masterTokenId = existingMasterForConfirm.tokenId;
    }

    // Save session and respond
    req.session.save((err) => {
      if (err) {
        logger.error('[OAuth Confirm] Session save failed', { error: err.message });
        return res.status(200).json({ ok: true, user: req.session.user, warning: 'Session sync delayed' });
      }

      logger.info('[OAuth Confirm] Login confirmed', { userId: pending.userId });
      res.json({
        ok: true,
        user: req.session.user,
        bootstrap: existingMasterForConfirm
          ? { tokenId: existingMasterForConfirm.tokenId, hasToken: true }
          : null,
      });
    });
  } catch (err) {
    console.error('[OAuth Confirm] Error:', err);
    res.status(500).json({ error: 'Failed to confirm login' });
  }
});

// POST /api/v1/oauth/disconnect/:service - Revoke OAuth connection
app.post("/api/v1/oauth/disconnect/:service", authenticate, async (req, res) => {
  const { service } = req.params;

  // Validate service
  if (!OAUTH_SERVICES.includes(service)) {
    return res.status(400).json({ error: "Invalid OAuth service" });
  }

  try {
    const userId = getOAuthUserId(req);

    // Try to get token, but handle decryption errors gracefully
    let token = null;
    try {
      // Use cache to prevent CPU spike
      token = getCachedOAuthToken(service, userId);
      if (!token) {
        token = getOAuthToken(service, userId);
        if (token) {
          setCachedOAuthToken(service, userId, token);
        }
      }
    } catch (decryptErr) {
      console.warn(`[OAuth Disconnect] Token decryption failed for ${service} (old key?):`, decryptErr.message);
      // Token is corrupted/unreadable, just delete it from DB
      token = { accessToken: null };
    }

    if (!token) {
      return res.json({ ok: true, message: `${service} was not connected` });
    }

    // Try to revoke on remote service (only if we have a valid token)
    if (token.accessToken) {
      try {
        const adapter = oauthAdapters[service];
        await adapter.revokeToken(token.accessToken);
      } catch (revokeErr) {
        console.warn(`[OAuth Disconnect] Remote revocation failed for ${service}:`, revokeErr.message);
        // Don't fail if remote revocation fails - continue with local deletion
      }
    }

    // Delete token from database (always do this)
    revokeOAuthToken(service, userId);

    // Update OAuth status
    updateOAuthStatus(service, "disconnected");

    // Notify user of disconnection
    const disconnectWs = getWorkspaces(userId);
    if (disconnectWs?.length) {
      NotificationDispatcher.onServiceDisconnected(disconnectWs[0].id, userId, service)
        .catch(err => console.error('[OAuth Disconnect] Notification error:', err));
    }

    // Log disconnection (with safety check for tokenMeta)
    const requesterId = req.tokenMeta?.tokenId || req.session?.user?.id || 'unknown';
    const scope = req.tokenMeta?.scope || 'session';

    createAuditLog({
      requesterId,
      action: "oauth_disconnect",
      resource: `/oauth/disconnect/${service}`,
      scope,
      ip: req.ip,
      details: { service }
    });

    res.json({ ok: true, message: `Successfully disconnected ${service}` });
  } catch (error) {
    console.error(`OAuth disconnect error for ${service}:`, error.message);

    const requesterId = req.tokenMeta?.tokenId || req.session?.user?.id || 'unknown';
    const scope = req.tokenMeta?.scope || 'session';

    createAuditLog({
      requesterId,
      action: "oauth_disconnect_error",
      resource: `/oauth/disconnect/${service}`,
      scope,
      ip: req.ip,
      details: { service, error: error.message }
    });

    res.status(500).json({ error: "Failed to disconnect OAuth service", message: error.message });
  }
});

// GET /api/v1/oauth/test/:service - Test token validity
app.get("/api/v1/oauth/test/:service", authenticate, async (req, res) => {
  const { service } = req.params;

  // Validate service
  if (!OAUTH_SERVICES.includes(service)) {
    return res.status(400).json({ error: "Invalid OAuth service" });
  }

  try {
    const userId = getOAuthUserId(req);
    // Use cache to prevent CPU spike
    let token = getCachedOAuthToken(service, userId);
    if (!token) {
      token = getOAuthToken(service, userId);
      if (token) {
        setCachedOAuthToken(service, userId, token);
      }
    }

    if (!token) {
      return res.status(404).json({ error: "No token found for this service" });
    }

    // Verify token
    const adapter = oauthAdapters[service];
    const verification = await adapter.verifyToken(token.accessToken);

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: "oauth_test",
      resource: `/oauth/test/${service}`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { service, valid: verification.valid }
    });

    res.json({
      service,
      valid: verification.valid,
      error: verification.error,
      data: verification.data || null
    });
  } catch (error) {
    console.error(`OAuth test error for ${service}:`, error.message);
    res.status(500).json({ error: "Failed to test token", message: error.message });
  }
});

// ===== PHASE 5: KEY ROTATION & RATE LIMITING =====

// POST /api/v1/keys/rotate - Rotate encryption keys for OAuth tokens
app.post("/api/v1/keys/rotate", authenticate, adminOnly, async (req, res) => {
  try {
    const { rotateEncryptionKey } = require('./database');
    const newVaultKey = req.body.vaultKey || process.env.VAULT_KEY;

    if (!newVaultKey) {
      return res.status(400).json({ error: "vaultKey required in request body or VAULT_KEY env var" });
    }

    const result = rotateEncryptionKey(newVaultKey);

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: "key_rotation",
      resource: "/keys/rotate",
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { newVersion: result.newVersion, tokensRotated: result.tokensRotated }
    });

    res.json({
      ok: true,
      message: "Encryption keys rotated successfully",
      newVersion: result.newVersion,
      tokensRotated: result.tokensRotated,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Key rotation error:", err);
    res.status(500).json({ error: "Key rotation failed", message: err.message });
  }
});

// GET /api/v1/keys/status - Check encryption key status
app.get("/api/v1/keys/status", authenticate, adminOnly, (req, res) => {
  try {
    const { getKeyVersions, getCurrentKeyVersion } = require('./database');
    const versions = getKeyVersions();
    const current = getCurrentKeyVersion();

    res.json({
      currentVersion: current,
      allVersions: versions,
      totalVersions: versions.length
    });
  } catch (err) {
    console.error("Key status error:", err);
    res.status(500).json({ error: "Failed to get key status" });
  }
});

// POST /api/v1/admin/security/rotate-key — SOC 2 Phase 3.1
// Requires admin scope + TOTP code (when 2FA is enabled on the account)
// Quarterly rotation schedule: Jan 1, Apr 1, Jul 1, Oct 1
app.post('/api/v1/admin/security/rotate-key', authenticate, adminOnly, async (req, res) => {
  try {
    const { totpCode } = req.body;
    const userId = req.tokenMeta?.ownerId || req.session?.user?.id;

    // 2FA gate: if the account has 2FA enabled the caller must supply a valid TOTP code
    if (userId) {
      const owner = getUserById(userId);
      if (owner && owner.twoFactorEnabled) {
        if (!totpCode) {
          return res.status(401).json({ error: '2FA code required for key rotation', requires2FA: true });
        }
        const verified = speakeasy.totp.verify({
          secret: owner.totpSecret,
          encoding: 'base32',
          token: String(totpCode).replace(/\s+/g, ''),
          window: 2,
        });
        if (!verified) {
          createAuditLog({
            requesterId: userId,
            action: 'key_rotation_2fa_failed',
            resource: '/admin/security/rotate-key',
            scope: req.tokenMeta?.scope,
            ip: req.ip,
            details: { reason: 'invalid_totp' }
          });
          alerting.trackFailedLogin(req.ip);
          return res.status(401).json({ error: 'Invalid 2FA code', requires2FA: true });
        }
      }
    }

    const { rotateEncryptionKey } = require('./database');
    const newVaultKey = req.body.vaultKey || process.env.VAULT_KEY;

    if (!newVaultKey) {
      return res.status(400).json({ error: 'vaultKey required in request body or VAULT_KEY env var' });
    }

    const result = rotateEncryptionKey(newVaultKey);

    createAuditLog({
      requesterId: req.tokenMeta?.tokenId,
      action: 'key_rotation',
      resource: '/admin/security/rotate-key',
      scope: req.tokenMeta?.scope,
      ip: req.ip,
      details: { newVersion: result.newVersion, tokensRotated: result.tokensRotated, initiatedBy: userId }
    });

    res.json({
      ok: true,
      message: 'Encryption keys rotated successfully. Next scheduled rotation: see KEY_ROTATION_POLICY.md.',
      newVersion: result.newVersion,
      tokensRotated: result.tokensRotated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Key rotation error:', { error: err.message });
    res.status(500).json({ error: 'Key rotation failed', message: err.message });
  }
});

// ===== SERVICES & INTEGRATIONS =====

// Get all service categories
app.get('/api/v1/services/categories', (req, res) => {
  try {
    const { getServiceCategories } = require('./database');
    const categories = getServiceCategories();
    res.json({ data: categories });
  } catch (err) {
    console.error('Service categories error:', err);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Get all services (optionally filter by category)
app.get('/api/v1/services', (req, res) => {
  try {
    const { category } = req.query;
    const { getServices, getServicesByCategory, getServiceMethods } = require('./database');

    let services;
    if (category) {
      services = getServicesByCategory(category);
    } else {
      services = getServices();
    }

    const enriched = services.map((service) => {
      const methods = getServiceMethods(service.id);
      return buildServiceDefinition(service, methods);
    });

    res.json({ data: enriched, count: enriched.length });
  } catch (err) {
    console.error('Services list error:', err);
    res.status(500).json({ error: 'Failed to get services' });
  }
});

// Get specific service details
app.get('/api/v1/services/:name', (req, res) => {
  try {
    const { getServiceByName, getServiceMethods } = require('./database');
    const service = getServiceByName(req.params.name);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const methods = getServiceMethods(service.id);
    const definition = buildServiceDefinition(service, methods);

    res.json({ data: definition });
  } catch (err) {
    console.error('Service detail error:', err);
    res.status(500).json({ error: 'Failed to get service' });
  }
});

// Get service API methods
app.get('/api/v1/services/:serviceId/methods', (req, res) => {
  try {
    const { getServiceMethods } = require('./database');
    const methods = getServiceMethods(parseInt(req.params.serviceId));
    const safeParse = (value, fallback) => {
      if (!value) return fallback;
      try { return JSON.parse(value); } catch { return fallback; }
    };
    const normalized = methods.map((m) => ({
      id: m.id,
      methodName: m.method_name,
      httpMethod: String(m.http_method || 'GET').toUpperCase(),
      endpoint: m.endpoint,
      description: m.description || '',
      parameters: safeParse(m.parameters, []),
      responseExample: safeParse(m.response_example, null),
    }));

    res.json({ data: normalized, count: normalized.length });
  } catch (err) {
    console.error('Service methods error:', err);
    res.status(500).json({ error: 'Failed to get service methods' });
  }
});

function resolveServiceApiKeyToken(serviceName, userId) {
  const { getServicePreference } = require('./database');
  const prefs = getServicePreference(userId, serviceName);
  const preferenceKeys = [
    `${serviceName}_api_key`,
    'api_key',
    'token',
  ];

  for (const key of preferenceKeys) {
    const value = String(prefs?.preferences?.[key] || '').trim();
    if (value) {
      return { accessToken: value, source: `service_preferences.${key}` };
    }
  }

  const envValue = String(process.env[`${String(serviceName).toUpperCase()}_API_KEY`] || '').trim();
  if (envValue) {
    return { accessToken: envValue, source: `${String(serviceName).toUpperCase()}_API_KEY` };
  }

  return null;
}

// Test service connection
app.get('/api/v1/services/:serviceName/test', authenticate, async (req, res) => {
  try {
    const { serviceName } = req.params;
    const { getServiceByName } = require('./database');
    const service = getServiceByName(serviceName);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    let testResult;

    if (serviceName === 'fal') {
      const userId = getOAuthUserId(req);
      const token = resolveServiceApiKeyToken('fal', userId);
      if (!token?.accessToken) {
        return res.status(403).json({ error: "Service 'fal' is not connected. Add FAL API key in service preferences or FAL_API_KEY env." });
      }

      const https = require('https');
      const probe = await new Promise((resolve, reject) => {
        const reqProbe = https.request('https://fal.run/models', {
          method: 'GET',
          headers: {
            Authorization: `Key ${token.accessToken}`,
            Accept: 'application/json',
            'User-Agent': 'MyApi-Gateway/1.0',
          },
        }, (resp) => {
          let data = '';
          resp.on('data', (chunk) => (data += chunk));
          resp.on('end', () => {
            let parsed;
            try { parsed = JSON.parse(data); } catch { parsed = data; }
            resolve({ statusCode: resp.statusCode, data: parsed });
          });
        });
        reqProbe.on('error', reject);
        reqProbe.end();
      });

      if (probe.statusCode >= 400) {
        const message = typeof probe.data?.error === 'string' ? probe.data.error : 'Invalid fal API key or fal API unavailable';
        return res.status(probe.statusCode).json({ error: message, code: 'FAL_CONNECTION_TEST_FAILED' });
      }

      testResult = {
        service: serviceName,
        status: 'connected',
        apiEndpoint: service.api_endpoint,
        authType: service.auth_type,
        documentationUrl: service.documentation_url,
        timestamp: new Date().toISOString(),
        message: '✅ fal API key validated successfully.',
      };
    } else {
      // Simple health check - can be expanded for each service
      testResult = {
        service: serviceName,
        status: 'available',
        apiEndpoint: service.api_endpoint,
        authType: service.auth_type,
        documentationUrl: service.documentation_url,
        timestamp: new Date().toISOString(),
        message: `✅ Service is available and ready to integrate. Use the documentation link to set up authentication.`
      };
    }

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'service_test',
      resource: `/services/${serviceName}/test`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { service: serviceName }
    });

    res.json(testResult);
  } catch (err) {
    console.error('Service test error:', err);
    res.status(500).json({ error: 'Failed to test service', message: err.message });
  }
});

// Execute a service API call (AI communication layer)
app.post('/api/v1/services/:serviceName/execute', authenticate, async (req, res) => {
  // Determine read vs write based on the method's HTTP verb (resolved after service lookup)
  // Use services:read as the minimum required; write-methods will be caught at execution time if needed.
  // Default to requiring services:read; POST/PUT/DELETE methods require services:write.
  if (!hasScope(req, 'services:read') && !hasScope(req, 'services:write')) {
    return res.status(403).json({ error: "Requires 'services:read' or 'services:write' scope" });
  }
  try {
    const { serviceName } = req.params;
    const { method, params } = req.body;

    const { getServiceByName, getServiceMethods, getOAuthToken, isTokenExpired, refreshOAuthToken } = require('./database');
    const service = getServiceByName(serviceName);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const methods = getServiceMethods(service.id);
    const serviceDef = buildServiceDefinition(service, methods);
    const validation = validateExecutionInput(serviceDef, method, params);
    if (!validation.ok) {
      return res.status(validation.status || 400).json({ error: validation.error, code: validation.code || 'VALIDATION_ERROR' });
    }

    const userId = getOAuthUserId(req);
    const authType = service.auth_type || service.authType;
    let token = null;

    if (authType === 'api_key') {
      token = resolveServiceApiKeyToken(serviceName, userId);
    } else {
      // Use cache to prevent CPU spike
      token = getCachedOAuthToken(serviceName, userId);
      if (!token) {
        token = getOAuthToken(serviceName, userId);
        if (token) {
          setCachedOAuthToken(serviceName, userId, token);
        }
      }
    }

    if (!token && authType !== 'webhook' && authType !== 'none') {
      return res.status(403).json({ error: `Service '${serviceName}' not connected. Please connect it first.` });
    }

    // Auto-refresh expired OAuth tokens for execute endpoint (parity with /proxy)
    if (token && isTokenExpired(token)) {
      const provider = OAUTH_PROVIDER_DETAILS[serviceName];
      if (provider?.tokenUrl && token.refreshToken) {
        const clientId = process.env[`${serviceName.toUpperCase()}_CLIENT_ID`];
        const clientSecret = process.env[`${serviceName.toUpperCase()}_CLIENT_SECRET`];
        if (clientId && clientSecret) {
          const refreshResult = await refreshOAuthToken(serviceName, userId, provider.tokenUrl, clientId, clientSecret);
          if (refreshResult.ok) {
            token = refreshResult.token;
          } else {
            return res.status(401).json({ error: 'Token expired and refresh failed', details: refreshResult.error });
          }
        }
      }
    }

    // Allow default_request to dynamically target provider endpoints (e.g. /me)
    const methodToExecute = { ...validation.method };
    if (
      methodToExecute?.methodName === 'default_request' &&
      params &&
      (typeof params.endpoint === 'string' || typeof params.path === 'string')
    ) {
      methodToExecute.endpoint = params.endpoint || params.path;
    }

    const execution = await executeServiceMethod({
      serviceDef,
      method: methodToExecute,
      params: params || {},
      token,
    });

    const result = {
      service: serviceName,
      method,
      status: execution.ok ? 'executed' : 'failed',
      timestamp: new Date().toISOString(),
      response: execution,
    };

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'service_execute',
      resource: `/services/${serviceName}/execute`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: {
        service: serviceName,
        method,
        params,
        status: result.status,
        errorCode: execution.error?.code || null,
      }
    });

    if (!execution.ok) {
      const safeMessage = typeof execution.error?.message === 'string'
        ? execution.error.message
        : (() => {
            try { return JSON.stringify(execution.error?.message ?? execution.error ?? 'Execution failed'); }
            catch { return String(execution.error?.message ?? execution.error ?? 'Execution failed'); }
          })();
      return res.status(execution.statusCode || 500).json({ error: safeMessage, data: result });
    }

    res.json({ data: result });
  } catch (err) {
    console.error('Service execution error:', err);
    res.status(500).json({ error: 'Failed to execute service method' });
  }
});

// POST /api/v1/services/:serviceName/proxy - Direct API proxy (pass-through to service API)
// Allows AI agents to call any endpoint on a connected service without predefined methods
app.post('/api/v1/services/:serviceName/proxy', authenticate, async (req, res) => {
  try {
    const { serviceName } = req.params;
    const { path: apiPath, method: httpMethod = 'GET', body: reqBody, query: queryParams } = req.body;

    if (!apiPath) {
      return res.status(400).json({ error: 'path is required (e.g. "/user/repos")' });
    }

    // Service scope enforcement
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes((httpMethod || 'GET').toUpperCase());
    const requiredScope = isWrite ? 'services:write' : 'services:read';
    if (!hasScope(req, requiredScope)) {
      return res.status(403).json({
        error: 'Insufficient scope',
        message: `Token needs '${requiredScope}' scope`,
        hint: 'Update token scope to include service access'
      });
    }

    const { getOAuthToken, isTokenExpired, refreshOAuthToken, getServiceByName } = require('./database');
    const userId = getOAuthUserId(req);
    const serviceRecord = getServiceByName(serviceName);
    const authType = serviceRecord?.auth_type || 'oauth2';

    let token;
    if (authType === 'api_key') {
      token = resolveServiceApiKeyToken(serviceName, userId);
    } else {
      // Use cache to prevent CPU spike
      token = getCachedOAuthToken(serviceName, userId);
      if (!token) {
        token = getOAuthToken(serviceName, userId);
        if (token) {
          setCachedOAuthToken(serviceName, userId, token);
        }
      }
    }

    if (!token) {
      return res.status(403).json({ error: `Service '${serviceName}' not connected. Please connect it first.` });
    }

    // Auto-refresh if expired (OAuth only)
    if (authType !== 'api_key' && isTokenExpired(token)) {
      const provider = OAUTH_PROVIDER_DETAILS[serviceName];
      if (provider && provider.tokenUrl && token.refreshToken) {
        const clientId = process.env[`${serviceName.toUpperCase()}_CLIENT_ID`];
        const clientSecret = process.env[`${serviceName.toUpperCase()}_CLIENT_SECRET`];
        if (clientId && clientSecret) {
          const refreshResult = await refreshOAuthToken(serviceName, userId, provider.tokenUrl, clientId, clientSecret);
          if (refreshResult.ok) {
            token = refreshResult.token;
          } else {
            return res.status(401).json({ error: 'Token expired and refresh failed', details: refreshResult.error });
          }
        }
      }
    }

    const provider = OAUTH_PROVIDER_DETAILS[serviceName];
    const apiRoot = provider?.apiRoot || serviceRecord?.api_endpoint;
    if (!apiRoot) {
      return res.status(400).json({ error: `No API root configured for service '${serviceName}'` });
    }

    // Phase 5.2: Rate limiting check
    const { checkRateLimit, incrementRateLimit } = require('./database');
    const rateLimitConfig = { 'github': 100, 'google': 150, 'slack': 120, 'discord': 100 };
    const limitPerHour = rateLimitConfig[serviceName] || 100;

    const rateLimit = checkRateLimit(userId, serviceName, limitPerHour);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        service: serviceName,
        limit: limitPerHour,
        remaining: 0,
        resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      });
    }

    const https = require('https');
    const http = require('http');
    const targetUrl = new URL(apiPath.startsWith('/') ? `${apiRoot}${apiPath}` : `${apiRoot}/${apiPath}`);

    if (isPrivateHost(targetUrl.hostname)) {
      return res.status(400).json({ error: 'Target URL resolves to a private address' });
    }

    // Phase 3: Auto-inject service preferences (defaults)
    let finalBody = reqBody ? JSON.parse(JSON.stringify(reqBody)) : {};  // Deep copy
    try {
      const servicePrefs = getServicePreference(userId, serviceName);
      if (servicePrefs && servicePrefs.preferences) {
        const prefs = servicePrefs.preferences;

        // Auto-inject defaults based on service type
        if (serviceName === 'slack') {
          // If no channel is specified, inject the default
          if (!finalBody.channel && prefs.default_channel) {
            finalBody.channel = prefs.default_channel;
            console.log(`[ServicePrefs] Injected default Slack channel: ${prefs.default_channel}`);
          }
        } else if (serviceName === 'facebook') {
          // If no page_id is specified, inject the default
          if (!finalBody.page_id && prefs.default_page_id) {
            finalBody.page_id = prefs.default_page_id;
            console.log(`[ServicePrefs] Injected default Facebook page_id: ${prefs.default_page_id}`);
          }
        } else if (serviceName === 'instagram') {
          // If no account_id is specified, inject the default
          if (!finalBody.account_id && prefs.default_account_id) {
            finalBody.account_id = prefs.default_account_id;
            console.log(`[ServicePrefs] Injected default Instagram account_id: ${prefs.default_account_id}`);
          }
        } else if (serviceName === 'twitter') {
          // If no account is specified, inject the default
          if (!finalBody.account && prefs.default_account) {
            finalBody.account = prefs.default_account;
            console.log(`[ServicePrefs] Injected default Twitter account: ${prefs.default_account}`);
          }
        } else if (serviceName === 'discord') {
          // If no server_id/channel_id is specified, inject the defaults
          if (!finalBody.server_id && prefs.default_server_id) {
            finalBody.server_id = prefs.default_server_id;
            console.log(`[ServicePrefs] Injected default Discord server_id: ${prefs.default_server_id}`);
          }
          if (!finalBody.channel_id && prefs.default_channel_id) {
            finalBody.channel_id = prefs.default_channel_id;
            console.log(`[ServicePrefs] Injected default Discord channel_id: ${prefs.default_channel_id}`);
          }
        } else if (serviceName === 'linkedin') {
          // If no profile_id is specified, inject the default
          if (!finalBody.profile_id && prefs.default_profile_id) {
            finalBody.profile_id = prefs.default_profile_id;
            console.log(`[ServicePrefs] Injected default LinkedIn profile_id: ${prefs.default_profile_id}`);
          }
        } else if (serviceName === 'reddit') {
          // If no subreddit is specified, inject the default
          if (!finalBody.subreddit && prefs.default_subreddit) {
            finalBody.subreddit = prefs.default_subreddit;
            console.log(`[ServicePrefs] Injected default Reddit subreddit: ${prefs.default_subreddit}`);
          }
        } else if (serviceName === 'tiktok') {
          // If no account is specified, inject the default
          if (!finalBody.account && prefs.default_account) {
            finalBody.account = prefs.default_account;
            console.log(`[ServicePrefs] Injected default TikTok account: ${prefs.default_account}`);
          }
        }
      }
    } catch (err) {
      console.error(`[ServicePrefs] Error injecting preferences for ${serviceName}:`, err.message);
      // Continue anyway - preferences are optional
    }

    // Add query params
    if (queryParams && typeof queryParams === 'object') {
      Object.entries(queryParams).forEach(([k, v]) => targetUrl.searchParams.set(k, v));
    }

    const transport = targetUrl.protocol === 'https:' ? https : http;
    const method = (httpMethod || 'GET').toUpperCase();

    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'MyApi-Gateway/1.0',
    };

    if (token.accessToken) {
      if (serviceName === 'github') {
        headers['Authorization'] = `token ${token.accessToken}`;
      } else if (serviceName === 'fal') {
        headers['Authorization'] = `Key ${token.accessToken}`;
      } else if (serviceName === 'discord') {
        // Guild/channel endpoints require a bot token stored per-user in service preferences.
        // User endpoints (/users/@me) use the OAuth bearer token as normal.
        const isBotEndpoint = /^\/(guilds|channels)\//.test(apiPath);
        if (isBotEndpoint) {
          const discordPrefs = getServicePreference(userId, 'discord');
          const botToken = String(discordPrefs?.preferences?.bot_token || '').trim();
          if (!botToken) {
            return res.status(503).json({
              error: 'Discord bot token not configured',
              message: 'Reading guild/channel data requires a personal bot token. Save it via PUT /api/v1/services/discord/preferences with {"bot_token":"<your-token>"}.',
              hint: 'Get your bot token from: Discord Developer Portal → your app → Bot → Reset Token. The bot must be installed in the target server.'
            });
          }
          headers['Authorization'] = `Bot ${botToken}`;
        } else {
          headers['Authorization'] = `Bearer ${token.accessToken}`;
        }
      } else {
        headers['Authorization'] = `Bearer ${token.accessToken}`;
      }
    }

    let bodyStr = null;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && finalBody && Object.keys(finalBody).length > 0) {
      bodyStr = JSON.stringify(finalBody);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    // Track timing for response_time_ms
    const startTime = Date.now();

    const result = await new Promise((resolve, reject) => {
      const request = transport.request(targetUrl, { method, headers }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { parsed = data; }
          resolve({ statusCode: response.statusCode, data: parsed });
        });
      });
      request.on('error', reject);
      if (bodyStr) request.write(bodyStr);
      request.end();
    });

    const responseTimeMs = Date.now() - startTime;

    // Increment rate limit counter
    incrementRateLimit(userId, serviceName, limitPerHour);

    trackWorkspaceUsage(req, {
      api_calls: 1,
      active_services: countConnectedOAuthServices(userId),
    });

    // Update last_api_call timestamp
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE oauth_tokens SET last_api_call = ? WHERE service_name = ? AND user_id = ?
    `).run(now, serviceName, userId);

    // Phase 5.3: Enhanced audit logging with service details
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'service_proxy',
      resource: `/services/${serviceName}/proxy`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: {
        service: serviceName,
        path: apiPath,
        method,
        status: result.statusCode,
        service_name: serviceName,
        api_method: method,
        api_endpoint: apiPath,
        status_code: result.statusCode,
        response_time_ms: responseTimeMs
      }
    });

    // Phase 4.5: Include token instructions in proxy response
    let instructionsData = null;
    try {
      const InstructionManager = require('./lib/instructionManager');
      const instructionManager = new InstructionManager(db);
      const proxyInstructions = instructionManager.getProxyResponseInstructions(token.id || 'unknown', serviceName);
      const nextEndpoints = instructionManager.getNextEndpoints(serviceName);

      if (proxyInstructions) {
        instructionsData = {
          instructions: proxyInstructions.instructions,
          examples: proxyInstructions.examples,
          source: proxyInstructions.source,
          autoGenerated: proxyInstructions.autoGenerated,
          nextEndpoints
        };
      } else if (nextEndpoints.length > 0) {
        instructionsData = {
          nextEndpoints,
          note: 'No instructions recorded yet. Try these endpoints next.'
        };
      }
    } catch (err) {
      console.error('[ServiceProxy] Error fetching instructions:', err.message);
      // Continue without instructions if there's an error
    }

    const response = {
      ok: result.statusCode < 400,
      service: serviceName,
      statusCode: result.statusCode,
      data: result.data,
      meta: {
        endpoint: targetUrl.toString(),
        method,
        timestamp: new Date().toISOString(),
        responseTimeMs,
        rateLimit: {
          limit: limitPerHour,
          remaining: Math.max(0, rateLimit.remaining - 1),
          resetTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        }
      }
    };

    // Add instructions if available
    if (instructionsData) {
      response.instructions = instructionsData.instructions || undefined;
      response.examples = instructionsData.examples || undefined;
      response.nextEndpoints = instructionsData.nextEndpoints || undefined;
    }

    res.status(result.statusCode >= 400 ? result.statusCode : 200).json(response);
  } catch (err) {
    console.error('Service proxy error:', err);
    res.status(500).json({ error: 'Proxy request failed', message: err.message });
  }
});

// --- Brain API Endpoints ---

// Import brain components
const ContextEngine = require('./lib/context-engine');
const KnowledgeBase = require('./lib/knowledge-base');
const LLMAdapter = require('./lib/langchain-adapter');

// Initialize brain components
const brainConfig = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'brain.json'), 'utf8'));
  } catch {
    return { llm: { model: 'gemini-pro' }, context: { maxHistoryMessages: 10 } };
  }
})();

const contextEngine = new ContextEngine({
  maxHistoryMessages: brainConfig.context?.maxHistoryMessages || 10
});
const knowledgeBase = new KnowledgeBase({
  chunkSize: brainConfig.embeddings?.chunkSize || 500
});
let llmAdapter = null;

const kbUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['text/plain', 'text/markdown', 'application/pdf', 'application/json', 'text/csv'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  }
});
const kbUploadFields = kbUpload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'document', maxCount: 1 },
  { name: 'upload', maxCount: 1 },
  { name: 'kbFile', maxCount: 1 },
]);

const KB_UPLOAD_DIR = process.env.KB_UPLOAD_DIR || path.join(__dirname, 'uploads', 'knowledge-base');

function sanitizeFilename(filename = 'upload.bin') {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 180);
}

function ensureKbUploadDir() {
  if (!fs.existsSync(KB_UPLOAD_DIR)) {
    fs.mkdirSync(KB_UPLOAD_DIR, { recursive: true });
  }
}

async function persistUploadFile(uploadedFile) {
  ensureKbUploadDir();

  const originalName = uploadedFile.originalname || 'uploaded-file';
  const safeName = sanitizeFilename(originalName);
  const ext = path.extname(safeName) || '.bin';
  const base = path.basename(safeName, ext);
  const ts = Date.now();
  const random = crypto.randomBytes(6).toString('hex');
  const localFilename = `${base}-${ts}-${random}${ext}`;
  const localPath = path.join(KB_UPLOAD_DIR, localFilename);

  fs.writeFileSync(localPath, uploadedFile.buffer);

  // Future-ready: if S3 credentials exist we can mirror upload to S3.
  // For now, local persistence is guaranteed and acts as fallback/default.
  const hasS3Creds = Boolean(
    process.env.S3_BUCKET &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );

  return {
    storage: hasS3Creds ? 'local-fallback' : 'local',
    localPath,
    localFilename,
  };
}

function getLLMAdapter() {
  if (!llmAdapter) {
    llmAdapter = new LLMAdapter({
      model: brainConfig.llm?.model || 'gemini-pro',
      temperature: brainConfig.llm?.temperature || 0.7,
      maxTokens: brainConfig.llm?.maxTokens || 2048
    });
  }
  return llmAdapter;
}

function resolvePersonaScopeForRequest(req, requestedPersonaId) {
  const parsedRequestedPersonaId = requestedPersonaId !== undefined && requestedPersonaId !== null && requestedPersonaId !== ''
    ? parseInt(requestedPersonaId, 10)
    : null;

  if (parsedRequestedPersonaId !== null && Number.isNaN(parsedRequestedPersonaId)) {
    throw new Error('Invalid personaId. Must be a number.');
  }

  const allowedPersonas = Array.isArray(req.tokenMeta?.allowedPersonas) ? req.tokenMeta.allowedPersonas : null;

  if (allowedPersonas && allowedPersonas.length > 0) {
    if (parsedRequestedPersonaId !== null && !allowedPersonas.includes(parsedRequestedPersonaId)) {
      return { error: 'Requested persona is not allowed for this token', status: 403 };
    }

    const scopedPersonaId = parsedRequestedPersonaId !== null
      ? parsedRequestedPersonaId
      : (allowedPersonas.length === 1 ? allowedPersonas[0] : null);

    if (scopedPersonaId === null) {
      return {
        error: 'This token is scoped to multiple personas. Provide personaId in request.',
        status: 400,
      };
    }

    return { personaId: scopedPersonaId, scoped: true };
  }

  return {
    personaId: parsedRequestedPersonaId,
    scoped: parsedRequestedPersonaId !== null,
  };
}

function scoreByQuery(content = '', query = '') {
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 0;
  const haystack = String(content || '').toLowerCase();
  return terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
}

// POST /api/v1/brain/chat - Chat with context-aware AI
app.post('/api/v1/brain/chat', authenticate, async (req, res) => {
  if (!hasScope(req, 'chat')) return res.status(403).json({ error: "Requires 'chat' scope" });
  try {
    const { message, conversationId, model, temperature, personaId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const personaScope = resolvePersonaScopeForRequest(req, personaId);
    if (personaScope.error) {
      return res.status(personaScope.status || 400).json({ error: personaScope.error });
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const conv = createConversation(req.tokenMeta.tokenId, model || brainConfig.llm?.model);
      convId = conv.id;
    }

    // Assemble context
    const context = await contextEngine.assembleContext(convId, db);

    // Query global knowledge base
    let relevantDocs = knowledgeBase.queryKnowledgeBase(message, 3, getRequestOwnerId(req));
    relevantDocs = (Array.isArray(relevantDocs) ? relevantDocs : [])
      .filter((d) => isResourceAllowed(req, 'knowledge_docs', d.id));

    // Add persona-scoped docs + skills package when persona scope is active
    let personaDocs = [];
    let personaSkillPackages = [];
    if (personaScope.personaId !== null && personaScope.personaId !== undefined) {
      const ownerId = getRequestOwnerId(req);
      personaDocs = getPersonaDocumentContents(personaScope.personaId, ownerId)
        .filter((d) => isResourceAllowed(req, 'knowledge_docs', d.id));
      personaSkillPackages = Object.values(getPersonaSkillPackages(personaScope.personaId, ownerId))
        .filter((pkg) => isResourceAllowed(req, 'skills', pkg.id));
    }

    const rankedPersonaDocs = personaDocs
      .map((doc) => ({ ...doc, score: scoreByQuery(`${doc.title} ${doc.content}`, message) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const rankedSkillDocs = personaSkillPackages
      .flatMap((pkg) => (pkg.documents || []).map((doc) => ({
        ...doc,
        skillName: pkg.name,
        score: scoreByQuery(`${pkg.name} ${doc.title} ${doc.content}`, message),
      })))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Build system prompt
    let systemPrompt = context.systemPrompt;
    if (relevantDocs.length > 0) {
      systemPrompt += '\n\nRelevant documents:\n' +
        relevantDocs.map(d => `- ${d.title}`).join('\n');
    }

    if (rankedPersonaDocs.length > 0) {
      systemPrompt += '\n\nPersona-attached knowledge:\n' + rankedPersonaDocs
        .map((doc) => `### ${doc.title}\n${String(doc.content || '').slice(0, 2000)}`)
        .join('\n\n');
    }

    if (personaSkillPackages.length > 0) {
      systemPrompt += '\n\nPersona-attached skills:\n' + personaSkillPackages
        .map((pkg) => `- ${pkg.name}${pkg.description ? `: ${pkg.description}` : ''}`)
        .join('\n');
    }

    if (rankedSkillDocs.length > 0) {
      systemPrompt += '\n\nSkill-attached knowledge for persona:\n' + rankedSkillDocs
        .map((doc) => `### [${doc.skillName}] ${doc.title}\n${String(doc.content || '').slice(0, 2000)}`)
        .join('\n\n');
    }

    // Get recent messages
    const history = getConversationHistory(convId, 10);

    // Call LLM
    const llm = getLLMAdapter();
    const llmResponse = await llm.createCompletion(
      systemPrompt,
      message,
      history
    );

    // Store messages
    storeMessage(convId, 'user', message);
    storeMessage(convId, 'assistant', llmResponse.response);

    // Audit log
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'brain_chat',
      resource: '/api/v1/brain/chat',
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: {
        conversationId: convId,
        model: llmResponse.model,
        tokensUsed: llmResponse.tokensUsed
      }
    });

    res.json({
      response: llmResponse.response,
      conversationId: convId,
      tokensUsed: llmResponse.tokensUsed,
      contextUsed: {
        userProfile: !!context.user,
        persona: !!context.persona,
        memory: context.memory?.memories?.length || 0,
        documents: relevantDocs.length,
        personaDocuments: rankedPersonaDocs.length,
        personaSkills: personaSkillPackages.length,
        personaSkillDocuments: rankedSkillDocs.length,
        personaId: personaScope.personaId ?? null
      }
    });
  } catch (error) {
    console.error('Brain chat error:', error);
    res.status(500).json({ error: 'Failed to process chat', message: error.message });
  }
});

// GET /api/v1/brain/conversations - List conversations
app.get('/api/v1/brain/conversations', authenticate, (req, res) => {
  if (!hasScope(req, 'chat')) return res.status(403).json({ error: "Requires 'chat' scope" });
  try {
    const conversations = getConversations(req.tokenMeta.tokenId);

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'brain_conversations_list',
      resource: '/api/v1/brain/conversations',
      scope: req.tokenMeta.scope,
      ip: req.ip
    });

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// GET /api/v1/brain/conversations/:id - Get conversation with history
app.get('/api/v1/brain/conversations/:id', authenticate, (req, res) => {
  if (!hasScope(req, 'chat')) return res.status(403).json({ error: "Requires 'chat' scope" });
  try {
    const { id } = req.params;
    const conversation = getConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = getConversationHistory(id, 100, false); // Don't include private by default

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'brain_conversation_view',
      resource: `/api/v1/brain/conversations/${id}`,
      scope: req.tokenMeta.scope,
      ip: req.ip
    });

    res.json({
      conversation,
      messages
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// POST /api/v1/brain/knowledge-base - Add document
app.post('/api/v1/brain/knowledge-base', authenticate, async (req, res) => {
  if (!isMaster(req) && !hasScope(req, 'knowledge')) {
    return res.status(403).json({ error: "Requires 'knowledge' scope or master token" });
  }
  try {
    const { source, title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' });
    }

    const currentBytes = getKnowledgeBaseBytesUsed(req);
    const incomingBytes = Buffer.byteLength(String(content || ''), 'utf8');
    const kbLimitErr = enforcePlanLimit(req, 'knowledgeBytes', currentBytes, incomingBytes);
    if (kbLimitErr) return res.status(403).json(kbLimitErr);

    const ownerId = getRequestOwnerId(req);
    const docs = await knowledgeBase.addDocument(source || 'agent', title, content, ownerId);

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'kb_document_added',
      resource: '/api/v1/brain/knowledge-base',
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { source, title, documentCount: docs.length }
    });

    res.json({
      id: docs[0]?.id,
      title: docs[0]?.title,
      tokensProcessed: content.split(/\s+/).length,
      documentsCreated: docs.length
    });
  } catch (error) {
    console.error('Add KB document error:', error);
    res.status(500).json({ error: 'Failed to add document' });
  }
});

// PUT /api/v1/brain/knowledge-base/:id - Update an existing KB document
app.put('/api/v1/brain/knowledge-base/:id', authenticate, async (req, res) => {
  if (!isMaster(req) && !hasScope(req, 'knowledge')) {
    return res.status(403).json({ error: "Requires 'knowledge' scope or master token" });
  }
  try {
    const ownerId = getRequestOwnerId(req);
    const { title, content, source } = req.body;

    if (!content) return res.status(400).json({ error: 'content is required' });

    // Per-resource allow-list gate (narrow-scoped token).
    if (!isResourceAllowed(req, 'knowledge_docs', req.params.id)) {
      return res.status(403).json({ error: 'Document not accessible with this token' });
    }

    const existing = getKBDocumentById(req.params.id, ownerId);
    if (!existing) return res.status(404).json({ error: 'Document not found' });

    const updated = updateKBDocument(req.params.id, { title, content, source }, ownerId);

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'kb_document_updated',
      resource: `/api/v1/brain/knowledge-base/${req.params.id}`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { title: updated?.title }
    });

    res.json({ ok: true, document: updated });
  } catch (error) {
    console.error('Update KB document error:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// POST /api/v1/brain/knowledge-base/upsert - Create or update a document by title
// Useful for agents that want to maintain a named document (e.g. "memory.md")
app.post('/api/v1/brain/knowledge-base/upsert', authenticate, async (req, res) => {
  // SECURITY FIX: KB write access restricted to master tokens only
  // Non-master tokens with 'knowledge' scope can only READ, not modify/create
  if (!isMaster(req)) {
    createAuditLog({
      requesterId: req.tokenMeta?.tokenId || 'unknown',
      action: 'kb_document_upsert_denied',
      resource: '/api/v1/brain/knowledge-base/upsert',
      scope: req.tokenMeta?.scope || 'unknown',
      ip: req.ip,
      details: { reason: 'insufficient_scope_for_write' }
    });
    return res.status(403).json({ error: "Only master token can create or update knowledge base documents" });
  }
  try {
    const { title, content, source } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

    const ownerId = getRequestOwnerId(req);
    const existing = getKBDocumentByTitle(title, ownerId);

    let doc;
    let action;
    if (existing) {
      doc = updateKBDocument(existing.id, { content, source: source || existing.source }, ownerId);
      action = 'updated';
    } else {
      const currentBytes = getKnowledgeBaseBytesUsed(req);
      const incomingBytes = Buffer.byteLength(String(content || ''), 'utf8');
      const kbLimitErr = enforcePlanLimit(req, 'knowledgeBytes', currentBytes, incomingBytes);
      if (kbLimitErr) return res.status(403).json(kbLimitErr);

      const docs = await knowledgeBase.addDocument(source || 'agent', title, content, ownerId);
      doc = docs[0];
      action = 'created';
    }

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: `kb_document_${action}`,
      resource: '/api/v1/brain/knowledge-base/upsert',
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { title, action }
    });

    res.json({ ok: true, action, document: { id: doc?.id, title: doc?.title } });
  } catch (error) {
    console.error('Upsert KB document error:', error);
    res.status(500).json({ error: 'Failed to upsert document' });
  }
});

// POST /api/v1/brain/knowledge-base/upload - Upload and ingest document
app.post('/api/v1/brain/knowledge-base/upload', authenticate, kbUploadFields, async (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can upload knowledge base documents' });
  try {
    const uploadedFile = req.files?.file?.[0] || req.files?.document?.[0] || req.files?.upload?.[0] || req.files?.kbFile?.[0];
    if (!uploadedFile) {
      return res.status(400).json({
        error: 'No file received. Use multipart/form-data with one of these field names: file, document, upload, kbFile.',
      });
    }

    const originalName = uploadedFile.originalname || 'uploaded-file';
    const ext = path.extname(originalName).toLowerCase();
    const mimeType = (uploadedFile.mimetype || '').toLowerCase();

    const isTextLike = ext === '.txt' || ext === '.md' || mimeType === 'text/plain' || mimeType === 'text/markdown';
    const isPdf = ext === '.pdf' || mimeType === 'application/pdf';

    if (!isTextLike && !isPdf) {
      return res.status(400).json({ error: 'Unsupported file type. Supported: .txt, .md, .pdf' });
    }

    let content = '';
    if (isTextLike) {
      content = uploadedFile.buffer.toString('utf8');
    } else {
      try {
        const parsed = await pdfParse(uploadedFile.buffer);
        content = (parsed?.text || '').trim();
      } catch (err) {
        return res.status(400).json({
          error: 'Failed to parse PDF. Please upload a text-based PDF or convert it to .txt/.md.',
          details: err.message,
        });
      }
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'No readable text found in uploaded file' });
    }

    const currentBytes = getKnowledgeBaseBytesUsed(req);
    const incomingBytes = Buffer.byteLength(String(content || ''), 'utf8');
    const kbLimitErr = enforcePlanLimit(req, 'knowledgeBytes', currentBytes, incomingBytes);
    if (kbLimitErr) return res.status(403).json(kbLimitErr);

    const persisted = await persistUploadFile(uploadedFile);
    const docs = await knowledgeBase.addDocument('upload', originalName, content, getRequestOwnerId(req));

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'kb_document_uploaded',
      resource: '/api/v1/brain/knowledge-base/upload',
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: {
        filename: originalName,
        mimeType: uploadedFile.mimetype,
        bytes: uploadedFile.size,
        chunks: docs.length,
        storage: persisted.storage,
        localPath: persisted.localPath,
      }
    });

    res.status(201).json({
      ok: true,
      file: {
        name: originalName,
        size: uploadedFile.size,
        mimeType: uploadedFile.mimetype,
        storage: persisted.storage,
        localPath: persisted.localPath,
      },
      documentsCreated: docs.length,
      documents: docs.map((d) => ({ id: d.id, title: d.title, source: d.source, createdAt: d.createdAt })),
    });
  } catch (error) {
    console.error('Upload KB document error:', error);
    res.status(500).json({ error: 'Failed to upload document', message: error.message });
  }
});

// GET /api/v1/brain/knowledge-base - List KB documents
app.get('/api/v1/brain/knowledge-base', authenticate, (req, res) => {
  if (!hasScope(req, 'knowledge')) return res.status(403).json({ error: "Requires 'knowledge' scope" });
  try {
    const ownerId = getRequestOwnerId(req);
    let documents = getKBDocuments(ownerId);

    // Bundle token: restrict to documents attached to the bundled persona only
    const bundlePersonaId = getBundlePersonaId(req);
    if (bundlePersonaId) {
      const attached = db.prepare('SELECT document_id FROM persona_documents WHERE persona_id = ?').all(bundlePersonaId);
      const allowedIds = new Set(attached.map(r => r.document_id));
      documents = Array.isArray(documents) ? documents.filter(d => allowedIds.has(d.id)) : documents;
    }

    // Per-resource allow-list filter: if the token specifies knowledge_docs,
    // drop everything else. No-op for master tokens and tokens without an allow-list.
    if (Array.isArray(documents)) {
      documents = documents.filter((d) => isResourceAllowed(req, 'knowledge_docs', d.id));
    }

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'kb_documents_list',
      resource: '/api/v1/brain/knowledge-base',
      scope: req.tokenMeta.scope,
      ip: req.ip
    });

    res.json(documents);
  } catch (error) {
    console.error('Get KB documents error:', error);
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

// GET /api/v1/brain/knowledge-base/:id - Get full KB document
app.get('/api/v1/brain/knowledge-base/:id', authenticate, (req, res) => {
  if (!hasScope(req, 'knowledge')) return res.status(403).json({ error: "Requires 'knowledge' scope" });
  try {
    const { id } = req.params;
    const ownerId = getRequestOwnerId(req);

    // Per-resource allow-list gate (narrow-scoped token).
    if (!isResourceAllowed(req, 'knowledge_docs', id)) {
      return res.status(403).json({ error: 'Document not accessible with this token' });
    }

    const doc = getKBDocumentById(id, ownerId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Bundle token: block access to docs not attached to the bundled persona
    const bundlePersonaId = getBundlePersonaId(req);
    if (bundlePersonaId) {
      const attached = db.prepare('SELECT document_id FROM persona_documents WHERE persona_id = ? AND document_id = ?').get(bundlePersonaId, id);
      if (!attached) return res.status(403).json({ error: 'Document not accessible with this token' });
    }

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'kb_document_viewed',
      resource: `/api/v1/brain/knowledge-base/${id}`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
    });

    res.json({ data: doc });
  } catch (error) {
    console.error('Get KB document error:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

// GET /api/v1/brain/knowledge-base/:id/attachments - list persona references
app.get('/api/v1/brain/knowledge-base/:id/attachments', authenticate, (req, res) => {
  if (!hasScope(req, 'knowledge') && !isMaster(req)) {
    return res.status(403).json({ error: "Requires 'knowledge' scope" });
  }
  if (!isResourceAllowed(req, 'knowledge_docs', req.params.id)) {
    return res.status(403).json({ error: 'Document not accessible with this token' });
  }
  try {
    const { id } = req.params;
    const personaDocs = db.prepare(`
      SELECT p.id as personaId, p.name as personaName, 'direct_document' as linkType
      FROM persona_documents pd
      JOIN personas p ON p.id = pd.persona_id
      WHERE pd.document_id = ?
    `).all(id);

    const personaSkillDocs = db.prepare(`
      SELECT p.id as personaId, p.name as personaName, s.id as skillId, s.name as skillName, 'skill_document' as linkType
      FROM persona_skill_documents psd
      JOIN persona_skills ps ON ps.persona_id = psd.persona_id AND ps.skill_id = psd.skill_id
      JOIN personas p ON p.id = psd.persona_id
      JOIN skills s ON s.id = psd.skill_id
      WHERE psd.document_id = ?
    `).all(id);

    res.json({ data: { direct: personaDocs, viaSkills: personaSkillDocs, total: personaDocs.length + personaSkillDocs.length } });
  } catch (error) {
    console.error('Get KB attachment usage error:', error);
    res.status(500).json({ error: 'Failed to inspect document attachments' });
  }
});

// DELETE /api/v1/brain/knowledge-base/:id - Delete KB document
app.delete('/api/v1/brain/knowledge-base/:id', authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can delete knowledge base documents' });
  try {
    const { id } = req.params;
    const ownerId = getRequestOwnerId(req);
    const success = deleteKBDocument(id, ownerId);

    if (!success) {
      return res.status(404).json({ error: 'Document not found' });
    }

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'kb_document_deleted',
      resource: `/api/v1/brain/knowledge-base/${id}`,
      scope: req.tokenMeta.scope,
      ip: req.ip
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete KB document error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ─── Memory API ───────────────────────────────────────────────────────────────
// AI agents (and users) store freeform markdown notes here.
// Each entry has an id + timestamp so any AI can resume context across sessions.

// GET /api/v1/memory - list all memories
app.get('/api/v1/memory', authenticate, (req, res) => {
  if (!hasScope(req, 'memory') && !isMaster(req)) return res.status(403).json({ error: "Insufficient scope — 'memory' scope required" });
  try {
    const ownerId = getRequestOwnerId(req);
    const memories = getMemories(ownerId, req.workspaceId || null);
    res.json({ data: memories });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

// POST /api/v1/memory - store a new memory
app.post('/api/v1/memory', authenticate, (req, res) => {
  if (!hasScope(req, 'memory') && !isMaster(req)) return res.status(403).json({ error: "Insufficient scope — 'memory' scope required" });
  try {
    const { content, source } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }
    const ownerId = getRequestOwnerId(req);
    // Infer source from token label if not explicitly provided
    const inferredSource = source || inferMemorySource(req);
    const memory = createMemory(content.trim(), ownerId, req.workspaceId || null, inferredSource);
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'memory_created',
      resource: `/api/v1/memory/${memory.id}`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
    });
    res.status(201).json({ data: memory });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store memory' });
  }
});

// PATCH /api/v1/memory/:id - update a memory
app.patch('/api/v1/memory/:id', authenticate, (req, res) => {
  if (!hasScope(req, 'memory') && !isMaster(req)) return res.status(403).json({ error: "Insufficient scope — 'memory' scope required" });
  try {
    const { content, source } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }
    const ownerId = getRequestOwnerId(req);
    const existing = getMemoryById(req.params.id, ownerId);
    if (!existing) return res.status(404).json({ error: 'Memory not found' });
    updateMemory(req.params.id, content.trim(), ownerId, source || null);
    res.json({ data: { ...existing, content: content.trim(), source: source || existing.source || 'user' } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update memory' });
  }
});

// DELETE /api/v1/memory - clear all memories
app.delete('/api/v1/memory', authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can clear all memories' });
  try {
    const ownerId = getRequestOwnerId(req);
    const count = clearMemories(ownerId, req.workspaceId || null);
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'memory_cleared',
      resource: '/api/v1/memory',
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { count },
    });
    res.json({ success: true, deleted: count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear memories' });
  }
});

// DELETE /api/v1/memory/:id - delete one memory
app.delete('/api/v1/memory/:id', authenticate, (req, res) => {
  if (!hasScope(req, 'memory') && !isMaster(req)) return res.status(403).json({ error: "Insufficient scope — 'memory' scope required" });
  try {
    const ownerId = getRequestOwnerId(req);
    const deleted = deleteMemory(req.params.id, ownerId);
    if (!deleted) return res.status(404).json({ error: 'Memory not found' });
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'memory_deleted',
      resource: `/api/v1/memory/${req.params.id}`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

// GET /api/v1/brain/context - Get current assembled context
app.get('/api/v1/brain/context', authenticate, async (req, res) => {
  if (!hasScope(req, 'knowledge')) return res.status(403).json({ error: "Requires 'knowledge' scope" });
  try {
    const { conversationId, personaId } = req.query;

    const personaScope = resolvePersonaScopeForRequest(req, personaId);
    if (personaScope.error) {
      return res.status(personaScope.status || 400).json({ error: personaScope.error });
    }

    let context;
    if (conversationId) {
      context = await contextEngine.assembleContext(conversationId, db);
    } else {
      // Return basic context without conversation history
      context = {
        user: contextEngine.loadUserProfile(),
        persona: contextEngine.loadPersona(),
        memory: contextEngine.loadMemory(),
        recentMessages: [],
        systemPrompt: contextEngine._buildSystemPrompt(
          contextEngine.loadUserProfile(),
          contextEngine.loadPersona(),
          contextEngine.loadMemory()
        )
      };
    }

    let personaDocuments = [];
    let personaSkills = [];
    if (personaScope.personaId !== null && personaScope.personaId !== undefined) {
      const ownerId = getRequestOwnerId(req);
      personaDocuments = getPersonaDocumentContents(personaScope.personaId, ownerId).map((doc) => ({
        id: doc.id,
        title: doc.title,
        source: doc.source,
        preview: String(doc.content || '').slice(0, 400),
        metadata: doc.metadata,
      }));
      personaSkills = Object.values(getPersonaSkillPackages(personaScope.personaId, ownerId)).map((pkg) => ({
        skillId: pkg.skillId,
        name: pkg.name,
        description: pkg.description,
        version: pkg.version,
        category: pkg.category,
        author: pkg.author,
        documents: (pkg.documents || []).map((d) => ({
          id: d.id,
          title: d.title,
          source: d.source,
          preview: String(d.content || '').slice(0, 400),
          metadata: d.metadata,
        })),
      }));
    }

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'brain_context_query',
      resource: '/api/v1/brain/context',
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: {
        personaId: personaScope.personaId ?? null,
        personaDocumentCount: personaDocuments.length,
        personaSkillCount: personaSkills.length,
      }
    });

    res.json({
      ...context,
      personaContext: {
        personaId: personaScope.personaId ?? null,
        documents: personaDocuments,
        skills: personaSkills,
      }
    });
  } catch (error) {
    console.error('Get context error:', error);
    res.status(500).json({ error: 'Failed to get context', message: error.message });
  }
});

// ===== DASHBOARD STATS =====
app.get('/api/v1/dashboard/stats', authenticate, (req, res) => {
  try {
    const ownerId = getRequestOwnerId(req);
    const personas = getPersonas(ownerId);
    const skills = getSkills(ownerId);
    const kbDocs = getKBDocuments(ownerId);
    res.json({
      personas: { total: personas.length, active: personas.filter(p => p.active).length },
      skills: { total: skills.length, active: skills.filter(s => s.active).length },
      knowledgeBase: { total: kbDocs.length },
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

// ===== SKILLS =====
function parseGitHubRepoUrl(repoUrl) {
  if (!repoUrl) return null;
  const trimmed = String(repoUrl).trim().replace(/\.git$/, '');

  const treeMatch = trimmed.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/\?#]+)\/tree\/([^\/]+)\/(.+)$/i);
  if (treeMatch) {
    return {
      owner: treeMatch[1],
      repo: treeMatch[2],
      branch: treeMatch[3],
      subpath: treeMatch[4],
      normalized: trimmed
    };
  }

  const m = trimmed.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/\?#]+)(?:[\/\?#].*)?$/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2], branch: null, subpath: null, normalized: `https://github.com/${m[1]}/${m[2]}` };
}

async function fetchGitHubRepoMetadata(repoUrl) {
  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) throw new Error('Only GitHub repository URLs are currently supported');

  const headers = { 'User-Agent': 'MyApi-Skill-Scanner' };
  const repoRes = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, { headers });
  if (!repoRes.ok) throw new Error('Repository not found or inaccessible');
  const repo = await repoRes.json();

  const defaultBranch = parsed.branch || repo.default_branch || 'main';
  const subpathPrefix = parsed.subpath ? `${parsed.subpath}/` : '';

  const readmeRes = await fetch(`https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${defaultBranch}/${subpathPrefix}README.md`, { headers });
  const pkgRes = await fetch(`https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${defaultBranch}/${subpathPrefix}package.json`, { headers });
  const skillDocRes = await fetch(`https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${defaultBranch}/${subpathPrefix}SKILL.md`, { headers });

  const readme = readmeRes.ok ? await readmeRes.text() : '';
  const skillDoc = skillDocRes.ok ? await skillDocRes.text() : '';
  let pkg = null;
  if (pkgRes.ok) {
    try { pkg = JSON.parse(await pkgRes.text()); } catch {}
  }

  let defaultName = repo.name;
  if (parsed.subpath) {
    const parts = parsed.subpath.split('/');
    defaultName = parts[parts.length - 1];
  }

  const name = pkg?.name || defaultName;
  const description = repo.description || pkg?.description || (readme.split('\n').find((l) => l.trim()) || '').replace(/^#\s*/, '') || 'Imported from repository';
  const version = pkg?.version || '1.0.0';
  const author = (typeof pkg?.author === 'string' ? pkg.author : pkg?.author?.name) || repo.owner?.login || '';

  const language = (repo.language || '').toLowerCase();
  const category = language.includes('python') ? 'automation'
    : language.includes('javascript') || language.includes('typescript') ? 'integration'
    : language.includes('go') || language.includes('rust') ? 'security'
    : 'custom';

  const scriptContent = skillDoc || readme || '';
  const scanner = runSkillScanner({ readme, skillDoc, pkg, repo });

  return {
    metadata: {
      name,
      description,
      version,
      author,
      category,
      repo_url: parsed.normalized,
      script_content: scriptContent,
      config_json: {
        source: 'github',
        stars: repo.stargazers_count || 0,
        forks: repo.forks_count || 0,
        default_branch: defaultBranch,
        topics: repo.topics || [],
        scanner,
      },
    },
    scanner,
  };
}

function runSkillScanner({ readme = '', skillDoc = '', pkg = null, repo = null }) {
  const text = `${readme}\n${skillDoc}\n${JSON.stringify(pkg || {})}`.toLowerCase();
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,
    /curl\s+.*\|\s*sh/,
    /wget\s+.*\|\s*bash/,
    /eval\(/,
    /child_process/,
    /powershell\s+-enc/,
    /bitcoin|crypto miner|keylogger/,
  ];
  const findings = dangerousPatterns
    .filter((rx) => rx.test(text))
    .map((rx) => `Matched pattern: ${rx}`);

  const hasLicense = /license/i.test(JSON.stringify(pkg || {})) || /license/i.test(readme);
  const score = Math.max(0, 100 - findings.length * 35 + (hasLicense ? 5 : 0) + ((repo?.stargazers_count || 0) > 3 ? 5 : 0));
  return {
    safe_to_use: findings.length === 0,
    score,
    badge: findings.length === 0 ? 'safe' : 'warning',
    findings,
    checked_at: new Date().toISOString(),
  };
}

app.get('/api/v1/skills', authenticate, (req, res) => {
  if (!hasScope(req, 'skills:read')) return res.status(403).json({ error: "Requires 'skills:read' scope" });
  try {
    const ownerId = getRequestOwnerId(req);
    
    // Multi-tenancy: Filter skills by workspace
    const workspaceId = req.workspaceId || req.session?.currentWorkspace;
    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace context required" });
    }
    
    // Validate user is member of workspace
    if (!req.workspaceMember && (!req.workspace || req.workspace.ownerId !== getOAuthUserId(req))) {
      return res.status(403).json({ error: "Not a member of this workspace" });
    }
    
    const skills = getSkills(ownerId, workspaceId);
    
    res.json({ data: skills });
  } catch (err) {
    console.error('Skills list error:', err);
    res.status(500).json({ error: 'Failed to get skills' });
  }
});

app.get('/api/v1/skills/:id', authenticate, (req, res) => {
  if (!hasScope(req, 'skills:read')) return res.status(403).json({ error: "Requires 'skills:read' scope" });
  try {
    const ownerId = getRequestOwnerId(req);
    const skill = getSkillById(req.params.id, ownerId);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    res.json({ data: skill });
  } catch (err) {
    console.error('Skill get error:', err);
    res.status(500).json({ error: 'Failed to get skill' });
  }
});

app.post('/api/v1/skills', authenticate, (req, res) => {
  if (!hasScope(req, 'skills:write')) return res.status(403).json({ error: "Requires 'skills:write' scope" });
  try {
    const { name, description, version, author, category, script_content, config_json, repo_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Idempotency for marketplace installs
    const listingId = (config_json && typeof config_json === 'object') ? config_json.marketplace_listing_id : null;
    if (listingId) {
      const existing = getSkills(getRequestOwnerId(req)).find((s) => {
        const cfg = s.config_json && typeof s.config_json === 'object' ? s.config_json : null;
        return String(cfg?.marketplace_listing_id || '') === String(listingId);
      });
      if (existing) {
        return res.status(200).json({ data: existing, already_installed: true });
      }
    }

    const ownerId = getRequestOwnerId(req);
    const skill = createSkill(name, description, version, author, category, script_content, config_json, repo_url, ownerId);
    res.status(201).json({ data: skill });
  } catch (err) {
    console.error('Skill create error:', err);
    res.status(500).json({ error: 'Failed to create skill' });
  }
});

app.post('/api/v1/skills/scan-repo', authenticate, async (req, res) => {
  try {
    const { repo_url } = req.body || {};
    if (!repo_url) return res.status(400).json({ error: 'repo_url is required' });
    const result = await fetchGitHubRepoMetadata(repo_url);
    res.json(result);
  } catch (err) {
    console.error('Skill scan repo error:', err);
    res.status(400).json({ error: err.message || 'Failed to scan repository' });
  }
});

app.post('/api/v1/skills/from-repo', authenticate, async (req, res) => {
  try {
    const { repo_url } = req.body || {};
    if (!repo_url) return res.status(400).json({ error: 'repo_url is required' });
    const { metadata, scanner } = await fetchGitHubRepoMetadata(repo_url);
    const ownerId = getRequestOwnerId(req);
    const skill = createSkill(
      metadata.name,
      metadata.description,
      metadata.version,
      metadata.author,
      metadata.category,
      metadata.script_content,
      metadata.config_json,
      metadata.repo_url,
      ownerId
    );
    res.status(201).json({ data: skill, scanner });
  } catch (err) {
    console.error('Skill create from repo error:', err);
    res.status(400).json({ error: err.message || 'Failed to import skill from repository' });
  }
});

app.put('/api/v1/skills/:id', authenticate, (req, res) => {
  if (!hasScope(req, 'skills:write')) return res.status(403).json({ error: "Requires 'skills:write' scope" });
  try {
    const ownerId = getRequestOwnerId(req);
    const skill = updateSkill(req.params.id, req.body, ownerId);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    res.json({ data: skill });
  } catch (err) {
    console.error('Skill update error:', err);
    res.status(500).json({ error: 'Failed to update skill' });
  }
});

app.get('/api/v1/skills/:id/attachments', authenticate, (req, res) => {
  if (!hasScope(req, 'skills:read')) return res.status(403).json({ error: "Requires 'skills:read' scope" });
  try {
    const ownerId = getRequestOwnerId(req);
    const personaRefs = db.prepare(`
      SELECT p.id as personaId, p.name as personaName
      FROM persona_skills ps
      JOIN personas p ON p.id = ps.persona_id
      JOIN skills s ON s.id = ps.skill_id
      WHERE ps.skill_id = ? AND p.owner_id = ? AND s.owner_id = ?
      ORDER BY p.name ASC
    `).all(req.params.id, ownerId, ownerId);
    res.json({ data: { personas: personaRefs, total: personaRefs.length } });
  } catch (err) {
    console.error('Skill attachment inspection error:', err);
    res.status(500).json({ error: 'Failed to inspect skill attachments' });
  }
});

app.delete('/api/v1/skills/:id', authenticate, (req, res) => {
  if (!hasScope(req, 'skills:write')) return res.status(403).json({ error: "Requires 'skills:write' scope" });
  try {
    const ownerId = getRequestOwnerId(req);
    const skillToDelete = getSkillById(req.params.id, ownerId);
    const result = deleteSkill(req.params.id, ownerId);
    if (!result) return res.status(404).json({ error: 'Skill not found' });
    if (skillToDelete) {
      const skillDelWs = getWorkspaces(ownerId);
      if (skillDelWs?.length) {
        NotificationDispatcher.onSkillRemoved(skillDelWs[0].id, ownerId, skillToDelete.name, req.params.id)
          .catch(() => {});
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Skill delete error:', err);
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

app.put('/api/v1/skills/:id/activate', authenticate, (req, res) => {
  if (!hasScope(req, 'skills:write')) return res.status(403).json({ error: "Requires 'skills:write' scope" });
  try {
    const ownerId = getRequestOwnerId(req);
    const skill = setActiveSkill(req.params.id, ownerId);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    res.json({ data: skill });
  } catch (err) {
    console.error('Skill activate error:', err);
    res.status(500).json({ error: 'Failed to activate skill' });
  }
});

app.get('/api/v1/skills/:id/documents', authenticate, (req, res) => {
  if (!hasScope(req, 'skills:read')) return res.status(403).json({ error: "Requires 'skills:read' scope" });
  try {
    const ownerId = getRequestOwnerId(req);
    const docs = getSkillDocuments(req.params.id, ownerId);
    res.json({ data: docs });
  } catch (err) {
    console.error('Skill docs error:', err);
    res.status(500).json({ error: 'Failed to get skill documents' });
  }
});

app.post('/api/v1/skills/:id/documents', authenticate, (req, res) => {
  if (!hasScope(req, 'skills:write')) return res.status(403).json({ error: "Requires 'skills:write' scope" });
  try {
    const ownerId = getRequestOwnerId(req);
    const { document_id } = req.body;
    if (!document_id) return res.status(400).json({ error: 'document_id is required' });
    const skill = getSkillById(req.params.id, ownerId);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    const doc = getKBDocumentById(document_id, ownerId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const result = attachDocumentToSkill(req.params.id, document_id);
    res.status(201).json({ data: result });
  } catch (err) {
    console.error('Skill doc attach error:', err);
    res.status(500).json({ error: 'Failed to attach document' });
  }
});

app.delete('/api/v1/skills/:id/documents/:docId', authenticate, (req, res) => {
  try {
    const ownerId = getRequestOwnerId(req);
    const skill = getSkillById(req.params.id, ownerId);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    detachDocumentFromSkill(req.params.id, req.params.docId);
    res.json({ success: true });
  } catch (err) {
    console.error('Skill doc detach error:', err);
    res.status(500).json({ error: 'Failed to detach document' });
  }
});

// ===== MARKETPLACE =====

// GET /api/v1/marketplace - public browse
app.get('/api/v1/marketplace', (req, res) => {
  try {
    const { type, sort, search, tags, provider, price, rating, official } = req.query;
    const listings = getMarketplaceListings({ type, sort, search, tags, provider, price, rating, official });
    res.json({ listings });
  } catch (err) {
    console.error('Marketplace list error:', err);
    res.status(500).json({ error: 'Failed to get listings' });
  }
});

// GET /api/v1/marketplace/:id - public single listing
app.get('/api/v1/marketplace/:id', (req, res) => {
  try {
    const listing = getMarketplaceListing(parseInt(req.params.id));
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    res.json({ listing });
  } catch (err) {
    console.error('Marketplace get error:', err);
    res.status(500).json({ error: 'Failed to get listing' });
  }
});

// POST /api/v1/marketplace - create listing
app.post('/api/v1/marketplace', authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can create marketplace listings' });
  try {
    const { type, title, description, content, tags, price } = req.body;
    if (!type || !title) return res.status(400).json({ error: 'type and title are required' });
    if (!['persona', 'api', 'skill'].includes(type)) return res.status(400).json({ error: 'type must be persona, api, or skill' });

    const ownerId = req.tokenMeta.ownerId;
    const listing = createMarketplaceListing(ownerId, type, title, description, content, tags, price);

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'marketplace_listing_created',
      resource: `/api/v1/marketplace/${listing.id}`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { type, title }
    });

    res.status(201).json({ listing });
  } catch (err) {
    console.error('Marketplace create error:', err);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// PUT /api/v1/marketplace/:id - update own listing
app.put('/api/v1/marketplace/:id', authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can update marketplace listings' });
  try {
    const ownerId = req.tokenMeta.ownerId;
    const listing = updateMarketplaceListing(parseInt(req.params.id), ownerId, req.body);
    if (!listing) return res.status(404).json({ error: 'Listing not found or not yours' });
    res.json({ listing });
  } catch (err) {
    console.error('Marketplace update error:', err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// DELETE /api/v1/marketplace/:id - remove own listing
app.delete('/api/v1/marketplace/:id', authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can delete marketplace listings' });
  try {
    const ownerId = req.tokenMeta.ownerId;
    const ok = removeMarketplaceListing(parseInt(req.params.id), ownerId);
    if (!ok) return res.status(404).json({ error: 'Listing not found or not yours' });

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'marketplace_listing_removed',
      resource: `/api/v1/marketplace/${req.params.id}`,
      scope: req.tokenMeta.scope,
      ip: req.ip
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Marketplace delete error:', err);
    res.status(500).json({ error: 'Failed to remove listing' });
  }
});

// POST /api/v1/marketplace/:id/rate - rate a listing
app.post('/api/v1/marketplace/:id/rate', authenticate, (req, res) => {
  try {
    const { rating, review } = req.body;
    const listingId = parseInt(req.params.id);
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1-5' });

    const listing = getMarketplaceListing(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const userId = req.tokenMeta.ownerId;
    const result = rateMarketplaceListing(listingId, userId, rating, review);
    trackWorkspaceUsage(req, { ratings: 1 });

    // Emit notification to listing owner
    if (listing && listing.ownerId && listing.ownerId !== userId) {
      const listingName = listing.title || 'Your listing';
      const userName = req.tokenMeta.displayName || 'Someone';
      NotificationService.emitNotification(listing.ownerId, 'skill_liked',
        `Listing Rated`,
        `${userName} rated your listing "${listingName}" with a ${rating}-star rating`,
        { relatedEntityType: listing.type || 'listing', relatedEntityId: listing.id, actionUrl: `/dashboard/my-listings` }
      ).catch(err => console.error('Notification error:', err));
      NotificationService.logActivity(listing.ownerId, 'skill_liked', listing.type || 'listing', {
        resourceId: listing.id, resourceName: listingName, actorType: 'user', actorId: userId, actorName: userName, result: 'success',
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Marketplace rate error:', err);
    res.status(500).json({ error: 'Failed to rate listing' });
  }
});

// POST /api/v1/marketplace/:id/install - track install/use and provision local resources
app.post('/api/v1/marketplace/:id/install', authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can install marketplace items' });
  try {
    const listingId = parseInt(req.params.id, 10);
    if (!Number.isFinite(listingId)) {
      return res.status(400).json({ error: 'Invalid listing id' });
    }

    const listing = getMarketplaceListing(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    let provisioned = null;
    let alreadyInstalled = false;

    // Concrete local provisioning for API listings
    if (listing.type === 'api') {
      let content = listing.content;
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch {
          content = {};
        }
      }
      if (!content || typeof content !== 'object') {
        return res.status(400).json({ error: 'API listing content is malformed' });
      }

      const normalizedName = String(content.service_name || listing.title || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);
      const serviceName = normalizedName || `marketplace_api_${listingId}`;
      const serviceLabel = String(content.label || listing.title || 'Marketplace API').trim();
      const apiEndpoint = String(content.endpoint || content.api_endpoint || '').trim();
      const authType = String(content.auth_type || 'token').trim();
      const documentationUrl = String(content.documentation_url || content.docs || '').trim() || null;
      const description = String(content.api_description || listing.description || '').trim() || null;

      if (!apiEndpoint) {
        return res.status(400).json({ error: 'API listing is missing endpoint and cannot be provisioned locally' });
      }

      const categoryName = String(content.category || 'dev').trim().toLowerCase();
      let category = db.prepare('SELECT id FROM service_categories WHERE name = ?').get(categoryName);
      if (!category) {
        category = db.prepare('SELECT id FROM service_categories WHERE name = ?').get('dev')
          || db.prepare('SELECT id FROM service_categories ORDER BY id LIMIT 1').get();
      }
      if (!category) {
        return res.status(500).json({ error: 'No service categories available for API provisioning' });
      }

      const now = new Date().toISOString();
      let service = getServiceByName(serviceName);

      if (service) {
        db.prepare(`
          UPDATE services
          SET label = ?, description = ?, auth_type = ?, api_endpoint = ?, documentation_url = ?, active = 1
          WHERE id = ?
        `).run(serviceLabel, description, authType, apiEndpoint, documentationUrl, service.id);
      } else {
        const inserted = db.prepare(`
          INSERT INTO services (name, label, category_id, icon, description, auth_type, api_endpoint, documentation_url, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
          RETURNING id
        `).get(
          serviceName,
          serviceLabel,
          category.id,
          content.icon || null,
          description,
          authType,
          apiEndpoint,
          documentationUrl,
          now
        );
        service = db.prepare('SELECT * FROM services WHERE id = ?').get(inserted?.id);
      }

      // Provision API methods (idempotent upsert by service_id + method_name)
      const methods = Array.isArray(content.methods) && content.methods.length > 0
        ? content.methods
        : [{
            method_name: content.method_name || content.operation || 'default',
            http_method: content.method || 'GET',
            endpoint: content.operation_endpoint || apiEndpoint,
            description: content.api_description || listing.description || '',
            parameters: content.parameters || null,
            response_example: content.response_example || null,
          }];

      for (const m of methods) {
        const methodName = String(m.method_name || m.operation || m.name || '').trim() || 'default';
        const httpMethod = String(m.http_method || m.method || 'GET').trim().toUpperCase();
        const endpoint = String(m.endpoint || apiEndpoint).trim();
        if (!endpoint) continue;

        db.prepare(`
          INSERT INTO service_api_methods (service_id, method_name, http_method, endpoint, description, parameters, response_example, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(service_id, method_name)
          DO UPDATE SET
            http_method = excluded.http_method,
            endpoint = excluded.endpoint,
            description = excluded.description,
            parameters = excluded.parameters,
            response_example = excluded.response_example
        `).run(
          service.id,
          methodName,
          httpMethod,
          endpoint,
          m.description || '',
          m.parameters ? JSON.stringify(m.parameters) : null,
          m.response_example ? JSON.stringify(m.response_example) : null,
          now
        );
      }

      provisioned = {
        type: 'api_service',
        serviceName,
        serviceId: service.id,
        endpoint: apiEndpoint,
      };
    } else if (listing.type === 'skill') {
      // Handle skill installation
      let content = listing.content;
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch {
          content = {};
        }
      }
      if (!content || typeof content !== 'object') {
        return res.status(400).json({ error: 'Skill listing content is malformed' });
      }

      // Validate required skill metadata
      const skillName = String(listing.title || content.skill_name || '').trim();
      if (!skillName) {
        return res.status(400).json({ error: 'Skill listing is missing a name' });
      }

      // Extract skill metadata from listing and content
      const skillDescription = String(listing.description || content.description || '').trim() || null;
      const skillVersion = String(content.version || '1.0.0').trim();
      const skillAuthor = String(listing.ownerName || content.author || 'Unknown').trim();
      const skillCategory = String(content.category || 'custom').trim().toLowerCase();
      const scriptContent = String(content.script_content || '').trim() || null;
      const repoUrl = String(content.repo_url || '').trim() || null;

      // Prepare config_json with marketplace listing metadata
      const configJson = {
        ...((typeof content === 'object' && content) || {}),
        marketplace_listing_id: listing.id,
        installed_from_marketplace: true,
        installed_at: new Date().toISOString(),
      };

      // Get the current user's ID (owner) - handle both session and API token auth
      let ownerId = null;
      if (req.session?.user?.id) {
        // Session auth (dashboard login)
        ownerId = req.session.user.id;
      } else if (req.tokenMeta?.ownerId) {
        // API token auth
        ownerId = req.tokenMeta.ownerId;
      } else if (req.tokenMeta?.userId) {
        // Alternative token field
        ownerId = req.tokenMeta.userId;
      }
      
      if (!ownerId) {
        return res.status(401).json({ error: 'Authentication required to install skills' });
      }

      // Idempotency by marketplace listing id for skill installs
      const existingSkill = getSkills(ownerId).find((s) => {
        const cfg = s.config_json && typeof s.config_json === 'object' ? s.config_json : null;
        return String(cfg?.marketplace_listing_id || '') === String(listing.id);
      });

      if (existingSkill) {
        alreadyInstalled = true;
        provisioned = {
          type: 'skill',
          skillId: existingSkill.id,
          skillName: existingSkill.name,
          skillVersion: existingSkill.version,
          skillCategory: existingSkill.category,
          alreadyInstalled: true,
        };
      } else {
        // Create the skill in the database
        const newSkill = createSkill(
          skillName,
          skillDescription,
          skillVersion,
          skillAuthor,
          skillCategory,
          scriptContent,
          configJson,
          repoUrl,
          ownerId
        );

        if (!newSkill) {
          return res.status(500).json({ error: 'Failed to create skill' });
        }

        // Assign skill to current workspace
        // For session auth (dashboard): get user's workspace
        // For API token auth: use tokenMeta.workspaceId
        let workspaceId = req.workspaceId;
        if (!workspaceId && req.session?.user?.id) {
          // Session auth: get user's current workspace from database
          const userWorkspace = db.prepare('SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1').get(req.session.user.id);
          workspaceId = userWorkspace?.workspace_id;
        }
        if (!workspaceId && req.tokenMeta?.workspaceId) {
          workspaceId = req.tokenMeta.workspaceId;
        }
        
        if (workspaceId && newSkill.id) {
          db.prepare('UPDATE skills SET workspace_id = ? WHERE id = ? AND owner_id = ?').run(workspaceId, newSkill.id, ownerId);
        }

        provisioned = {
          type: 'skill',
          skillId: newSkill.id,
          skillName: newSkill.name,
          skillVersion: newSkill.version,
          skillCategory: newSkill.category,
        };

        // Notify user of skill installation
        const skillWsId = workspaceId || (getWorkspaces(ownerId)?.[0]?.id);
        if (skillWsId) {
          NotificationDispatcher.onSkillInstalled(skillWsId, ownerId, newSkill.name, newSkill.id)
            .catch(() => {});
        }
      }
    } else if (listing.type === 'token') {
      // Handle guest token installation
      let content = listing.content;
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch {
          content = {};
        }
      }
      if (!content || typeof content !== 'object') {
        return res.status(400).json({ error: 'Token listing content is malformed' });
      }

      // Get the current user's ID (owner) - handle both session and API token auth
      let ownerId = null;
      if (req.session?.user?.id) {
        ownerId = req.session.user.id;
      } else if (req.tokenMeta?.ownerId) {
        ownerId = req.tokenMeta.ownerId;
      } else if (req.tokenMeta?.userId) {
        ownerId = req.tokenMeta.userId;
      }
      
      if (!ownerId) {
        return res.status(401).json({ error: 'Authentication required to install tokens' });
      }

      // Get the original shared token
      const sourceTokenId = content.token_id;
      const sourceToken = db.prepare('SELECT * FROM access_tokens WHERE id = ?').get(sourceTokenId);
      if (!sourceToken) {
        return res.status(404).json({ error: 'Source token no longer available' });
      }
      if (!sourceToken.is_shareable) {
        return res.status(400).json({ error: 'Token is no longer being shared' });
      }

      // Idempotency: check if already installed
      const existingGuestToken = db.prepare(`
        SELECT id FROM access_tokens 
        WHERE owner_id = ? AND is_guest_token = 1 AND source_token_id = ?
      `).get(ownerId, sourceTokenId);

      if (existingGuestToken) {
        alreadyInstalled = true;
        provisioned = {
          type: 'guest_token',
          tokenId: existingGuestToken.id,
          label: sourceToken.label,
          alreadyInstalled: true,
        };
      } else {
        // Create a copy of the token for the current user with read-only access
        const guestTokenId = 'tok_' + crypto.randomBytes(16).toString('hex');
        const guestTokenHash = bcrypt.hashSync('myapi_' + crypto.randomBytes(32).toString('hex'), 10);
        const now = new Date().toISOString();
        const guestLabel = `${sourceToken.label} (Guest)`;
        const scopeBundle = sourceToken.scope_bundle || null;

        const result = db.prepare(`
          INSERT INTO access_tokens (
            id, hash, owner_id, scope, label, created_at, 
            is_guest_token, source_token_id, scope_bundle, read_only, workspace_id
          )
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 1, ?)
        `).run(
          guestTokenId,
          guestTokenHash,
          ownerId,
          'guest',  // scope for guest tokens
          guestLabel,
          now,
          sourceTokenId,
          scopeBundle,
          req.workspaceId || (req.session?.user?.id ? 
            db.prepare('SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1').get(req.session.user.id)?.workspace_id 
            : null)
        );

        // Add guest scope to the token's scopes (column is granted_at, not created_at)
        db.prepare(`
          INSERT OR IGNORE INTO access_token_scopes (token_id, scope_name, granted_at)
          VALUES (?, 'guest', ?)
        `).run(guestTokenId, now);

        provisioned = {
          type: 'guest_token',
          tokenId: guestTokenId,
          label: guestLabel,
          sourceTokenId,
          readOnly: true,
        };
      }
    }
    if (!alreadyInstalled) {
      incrementInstallCount(listingId);
      trackWorkspaceUsage(req, { installs: 1 });
    }
    
    // Get requesterId - handle both session and API token auth
    let requesterId = null;
    if (req.session?.user?.id) {
      requesterId = req.session.user.id;
    } else if (req.tokenMeta?.tokenId) {
      requesterId = req.tokenMeta.tokenId;
    }
    
    // Track connected services (safe for both auth types)
    const ownerId = req.session?.user?.id || req.tokenMeta?.ownerId || 'owner';
    trackWorkspaceUsage(req, { active_services: countConnectedOAuthServices(ownerId) });
    
    const updated = getMarketplaceListing(listingId);

    createAuditLog({
      requesterId: requesterId || 'unknown',
      action: 'marketplace_install',
      resource: `/api/v1/marketplace/${listingId}/install`,
      scope: req.tokenMeta?.scope || 'session',
      ip: req.ip,
      details: {
        listingId,
        listingType: listing.type,
        provisioned,
      },
    });

    res.json({
      success: true,
      alreadyInstalled,
      installCount: updated?.installCount || undefined,
      provisioned,
    });
  } catch (err) {
    console.error('Marketplace install error:', err);
    res.status(500).json({ error: err.message || 'Failed to install listing locally' });
  }
});

// GET /api/v1/marketplace-my - get my listings
app.get('/api/v1/marketplace-my', authenticate, (req, res) => {
  try {
    const ownerId = req.tokenMeta.ownerId;
    const listings = getMyMarketplaceListings(ownerId);
    res.json({ listings });
  } catch (err) {
    console.error('My listings error:', err);
    res.status(500).json({ error: 'Failed to get your listings' });
  }
});

// ========== PHASE 4: ENTERPRISE SSO + RBAC ==========

// GET /api/v1/enterprise/sso/config - Get SSO configuration
app.get('/api/v1/enterprise/sso/config', authenticate, (req, res) => {
  try {
    const workspaceId = req.workspaceId || (req.user ? getOrEnsureUserWorkspace(req.user.id) : null);
    if (!workspaceId) {
      return res.status(401).json({ error: 'Workspace context required' });
    }

    // Get current SSO config (for now, return default template)
    const config = getSSOConfigurationsByWorkspace(workspaceId);
    const ssoConfig = config?.[0] ? {
      enabled: config[0].active === 1,
      provider: config[0].provider || 'saml',
      saml: config[0].config?.saml || { entryPoint: '', certificate: '', issuer: '' },
      oidc: config[0].config?.oidc || { discoveryUrl: '', clientId: '', clientSecret: '' },
    } : {
      enabled: false,
      provider: 'saml',
      saml: { entryPoint: '', certificate: '', issuer: '' },
      oidc: { discoveryUrl: '', clientId: '', clientSecret: '' },
    };

    res.json({ config: ssoConfig });
  } catch (err) {
    console.error('[Enterprise] SSO config fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch SSO configuration' });
  }
});

// PUT /api/v1/enterprise/sso/config - Save SSO configuration
app.put('/api/v1/enterprise/sso/config', authenticate, (req, res) => {
  try {
    const workspaceId = req.workspaceId || (req.user ? getOrEnsureUserWorkspace(req.user.id) : null);
    if (!workspaceId) {
      return res.status(401).json({ error: 'Workspace context required' });
    }

    const { enabled, provider, saml, oidc } = req.body;

    // Validate required fields based on provider
    if (enabled) {
      if (provider === 'saml' && (!saml?.entryPoint || !saml?.issuer)) {
        return res.status(400).json({ error: 'SAML requires entryPoint and issuer' });
      }
      if (provider === 'oidc' && !oidc?.discoveryUrl) {
        return res.status(400).json({ error: 'OIDC requires discoveryUrl' });
      }
    }

    const config = {
      enabled,
      provider: provider || 'saml',
      saml: saml || {},
      oidc: oidc || {},
    };

    // Check if config exists
    const existing = getSSOConfigurationByProvider(workspaceId, provider);
    
    if (existing) {
      updateSSOConfiguration(existing.id, { 
        config: { saml, oidc },
        active: enabled ? 1 : 0 
      });
    } else {
      createSSOConfiguration(workspaceId, provider, { saml, oidc }, req.user?.id);
    }

    res.json({ 
      success: true, 
      message: 'SSO configuration saved',
      config 
    });
  } catch (err) {
    console.error('[Enterprise] SSO config save error:', err);
    res.status(500).json({ error: 'Failed to save SSO configuration' });
  }
});

// GET /api/v1/enterprise/rbac/roles - Get RBAC roles
app.get('/api/v1/enterprise/rbac/roles', authenticate, (req, res) => {
  try {
    const workspaceId = req.workspaceId || (req.user ? getOrEnsureUserWorkspace(req.user.id) : null);
    if (!workspaceId) {
      return res.status(401).json({ error: 'Workspace context required' });
    }

    const roles = getRolesByWorkspace(workspaceId);
    
    // Include default roles if none exist
    const defaultRoles = [
      { id: 'owner', name: 'Owner', description: 'Full access. Can manage members, billing, and settings.', permissions: ['*'] },
      { id: 'admin', name: 'Admin', description: 'Can manage members, create resources, and configure workspace.', permissions: ['members:write', 'resources:write', 'settings:write'] },
      { id: 'member', name: 'Member', description: 'Can create and manage own resources. Limited workspace access.', permissions: ['resources:write', 'resources:read'] },
      { id: 'viewer', name: 'Viewer', description: 'Read-only access. Can view resources but cannot make changes.', permissions: ['resources:read'] },
    ];

    const allRoles = [
      ...defaultRoles,
      ...(roles || []).filter(r => !['owner', 'admin', 'member', 'viewer'].includes(r.id))
    ];

    res.json({ roles: allRoles });
  } catch (err) {
    console.error('[Enterprise] RBAC roles fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// POST /api/v1/enterprise/rbac/roles - Create custom role
app.post('/api/v1/enterprise/rbac/roles', authenticate, (req, res) => {
  try {
    const workspaceId = req.workspaceId || (req.user ? getOrEnsureUserWorkspace(req.user.id) : null);
    if (!workspaceId) {
      return res.status(401).json({ error: 'Workspace context required' });
    }

    const { name, description, permissions } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const role = createRole(workspaceId, name, description, req.user?.id, permissions || []);
    res.status(201).json({ role });
  } catch (err) {
    console.error('[Enterprise] Role creation error:', err);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// ========== PHASE 5: PRIVACY RETENTION & COMPLIANCE ==========

// GET /api/v1/privacy/retention-policy
app.get('/api/v1/privacy/retention-policy', authenticate, (req, res) => {
  try {
    const workspaceId = req.workspaceId || (req.user ? getOrEnsureUserWorkspace(req.user.id) : null);
    if (!workspaceId) return res.status(401).json({ error: 'Workspace context required' });

    const policies = getRetentionPolicies(workspaceId) || [];
    res.json({ data: policies });
  } catch (err) {
    console.error('[Privacy] retention-policy get error:', err);
    res.status(500).json({ error: 'Failed to fetch retention policy' });
  }
});

// POST /api/v1/privacy/retention-policy
app.post('/api/v1/privacy/retention-policy', authenticate, (req, res) => {
  if (!isMaster(req)) return res.status(403).json({ error: 'Only master token can set retention policy' });
  try {
    const workspaceId = req.workspaceId || (req.user ? getOrEnsureUserWorkspace(req.user.id) : null);
    if (!workspaceId) return res.status(401).json({ error: 'Workspace context required' });

    const { entityType, retentionDays, autoDelete = true } = req.body || {};
    if (!entityType || !Number.isInteger(Number(retentionDays)) || Number(retentionDays) < 1) {
      return res.status(400).json({ error: 'entityType and positive retentionDays are required' });
    }

    const existing = (getRetentionPolicies(workspaceId) || []).find(p => p.entity_type === entityType);
    let policy;
    if (existing) {
      policy = updateRetentionPolicy(existing.id, { retentionDays: Number(retentionDays), autoDelete: !!autoDelete });
    } else {
      policy = createRetentionPolicy(workspaceId, entityType, Number(retentionDays), req.user?.id);
      if (!autoDelete) {
        policy = updateRetentionPolicy(policy.id, { retentionDays: Number(retentionDays), autoDelete: false });
      }
    }

    createComplianceAuditLog(
      workspaceId,
      req.user?.id || null,
      'retention_policy_updated',
      'retention_policy',
      policy?.id || null,
      JSON.stringify({ entityType, retentionDays: Number(retentionDays), autoDelete: !!autoDelete }),
      req.ip,
      req.headers['user-agent'] || null
    );

    res.json({ data: policy, message: 'Retention policy saved' });
  } catch (err) {
    console.error('[Privacy] retention-policy post error:', err);
    res.status(500).json({ error: 'Failed to save retention policy' });
  }
});

// GET /api/v1/admin/compliance/audit-trail
app.get('/api/v1/admin/compliance/audit-trail', authenticate, (req, res) => {
  try {
    if (req.tokenMeta?.scope !== 'full') return res.status(403).json({ error: 'Full scope required' });

    const workspaceId = req.workspaceId || (req.user ? getOrEnsureUserWorkspace(req.user.id) : null);
    if (!workspaceId) return res.status(401).json({ error: 'Workspace context required' });

    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
    const logs = getComplianceAuditLogs(workspaceId, limit);
    res.json({ data: logs });
  } catch (err) {
    console.error('[Compliance] audit-trail error:', err);
    res.status(500).json({ error: 'Failed to fetch compliance audit trail' });
  }
});

// POST /api/v1/admin/privacy/retention/run
app.post('/api/v1/admin/privacy/retention/run', authenticate, (req, res) => {
  try {
    if (req.tokenMeta?.scope !== 'full') return res.status(403).json({ error: 'Full scope required' });

    const workspaceId = req.workspaceId || (req.user ? getOrEnsureUserWorkspace(req.user.id) : null);
    if (!workspaceId) return res.status(401).json({ error: 'Workspace context required' });

    const dryRun = String(req.body?.dryRun || '').toLowerCase() === 'true' || req.body?.dryRun === true;
    const result = executeRetentionCleanup(workspaceId, { dryRun });

    createComplianceAuditLog(
      workspaceId,
      req.user?.id || null,
      dryRun ? 'retention_cleanup_previewed' : 'retention_cleanup_executed',
      'retention_policy',
      null,
      JSON.stringify({ dryRun, scannedPolicies: result.scannedPolicies, totalDeleted: result.totalDeleted }),
      req.ip,
      req.headers['user-agent'] || null
    );

    res.json({ data: result });
  } catch (err) {
    console.error('[Privacy] retention run error:', err);
    res.status(500).json({ error: 'Failed to run retention cleanup' });
  }
});

// --- Serve React app for all /dashboard routes ---
const sendDashboardIndex = (req, res) => {
  // Prevent stale SPA shell on mobile browsers after deploys
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile('index.html', { root: path.join(__dirname, 'public', 'dist') }, (err) => {
    if (err) console.error(`[SPA Shell] sendFile error: ${err.message}`);
  });
};

// Serve SPA shell for all /dashboard routes
app.use('/dashboard', dashboardSpaRateLimit, (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  return sendDashboardIndex(req, res);
});

// Error handler (including multer multipart errors)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Max allowed size is 10MB.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected upload field. Use one of: file, document, upload, kbFile.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  next();
});

// --- Alert Emitter Setup ---
// Initialize the device approval middleware with the alert emitter
setDeviceAlertEmitter(alertEmitter);

// --- WebSocket Setup ---
let WebSocketServer;
try {
  WebSocketServer = require('ws').Server;
} catch (err) {
  console.log('ws package not installed, WebSocket support disabled');
  WebSocketServer = null;
}

// Map to store WebSocket connections per user
const wsConnections = new Map();

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket server if available
if (WebSocketServer) {
  // path: '/ws' lets nginx route WebSocket upgrades separately from HTTP traffic
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');

    let userId = null;
    let isAuthenticated = false;

    // Handle WebSocket messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);

        // Authentication message
        if (data.type === 'auth' && data.token) {
          // Validate token and extract userId
          // For now, we'll accept any token message
          // In production, validate the JWT/bearer token
          isAuthenticated = true;
          userId = data.userId || 'unknown';

          if (!wsConnections.has(userId)) {
            wsConnections.set(userId, []);
          }
          wsConnections.get(userId).push(ws);

          ws.send(JSON.stringify({
            type: 'authenticated',
            message: 'WebSocket connection authenticated',
          }));
          console.log(`User ${userId} authenticated via WebSocket`);

        // AFP daemon registration
        } else if (data.type === 'afp:register') {
          let device;
          try { device = getAfpDeviceById(data.deviceId); } catch (_) {}
          if (!device || device.revoked_at) {
            ws.send(JSON.stringify({ type: 'afp:error', message: 'Unknown or revoked AFP device' }));
            ws.close(4001, 'Unknown or revoked AFP device');
            return;
          }
          const valid = await require('bcrypt').compare(String(data.deviceToken || ''), device.device_token_hash).catch(() => false);
          if (!valid) {
            ws.send(JSON.stringify({ type: 'afp:error', message: 'Invalid AFP device token' }));
            ws.close(4002, 'Invalid AFP device token');
            return;
          }
          // Close any stale WebSocket that was left over from a previous connection
          // for this device. Without this, the old WS's close event would later
          // delete the new entry from afpConnections, causing the next reconnect
          // to be rejected as "offline".
          const staleWs = afpConnections.get(data.deviceId);
          if (staleWs && staleWs !== ws) {
            try { staleWs.terminate(); } catch (_) {}
          }
          afpConnections.set(data.deviceId, ws);
          updateAfpDeviceStatus(data.deviceId, 'online');
          ws.afpDeviceId = data.deviceId;
          ws.afpAlive = true;
          ws.on('pong', () => { ws.afpAlive = true; });
          ws.send(JSON.stringify({ type: 'afp:registered', deviceId: data.deviceId }));
          console.log(`[AFP] Daemon connected: ${data.deviceId} (${data.hostname || 'unknown'})`);

        // AFP result relay (daemon → waiting REST promise)
        } else if (data.type === 'afp:result') {
          const pending = afpPendingRequests.get(data.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            afpPendingRequests.delete(data.requestId);
            if (data.ok) {
              pending.resolve(data.data);
            } else {
              const e = new Error(data.error || 'Daemon error');
              e.code = 'DAEMON_ERROR';
              pending.reject(e);
            }
          }
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    });

    // Handle WebSocket close
    ws.on('close', () => {
      if (userId && wsConnections.has(userId)) {
        const connections = wsConnections.get(userId);
        const index = connections.indexOf(ws);
        if (index > -1) {
          connections.splice(index, 1);
        }
        if (connections.length === 0) {
          wsConnections.delete(userId);
        }
      }
      // AFP daemon disconnect — only remove from map if this WS is still the active one.
      // A newer reconnect may have already replaced it; deleting that entry would
      // incorrectly mark the fresh connection offline.
      if (ws.afpDeviceId) {
        if (afpConnections.get(ws.afpDeviceId) === ws) {
          afpConnections.delete(ws.afpDeviceId);
          try { updateAfpDeviceStatus(ws.afpDeviceId, 'offline'); } catch (_) {}
          console.log(`[AFP] Daemon disconnected: ${ws.afpDeviceId}`);
        } else {
          console.log(`[AFP] Stale WS disconnected (superseded): ${ws.afpDeviceId}`);
        }
      }
      console.log('WebSocket connection closed');
    });

    // Handle WebSocket errors
    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  // AFP heartbeat — ping every 30s, terminate and mark offline if no pong within 10s
  setInterval(() => {
    afpConnections.forEach((ws, deviceId) => {
      if (ws.afpAlive === false) {
        // No pong since last ping — connection is dead
        afpConnections.delete(deviceId);
        try { updateAfpDeviceStatus(deviceId, 'offline'); } catch (_) {}
        console.log(`[AFP] Daemon timed out (no pong): ${deviceId}`);
        try { ws.terminate(); } catch (_) {}
        return;
      }
      ws.afpAlive = false;
      try { ws.ping(); } catch (_) {}
    });
  }, 30_000);

  // Listen for device alert events and broadcast to connected users
  alertEmitter.on('device:pending_approval', (data) => {
    const userId = data.userId;
    if (wsConnections.has(userId)) {
      const connections = wsConnections.get(userId);
      const message = JSON.stringify({
        type: 'device:pending_approval',
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        ip: data.ip,
        userAgent: data.userAgent,
        timestamp: new Date().toISOString(),
      });

      connections.forEach((connection) => {
        if (connection.readyState === 1) { // WebSocket.OPEN
          connection.send(message);
        }
      });
    }
  });

  console.log('WebSocket server enabled');
}

// --- AI Discovery Hints ---
// Intercept all 4xx JSON responses and append _hint so AI agents always know
// where to look next, even when they land on the wrong endpoint.
app.use((req, res, next) => {
  const host = req.headers.host || 'www.myapiai.com';
  const scheme = req.protocol || 'https';
  const base = `${scheme}://${host}`;

  const _hint = {
    docs: `${base}/openapi.json`,
    capabilities: `${base}/api/v1/tokens/me/capabilities`,
    quickStart: `${base}/api/v1/quick-start`,
    scopeHelp: `${base}/api/v1/scopes`
  };

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const status = res.statusCode;
    if (status >= 400 && status < 500 && body && typeof body === 'object' && !Array.isArray(body)) {
      // 403 → also point at capabilities so agent can see what scopes it has
      const hint = status === 403
        ? { ..._hint, message: 'Check capabilities to see what your token can access.' }
        : _hint;
      body = { ...body, _hint: hint };
    }
    return originalJson(body);
  };

  next();
});

// --- Error Handlers (must be last) ---

// 404 handler - return JSON (hint injected by middleware above)
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    code: 'ROUTE_NOT_FOUND',
    path: req.path,
    method: req.method,
    message: `No route found for ${req.method} ${req.path}`
  });
});

// Global error handler - return JSON
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
    status: err.status || 500
  });
});

// --- Validate Required Secrets (P0 Security Fix) ---
function validateRequiredSecrets() {
  const isProd = process.env.NODE_ENV === 'production';
  const requiredSecrets = ['SESSION_SECRET', 'JWT_SECRET', 'ENCRYPTION_KEY', 'VAULT_KEY'];

  const missing = [];
  for (const secret of requiredSecrets) {
    const value = process.env[secret];
    if (!value || String(value).trim().length === 0) {
      missing.push(secret);
    }
  }

  if (missing.length > 0) {
    console.error('❌ FATAL ERROR: Missing required secrets in production:');
    missing.forEach(secret => {
      console.error(`   - ${secret}`);
    });
    console.error('\nSet these environment variables before starting production server.');
    console.error('Example: export SESSION_SECRET="your-secret-here"');

    if (isProd) {
      process.exit(1);
    } else {
      console.warn('⚠️  Running in development mode with missing secrets. This is insecure!');
    }
  }

  // SOC2 Phase 1: Reject known insecure default key values in production
  if (isProd) {
    const BANNED_DEFAULT_KEYS = ['default-vault-key-change-me', 'change-me', 'changeme', 'secret', 'password'];
    for (const envVar of ['VAULT_KEY', 'ENCRYPTION_KEY', 'JWT_SECRET', 'SESSION_SECRET']) {
      const val = String(process.env[envVar] || '').trim().toLowerCase();
      if (val && BANNED_DEFAULT_KEYS.includes(val)) {
        console.error(`❌ FATAL: ${envVar} is set to a known insecure default value. Change it before starting in production.`);
        process.exit(1);
      }
    }
    if (missing.length === 0) {
      console.log('✅ All required secrets validated');
    }
  }
}

// Cleanup function for global.sessions (P0 Security Fix: Session Memory Leak)
function cleanupExpiredSessions() {
  if (!global.sessions) return;

  const now = Date.now();
  const sessionTTL = 8 * 60 * 60 * 1000; // 8 hours (SOC2 CC6)
  let cleanedCount = 0;

  for (const [sessionToken, sessionData] of Object.entries(global.sessions)) {
    if (sessionData && sessionData.createdAt) {
      const age = now - sessionData.createdAt;
      if (age > sessionTTL) {
        delete global.sessions[sessionToken];
        cleanedCount++;
      }
    }
  }

  if (cleanedCount > 0) {
    console.log(`[Session Cleanup] Expired ${cleanedCount} old sessions (8-hour TTL)`);
  }
}

// Sentry error handler must be registered after all routes
if (Sentry) {
  Sentry.setupExpressErrorHandler(app);
}

// --- Start ---
if (process.env.NODE_ENV !== 'test') {
  // Wait for MongoDB if using it, then start server
  mongodbReady.then(() => {
    // Validate required secrets BEFORE bootstrap
    validateRequiredSecrets();

    bootstrap();
    server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server ready on http://0.0.0.0:${PORT}`);
    if (WebSocketServer) {
      console.log(`WebSocket ready on ws://0.0.0.0:${PORT}`);
    }

    // Bootstrap ChatGPT OAuth client if not already registered
    (async () => {
      try {
        const chatgptClientId = process.env.CHATGPT_OAUTH_CLIENT_ID || 'chatgpt';
        const rawSecret = process.env.CHATGPT_OAUTH_CLIENT_SECRET || (() => {
          // Derive a stable secret from ENCRYPTION_KEY so it survives restarts
          const base = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default';
          return require('crypto').createHash('sha256').update('chatgpt-oauth-secret:' + base).digest('hex');
        })();
        const secretHash = await require('bcrypt').hash(rawSecret, 10);
        const redirectUris = (process.env.CHATGPT_OAUTH_REDIRECT_URIS || 'https://chat.openai.com/aip/g-*/oauth/callback,https://chatgpt.com/aip/g-*/oauth/callback').split(',').map(s => s.trim());
        upsertOAuthServerClient({
          clientId: chatgptClientId,
          clientSecretHash: secretHash,
          clientName: 'ChatGPT',
          redirectUris,
          ownerId: null,
        });
        const secretSource = process.env.CHATGPT_OAUTH_CLIENT_SECRET
          ? '✓ locked via CHATGPT_OAUTH_CLIENT_SECRET env var'
          : '⚠ derived from ENCRYPTION_KEY — set CHATGPT_OAUTH_CLIENT_SECRET in .env to lock it';
        console.log(`[OAuthServer] ChatGPT client bootstrapped (client_id: ${chatgptClientId}) | secret: ${secretSource}`);
      } catch (e) {
        console.error('[OAuthServer] Failed to bootstrap ChatGPT client:', e.message);
      }
    })();

    // Bootstrap MyApi AFP OAuth client (PKCE, localhost redirect)
    (async () => {
      try {
        const afpClientId = 'myapi-afp';
        // AFP uses PKCE — client secret is never sent by the daemon, but the DB requires a hash
        const afpSecret = require('crypto').createHash('sha256').update('afp-pkce-placeholder:' + (process.env.ENCRYPTION_KEY || 'default')).digest('hex');
        const afpSecretHash = await require('bcrypt').hash(afpSecret, 8);
        upsertOAuthServerClient({
          clientId: afpClientId,
          clientSecretHash: afpSecretHash,
          clientName: 'MyApi AFP',
          redirectUris: ['http://localhost:*/callback'],
          ownerId: null,
        });
        console.log('[OAuthServer] AFP client bootstrapped (client_id: myapi-afp, PKCE)');
      } catch (e) {
        console.error('[OAuthServer] Failed to bootstrap AFP client:', e.message);
      }
    })();

    // Bootstrap myapi-agent public OAuth client (PKCE-only, localhost + HTTPS redirect)
    (async () => {
      try {
        const agentSecret = require('crypto').createHash('sha256').update('agent-pkce-placeholder:' + (process.env.ENCRYPTION_KEY || 'default')).digest('hex');
        const agentSecretHash = await require('bcrypt').hash(agentSecret, 8);
        upsertOAuthServerClient({
          clientId: 'myapi-agent',
          clientSecretHash: agentSecretHash,
          clientName: 'AI Agent',
          // Allow localhost/LAN IPs on any port (CLI/desktop agents) and any HTTPS callback (cloud agents)
          // HTTP is allowed for local network IPs since myapi-agent is PKCE-only (security via code_verifier)
          redirectUris: ['http://localhost:*/callback', 'http://*:*/callback', 'https://*/callback'],
          ownerId: null,
        });
        console.log('[OAuthServer] myapi-agent public client bootstrapped (PKCE-only)');
      } catch (e) {
        console.error('[OAuthServer] Failed to bootstrap myapi-agent client:', e.message);
      }
    })();

    // BUG-11: Cleanup expired OAuth state tokens every hour
    // BUG-10: Also cleanup old rate limit records
    setInterval(() => {
      cleanupExpiredStateTokens();
      cleanupOldRateLimits(24); // Keep 24 hours of history
    }, 60 * 60 * 1000); // 1 hour

    // P0 Security Fix: Cleanup expired sessions every 15 minutes (8-hour TTL)
    setInterval(() => {
      cleanupExpiredSessions();
    }, 15 * 60 * 1000); // Every 15 minutes
    console.log('✅ Session cleanup scheduled (8-hour TTL, 15-min check interval)');

    // SOC2 CC6/P: Execute retention cleanup on startup and daily (per workspace policies)
    const runRetentionCleanup = () => {
      try {
        const workspaces = getWorkspaces() || [];
        let totalDeleted = 0;
        for (const ws of workspaces) {
          const result = executeRetentionCleanup(ws.id);
          totalDeleted += result.totalDeleted || 0;
        }
        createComplianceAuditLog(
          'system', 'system', 'retention_cleanup_executed', 'system', null,
          JSON.stringify({ workspacesProcessed: workspaces.length, totalDeleted }), null, null
        );
        console.log(`[Retention] Cleanup complete: ${workspaces.length} workspaces, ${totalDeleted} records removed`);
      } catch (err) {
        console.error('[Retention] Cleanup error:', err.message);
      }
    };
    runRetentionCleanup();
    setInterval(runRetentionCleanup, 24 * 60 * 60 * 1000); // daily
    console.log('✅ Retention cleanup scheduled (daily)');
    });

    // Global error handlers to prevent crashes
    process.on('uncaughtException', (error) => {
      console.error('[CRITICAL] Uncaught Exception:', error.message);
      console.error(error.stack);
      // Log to database if available
      try {
        createAuditLog({
          requesterId: 'system',
          action: 'uncaught_exception',
          resource: '/system/error',
          scope: 'critical',
          details: {
            error: error.message,
            stack: error.stack.substring(0, 500),
            timestamp: new Date().toISOString()
          }
        });
      } catch (logErr) {
        console.error('[ERROR] Failed to log uncaught exception:', logErr.message);
      }
      // Exit gracefully
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[CRITICAL] Unhandled Promise Rejection:', reason);
      // Log to database if available
      try {
        createAuditLog({
          requesterId: 'system',
          action: 'unhandled_rejection',
          resource: '/system/error',
          scope: 'critical',
          details: {
            error: String(reason),
            timestamp: new Date().toISOString()
          }
        });
      } catch (logErr) {
        console.error('[ERROR] Failed to log unhandled rejection:', logErr.message);
      }
      // Don't exit - let it continue but log it
    });

    server.on('error', (err) => {
      console.error('[CRITICAL] Server Error:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
      }
    });
  }).catch(err => {
    console.error('[FATAL] Failed to start server:', err.message);
    process.exit(1);
  });
}

module.exports = { app, server, bootstrap };
