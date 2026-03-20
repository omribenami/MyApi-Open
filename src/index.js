require('dotenv').config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const bcrypt = require("bcrypt");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const multer = require('multer');
const pdfParse = require('pdf-parse');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { marked } = require('marked');
const http = require('http');
const EventEmitter = require('events');

// Global event emitter for device alerts and real-time notifications
const alertEmitter = new EventEmitter();
const NotificationService = require('./services/notificationService');

const {
  db,
  initDatabase,
  createVaultToken,
  getVaultTokens,
  deleteVaultToken,
  decryptVaultToken,
  createAccessToken,
  getAccessTokens,
  revokeAccessToken,
  // Scope functions
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
  getAuditLogs,
  createUser,
  getUsers,
  getUserByUsername,
  getUserById,
  updateUserPlan,
  updateUserOAuthProfile,
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
  createConversation,
  getConversations,
  getConversation,
  storeMessage,
  getConversationHistory,
  addKBDocument,
  getKBDocuments,
  getKBDocumentById,
  deleteKBDocument,
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
  // Phase 2: Billing & Usage
  getBillingCustomerByWorkspace,
  upsertBillingCustomer,
  getBillingSubscriptionByWorkspace,
  upsertBillingSubscription,
  listInvoicesByWorkspace,
  upsertInvoice,
  incrementUsageDaily,
  getUsageDaily,
} = require("./database");

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
app.set('trust proxy', true);
const PORT = process.env.PORT || 4500;
const WORKSPACE_ROOT = path.join(__dirname, '..', '..', '..');
const USER_MD_PATH = path.join(WORKSPACE_ROOT, 'USER.md');
const SOUL_MD_PATH = path.join(WORKSPACE_ROOT, 'SOUL.md');
const LEGAL_DOCS_DIR = path.join(__dirname, '..', 'docs', 'legal');

// Import device approval middleware
const { deviceApprovalMiddleware, setAlertEmitter: setDeviceAlertEmitter } = require('./middleware/deviceApproval');

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
  const renderer = new marked.Renderer();
  renderer.link = ({ href, title, tokens }) => {
    const text = (tokens || []).map((token) => token.raw || token.text || '').join('') || href || '';
    const safeHref = sanitizeUrl(href || '');
    const safeTitle = title ? ` title="${escapeHtml(title)}"` : '';
    return `<a href="${escapeHtml(safeHref)}"${safeTitle} target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
  };

  return marked.parse(safeMarkdown, {
    gfm: true,
    breaks: true,
    renderer,
    headerIds: false,
    mangle: false,
  });
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

// --- OAuth Configuration ---
// Load OAuth config with environment variable support
const oauthConfigPath = path.join(__dirname, '..', 'config', 'oauth.json');
let oauthConfig = {};
if (fs.existsSync(oauthConfigPath)) {
  const raw = fs.readFileSync(oauthConfigPath, 'utf8');
  // Replace environment variable placeholders
  const resolved = raw.replace(/\$\{([^}]+)\}/g, (match, envVar) => process.env[envVar] || match);
  try {
    oauthConfig = JSON.parse(resolved);
  } catch (e) {
    console.warn('Warning: Could not parse OAuth config, using empty config');
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
    scope: 'email,public_profile,user_posts',
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || oauthConfig.facebook?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/facebook`,
    clientId: process.env.FACEBOOK_CLIENT_ID || oauthConfig.facebook?.clientId,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET || oauthConfig.facebook?.clientSecret,
  }),
  instagram: new GenericOAuthAdapter({
    serviceName: 'instagram',
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    verifyUrl: 'https://graph.instagram.com/me?fields=id,username',
    scope: 'user_profile,user_media',
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI || oauthConfig.instagram?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/instagram`,
    clientId: process.env.INSTAGRAM_CLIENT_ID || oauthConfig.instagram?.clientId,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || oauthConfig.instagram?.clientSecret,
    extraAuthParams: { force_reauth: true },
  }),
  tiktok: new GenericOAuthAdapter({
    serviceName: 'tiktok',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scope: 'user.info.basic,video.list',
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
    scope: process.env.TWITTER_SCOPE || 'tweet.read users.read',
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
    scope: 'identity read submit',
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
    scope: 'r_liteprofile r_emailaddress',
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || oauthConfig.linkedin?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/linkedin`,
    clientId: process.env.LINKEDIN_CLIENT_ID || oauthConfig.linkedin?.clientId,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || oauthConfig.linkedin?.clientSecret,
  }),
  notion: new GenericOAuthAdapter({
    serviceName: 'notion',
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scope: '',
    redirectUri: process.env.NOTION_REDIRECT_URI || oauthConfig.notion?.redirectUri || `http://localhost:${PORT}/api/v1/oauth/callback/notion`,
    clientId: process.env.NOTION_CLIENT_ID || oauthConfig.notion?.clientId,
    clientSecret: process.env.NOTION_CLIENT_SECRET || oauthConfig.notion?.clientSecret,
    tokenAuthStyle: 'basic',
    extraAuthParams: { owner: 'user' },
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
  const adapter = oauthAdapters[service];
  const enabledByConfig = oauthConfig[service]?.enabled !== false;
  return Boolean(enabledByConfig && isAdapterConfigured(adapter));
};

// --- Middleware ---
const session = require('express-session');
const BetterSqlite3 = require('better-sqlite3');
const BetterSqlite3StoreFactory = require('better-sqlite3-session-store')(session);
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet({ contentSecurityPolicy: false }));

const devOrigins = ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:4500', 'http://127.0.0.1:4500', 'http://localhost:5173', 'http://127.0.0.1:5173'];
const envOrigins = String(process.env.CORS_ORIGIN || '')
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
    if (!isProd) return callback(null, true);

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: "100kb" }));

// Global rate limiter middleware (applies to all requests except exempt paths)
const globalRateLimitMap = {};

app.use((req, res, next) => {
  // CRITICAL: Exempt all auth/dashboard bootstrap paths from rate limiting
  const isExempt = req.path === '/api/v1/auth/me' ||
                   req.path === '/api/v1/auth/debug' ||
                   req.path === '/api/v1/auth/logout' ||
                   req.path === '/api/v1/dashboard/metrics' ||
                   req.path === '/api/v1/privacy/cookies' ||
                   req.path.startsWith('/api/v1/ws') ||
                   req.path === '/health' ||
                   req.path === '/ping' ||
                   req.path.startsWith('/dashboard/');

  if (isExempt) {
    return next();
  }

  const key = `global:${req.ip}`;
  const now = Date.now();
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

const sessionDbPath = process.env.SESSION_DB_PATH || path.join(__dirname, 'db.sqlite');
const sessionDb = new BetterSqlite3(sessionDbPath);
const sessionStore = new BetterSqlite3StoreFactory({
  client: sessionDb,
  expired: {
    clear: true,
    intervalMs: 15 * 60 * 1000,
  },
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'myapi-session-secret-change-me',
  name: 'myapi.sid',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: { secure: secureCookie, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax', path: '/' }
}));

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

// Redirect to React dashboard
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
      description: 'Personal API platform. Authenticate with Bearer token to access your data, knowledge base, personas, and connected services.',
      quickStart: `https://${host}/api/v1/quick-start`,
      openapi: `https://${host}/openapi.json`,
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

app.use('/dashboard', express.static(path.join(__dirname, 'public', 'dist')));
app.use(express.static(path.join(__dirname, "public")));

// Onboarding routes
const onboardRoutes = require('./onboard');
app.use('/api/v1', onboardRoutes);

// --- AI-Discoverable API Root & Well-Known Endpoints ---

// GET /api/v1/ — API discovery root (unauthenticated)
app.get('/api/v1/', (req, res) => {
  res.json({
    name: 'MyApi',
    version: '0.1.0',
    description: 'Personal API platform. Authenticate with Bearer token to access your data, knowledge base, personas, and connected services.',
    documentation: {
      openapi: '/openapi.json',
      quickStart: '/api/v1/quick-start',
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

// GET /api/v1/quick-start — step-by-step guide for AI agents
app.get('/api/v1/quick-start', (req, res) => {
  const hasAuth = !!(req.headers.authorization || '').match(/^Bearer\s+.+/i);
  res.json({
    title: 'MyApi Quick Start for AI Agents',
    authenticated: hasAuth,
    steps: [
      {
        step: 1,
        action: 'Authenticate',
        detail: 'Add header: Authorization: Bearer <token>',
        done: hasAuth,
      },
      {
        step: 2,
        action: 'Check your permissions',
        endpoint: 'GET /api/v1/tokens/me/capabilities',
        detail: 'See what scopes your token grants access to.',
      },
      {
        step: 3,
        action: 'Explore the knowledge base',
        endpoint: 'GET /api/v1/brain/knowledge-base',
        detail: 'Read documents stored by the owner (identity, preferences, skills, etc).',
      },
      {
        step: 4,
        action: 'Check connected services',
        endpoint: 'GET /api/v1/vault/tokens',
        detail: 'See what external service tokens (e.g. PostQuee, GitHub) are stored.',
      },
      {
        step: 5,
        action: 'Use vault tokens to call external APIs',
        endpoint: 'GET /api/v1/vault/tokens/:id/reveal',
        detail: 'Retrieve the actual token value, then use it to call the external service API.',
      },
      {
        step: 6,
        action: 'Execute service methods',
        endpoint: 'POST /api/v1/services/:serviceName/execute',
        detail: 'For integrated services, execute API methods directly through MyApi.',
      },
    ],
    fullDocs: '/openapi.json',
  });
});

// /.well-known/openapi — standard discovery path
app.get('/.well-known/openapi.json', (req, res) => {
  res.redirect('/openapi.json');
});

// /.well-known/ai-plugin.json — ChatGPT/AI plugin discovery standard
app.get('/.well-known/ai-plugin.json', (req, res) => {
  const host = req.headers.host || 'www.myapiai.com';
  res.json({
    schema_version: 'v1',
    name_for_human: 'MyApi',
    name_for_model: 'myapi',
    description_for_human: 'Personal API platform for managing your digital identity, knowledge, and connected services.',
    description_for_model: 'MyApi is a personal API. Use it to: read the owner\'s knowledge base, check connected services and their tokens, manage personas, and execute actions on connected platforms. Authenticate with Bearer token. Start by calling GET /api/v1/ for endpoint discovery, then GET /api/v1/quick-start for step-by-step usage.',
    auth: { type: 'service_http', authorization_type: 'bearer' },
    api: { type: 'openapi', url: `https://${host}/openapi.json` },
    logo_url: `https://${host}/dashboard/myapi-logo.svg`,
    contact_email: 'support@myapiai.com',
    legal_info_url: `https://${host}/legal`,
  });
});

// User profile routes
app.get('/api/v1/users/me', authenticate, (req, res) => {
  let identity = {};
  if (fs.existsSync(USER_MD_PATH)) {
    const raw = fs.readFileSync(USER_MD_PATH, 'utf8');
    const lines = raw.split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*[-*]\s*\*\*(.+?)\*\*[:\s]*(.*)$/);
      if (m) identity[m[1].trim()] = (m[2] || '').trim();
    }
  }
  const user = req.user || { id: 'owner', username: 'owner' };
  res.json({ user, identity });
});

app.put('/api/v1/users/me', authenticate, (req, res) => {
  const fields = req.body || {};
  const lines = (fs.existsSync(USER_MD_PATH) ? fs.readFileSync(USER_MD_PATH, 'utf8') : '# USER.md\n\n').split('\n');

  for (const [key, rawValue] of Object.entries(fields)) {
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
  res.json({ ok: true });
});

// API Exposure policy
const EXPOSURE_PATH = path.join(__dirname, 'data', 'exposure_policy.json');
const COOKIE_PREFS_PATH = path.join(__dirname, 'data', 'cookie_preferences.json');
const DEFAULT_EXPOSURE = {
  main: { identity: true, vault: true, connectors: true, handshakes: true, audit: true },
  guest: { identity: true, vault: false, connectors: false, handshakes: false, audit: false },
  custom: []
};

app.get('/api/v1/api_exposure', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'unauthorized' });
  let policy = DEFAULT_EXPOSURE;
  try { if (fs.existsSync(EXPOSURE_PATH)) policy = JSON.parse(fs.readFileSync(EXPOSURE_PATH, 'utf8')); } catch(e) {}
  res.json({ policy });
});

app.post('/api/v1/api_exposure', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'unauthorized' });
  const policy = req.body || {};
  fs.mkdirSync(path.dirname(EXPOSURE_PATH), { recursive: true });
  fs.writeFileSync(EXPOSURE_PATH, JSON.stringify(policy, null, 2));
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

app.put('/api/v1/privacy/cookies', authenticate, (req, res) => {
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
  fs.mkdirSync(path.dirname(COOKIE_PREFS_PATH), { recursive: true });
  fs.writeFileSync(COOKIE_PREFS_PATH, JSON.stringify(data, null, 2));

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
  '/api/v1/privacy/cookies',
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

// Security: DB integrity check on startup - detect direct tampering
function checkDbIntegrity() {
  try {
    const tokens = db.prepare("SELECT id, owner_id, scope, label, created_at FROM access_tokens WHERE revoked_at IS NULL").all();
    const hash = require('crypto').createHash('sha256').update(JSON.stringify(tokens)).digest('hex');
    const integrityFile = path.join(__dirname, '.db_integrity');
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
app.use('/api/v1', authRoutes);
app.use('/api/v1/devices', authenticate, deviceRoutes);
// Device approval is now applied globally in the authenticate middleware
app.use('/api/v1/dashboard', authenticate, dashboardRoutes);
app.use('/api/v1/services', authenticate, createServicesRoutes());
app.use('/api/v1/skills', authenticate, createSkillsRoutes(
  db,
  createSkill,
  getSkills,
  getSkillById,
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

function authenticate(req, res, next) {
  // SKIP authentication for public endpoints (OAuth authorize/callback, login signup)
  const fullPath = req.baseUrl + req.path;
  const publicPaths = [
    /^\/api\/v1\/oauth\//,
    /^\/api\/v1\/auth\/login/,
    /^\/api\/v1\/auth\/signup/,
    /^\/api\/v1\/auth\/me/,
    /^\/api\/v1\/auth\/2fa\/challenge/,
    /^\/api\/v1\/billing\/plans/,
    /^\/oauth\//,
  ];
  
  const isPublicPath = publicPaths.some(pattern => pattern.test(fullPath));
  if (isPublicPath) {
    return next();
  }

  // 1) Session auth (human dashboard) — HIGHEST PRIORITY
  // CRITICAL: If session exists, use it EXCLUSIVELY. Never fall through to Bearer token auth.
  // Device approval only applies to API tokens, not session auth.
  // Sessions are from OAuth logins (browser), which are already protected by session cookies + CORS.
  if (req.session && req.session.user) {
    req.user = req.session.user;
    req.authType = 'session';
    // session users are treated as "full" for MVP; we will add RBAC later.
    req.tokenMeta = { tokenId: `sess_${req.user.id}`, scope: 'full', ownerId: String(req.user.id), label: 'session' };
    
    // SKIP device approval entirely for session auth.
    // Browsers don't have "devices" in the master-token sense; they have sessions.
    // Device approval is only for API token/agent access.
    // Session auth is complete and secure — return immediately.
    return next();
  }

  // 2) Bearer token auth (agents) or Query parameter (for basic AI fetch tools)
  // ONLY used if there's NO session.
  let rawToken = null;
  const authHeader = req.headers["authorization"] || "";
  const parts = authHeader.split(" ");
  
  if (parts.length === 2 && parts[0] === "Bearer") {
    rawToken = parts[1];
  } else if (req.query.token) {
    rawToken = req.query.token;
  } else if (req.query.api_key) {
    rawToken = req.query.api_key;
  }

  if (!rawToken) {
    console.warn('[AUTH 401] missing token/session', { method: req.method, fullPath, baseUrl: req.baseUrl, path: req.path, isPublicPath });
    return res.status(401).json({ error: "Missing session, Authorization: Bearer token, or ?token= query parameter" });
  }
  const tokens = getAccessTokens();
  let matched = null;
  for (const tokenMeta of tokens) {
    if (!tokenMeta.revokedAt && bcrypt.compareSync(rawToken, tokenMeta.hash)) {
      matched = tokenMeta;
      break;
    }
  }
  if (!matched) {
    createAuditLog({ requesterId: "unknown", action: "auth_fail", resource: req.path, ip: req.ip });
    return res.status(401).json({ error: "Invalid or revoked token" });
  }
  req.tokenMeta = matched;
  req.authType = 'bearer';
  
  // For Bearer tokens (agents/APIs), enforce device approval.
  // This adds a layer of security: even if a master token is leaked, the attacker
  // still needs to approve the device fingerprint before accessing protected APIs.
  // Exceptions: auth setup routes, device management, OAuth flows, user management (already protected by requirePowerUser),
  // and read-only activity don't require approval.
  // Use req.baseUrl to get the full path (req.path is relative to mount point)
  const routePath = req.baseUrl + req.path;
  const skipDeviceApproval = routePath.startsWith('/api/v1/auth/') || 
                             routePath.startsWith('/api/v1/devices') ||
                             routePath.startsWith('/api/v1/oauth/') ||
                             routePath.startsWith('/api/v1/users') ||
                             (routePath.startsWith('/api/v1/activity') && req.method === 'GET');
  
  if (skipDeviceApproval) {
    return next();
  }
  
  // Apply device approval for agents on protected routes
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

// Register notification system routes (after authenticate is defined)
const notificationsRoutes = require('./routes/notifications');
const activityRoutes = require('./routes/activity');
const emailRoutes = require('./routes/email');
const workspacesRoutes = require('./routes/workspaces');
app.use('/api/v1/notifications', authenticate, notificationsRoutes);
app.use('/api/v1/activity', authenticate, activityRoutes);
app.use('/api/v1/email', authenticate, emailRoutes);
app.use('/api/v1/workspaces', authenticate, workspacesRoutes);
app.use('/api/v1/invitations', authenticate, workspacesRoutes);

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
    
    if (dbPlans && dbPlans.length > 0) {
      // Transform database plans to frontend format
      const plans = dbPlans.map(plan => ({
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
      stripe_product_id: plan.stripe_product_id
    }));
    res.json({ data: plans });
  } catch (err) {
    console.error('[Billing] Error fetching plans:', err);
    // Return hardcoded plans as fallback
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
      stripe_product_id: plan.stripe_product_id
    }));
    res.json({ data: plans });
  }
});

// Import multi-tenancy middleware
const { extractWorkspaceContext, enforceMultiTenancy, switchWorkspaceHandler } = require('./middleware/multitenancy');

// Extract workspace context for all authenticated requests
app.use('/api/v1', authenticate, extractWorkspaceContext, enforceMultiTenancy);

// Workspace switching endpoint
app.post('/api/v1/workspace-switch/:workspaceId', authenticate, switchWorkspaceHandler);

function getRequestOwnerId(req) {
  return String(req?.tokenMeta?.ownerId || req?.session?.user?.id || 'owner');
}

function getRequestWorkspaceId(req) {
  if (req?.workspaceId) return req.workspaceId;
  if (req?.session?.currentWorkspace) return req.session.currentWorkspace;
  const explicit = req?.body?.workspace_id || req?.query?.workspace;
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

function requirePowerUser(req, res) {
  const configuredEmail = String(process.env.POWER_USER_EMAIL || process.env.OWNER_EMAIL || getOwnerEmailFromUserDoc() || '').trim().toLowerCase();
  if (!configuredEmail) {
    res.status(503).json({ error: 'Power-user access is not configured (set POWER_USER_EMAIL/OWNER_EMAIL or USER.md email)' });
    return false;
  }

  let email = String(req?.session?.user?.email || req?.user?.email || '').toLowerCase();
  if (!email && req?.tokenMeta?.ownerId) {
    // Special case: tokens with owner_id = 'owner' are admin tokens (legacy support)
    if (req.tokenMeta.ownerId === 'owner') {
      return true;
    }
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
}

// --- Scope Filter (Brain logic) ---
function filterByScope(data, scope) {
  if (scope === "full") return data;
  const scopeFields = {
    "professional": ["name", "role", "company", "skills", "education"],
    "availability": ["availability", "timezone", "calendar"],
    "read": ["name", "role", "company"],
  };
  const allowed = scopeFields[scope] || scopeFields["read"];
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
    createAccessToken(hash, "owner", "full", "Master Token");
    console.log("=== MyApi Platform Started ===");
    console.log("Master token created for bootstrap (hidden in logs for security)");
  } else {
    console.log("=== MyApi Platform Started ===");
    console.log("Master token already exists");
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

// Health
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
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
  if (req.tokenMeta?.scope === 'full' || String(req.tokenMeta?.tokenId || '').startsWith('sess_')) return ['admin:*'];
  return getTokenScopes(req.tokenMeta?.tokenId || '');
}

function buildCapabilitiesForRequest(req) {
  const scopes = getEffectiveScopes(req);
  const allowedPersonas = req.tokenMeta?.allowedPersonas || null;
  const canReadBrain = hasPermission(scopes, ['brain:read']) || hasPermission(scopes, ['admin:*']);
  const canReadVault = hasPermission(scopes, ['vault:read']) || hasPermission(scopes, ['admin:*']);

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
      '2) (Optional) POST /api/v1/vault/discover-api with websiteUrl to detect likely API base URL + auth scheme.',
      '3) POST /api/v1/vault/tokens with name/service/token/websiteUrl/discoverApi=true.',
      '4) POST /api/v1/brain/knowledge-base/upload using field file (or document/upload/kbFile).',
      '5) GET /api/v1/tokens/me/capabilities to confirm scope-filtered access.',
    ],
  };
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

// robots.txt — point crawlers and AIs to the API
app.get('/robots.txt', (req, res) => {
  const host = req.headers.host || 'www.myapiai.com';
  res.type('text/plain').send(
`User-agent: *
Allow: /

# MyApi - Personal API Platform
# API Documentation: https://${host}/openapi.json
# Quick Start Guide: https://${host}/api/v1/quick-start
# API Root (JSON):   https://${host}/api/v1/
# AI Plugin Manifest: https://${host}/.well-known/ai-plugin.json

Sitemap: https://${host}/sitemap.xml
`);
});

// sitemap.xml — list all discoverable endpoints
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

// /health — useful for monitoring + AI discovery
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', api: '/api/v1/', docs: '/openapi.json' });
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
      '/api/v1/vault/tokens/{id}/reveal': { get: { summary: 'Reveal vault token', security: [{ bearerAuth: [] }] } },
      '/api/v1/vault/tokens/{id}': { delete: { summary: 'Delete vault token', security: [{ bearerAuth: [] }] } },

      '/api/v1/tokens': { get: { summary: 'List master tokens', security: [{ bearerAuth: [] }] }, post: { summary: 'Create master token', security: [{ bearerAuth: [] }] } },
      '/api/v1/tokens/{id}': { get: { summary: 'Get token', security: [{ bearerAuth: [] }] }, put: { summary: 'Update token', security: [{ bearerAuth: [] }] }, delete: { summary: 'Revoke token', security: [{ bearerAuth: [] }] } },
      '/api/v1/tokens/{id}/regenerate': { post: { summary: 'Regenerate token secret', security: [{ bearerAuth: [] }] } },
      '/api/v1/tokens/master/regenerate': { post: { summary: 'Regenerate master token', security: [{ bearerAuth: [] }] } },
      '/api/v1/scopes': { get: { summary: 'List scopes', security: [{ bearerAuth: [] }] } },

      '/api/v1/connectors': { get: { summary: 'List connectors', security: [{ bearerAuth: [] }] }, post: { summary: 'Create connector', security: [{ bearerAuth: [] }] } },
      '/api/v1/gateway/context': { get: { summary: 'Gateway context', security: [{ bearerAuth: [] }] } },
      '/api/v1/audit/log': { get: { summary: 'Audit logs', security: [{ bearerAuth: [] }] } },

      '/api/v1/users': { get: { summary: 'List users', security: [{ bearerAuth: [] }] }, post: { summary: 'Create user', security: [{ bearerAuth: [] }] } },
      '/api/v1/users/{id}/plan': { put: { summary: 'Update user plan', security: [{ bearerAuth: [] }] } },

      '/api/v1/handshakes': { get: { summary: 'List handshakes', security: [{ bearerAuth: [] }] }, post: { summary: 'Create handshake', security: [{ bearerAuth: [] }] } },
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

      '/api/v1/skills': { get: { summary: 'List skills', security: [{ bearerAuth: [] }] }, post: { summary: 'Create skill', security: [{ bearerAuth: [] }] } },
      '/api/v1/skills/{id}': { get: { summary: 'Get skill', security: [{ bearerAuth: [] }] }, put: { summary: 'Update skill', security: [{ bearerAuth: [] }] }, delete: { summary: 'Delete skill', security: [{ bearerAuth: [] }] } },
      '/api/v1/skills/{id}/activate': { post: { summary: 'Activate skill', security: [{ bearerAuth: [] }] } },
      '/api/v1/skills/{id}/documents': { get: { summary: 'List skill docs', security: [{ bearerAuth: [] }] }, post: { summary: 'Attach doc to skill', security: [{ bearerAuth: [] }] } },
      '/api/v1/skills/{id}/documents/{docId}': { delete: { summary: 'Detach doc from skill', security: [{ bearerAuth: [] }] } },
      '/api/v1/skills/{id}/attachments': { get: { summary: 'List skill persona attachments', security: [{ bearerAuth: [] }] } },

      '/api/v1/brain/knowledge-base': { get: { summary: 'List KB docs', security: [{ bearerAuth: [] }] }, post: { summary: 'Create KB doc', security: [{ bearerAuth: [] }] } },
      '/api/v1/brain/knowledge-base/{id}': { get: { summary: 'Get KB doc', security: [{ bearerAuth: [] }] }, delete: { summary: 'Delete KB doc', security: [{ bearerAuth: [] }] } },
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
    <script>
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
    description_for_model: 'Call /api/v1/capabilities first. Use returned scope-aware guidance before invoking mutating endpoints.',
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

// --- IDENTITY ---
app.get("/api/v1/identity", authenticate, (req, res) => {
  const identity = vault.identityDocs["owner"] || {};
  const filtered = filterByScope(identity, req.tokenMeta.scope);
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "read_identity", resource: "/identity", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: filtered, meta: { scope: req.tokenMeta.scope } });
});

app.get("/api/v1/identity/professional", authenticate, (req, res) => {
  const identity = vault.identityDocs["owner"] || {};
  const filtered = filterByScope(identity, "professional");
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "read_identity_professional", resource: "/identity/professional", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: filtered, meta: { scope: "professional" } });
});

app.get("/api/v1/identity/availability", authenticate, (req, res) => {
  const identity = vault.identityDocs["owner"] || {};
  const filtered = filterByScope(identity, "availability");
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "read_availability", resource: "/identity/availability", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: filtered, meta: { scope: "availability" } });
});

// --- PREFERENCES ---
app.get("/api/v1/preferences", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Insufficient scope" });
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "read_preferences", resource: "/preferences", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: vault.preferences["owner"] || {} });
});

app.put("/api/v1/preferences", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Insufficient scope" });
  vault.preferences["owner"] = { ...vault.preferences["owner"], ...req.body };
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "update_preferences", resource: "/preferences", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: vault.preferences["owner"] });
});

// --- VAULT TOKENS (encrypted external API keys) ---
app.post("/api/v1/vault/tokens", authenticate, async (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can add vault tokens" });

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

    const vaultCount = getVaultTokens().length;
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

    const vaultToken = createVaultToken(tokenLabel, description, normalizedToken, normalizedService, normalizedWebsiteUrl, discovery);
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
  if (req.tokenMeta.scope !== 'full') return res.status(403).json({ error: 'Only master token can discover API metadata' });

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
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can view vault tokens" });
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "list_vault_tokens", resource: "/vault/tokens", scope: req.tokenMeta.scope, ip: req.ip });
  const tokens = getVaultTokens();
  res.json({ data: tokens, tokens });
});

app.get("/api/v1/vault/tokens/:id/reveal", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can decrypt vault tokens" });
  const vaultToken = decryptVaultToken(req.params.id);
  if (!vaultToken) return res.status(404).json({ error: "Token not found" });
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "reveal_vault_token", resource: `/vault/tokens/${req.params.id}`, scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: vaultToken });
});

app.delete("/api/v1/vault/tokens/:id", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can delete vault tokens" });
  const deleted = deleteVaultToken(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Token not found" });
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "delete_vault_token", resource: `/vault/tokens/${req.params.id}`, scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: { deleted: true } });
});

// --- ACCESS TOKENS (guest tokens with fine-grained scopes) ---

// Create a new guest token with fine-grained scopes
app.post("/api/v1/tokens", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can create tokens" });
  
  const { label = "Guest Token", scopes, expiresInHours, description, allowedPersonas } = req.body;
  
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
  
  // Create the token
  const rawToken = 'myapi_' + crypto.randomBytes(32).toString("hex");
  const hash = bcrypt.hashSync(rawToken, 10);
  let expiresAt = null;
  if (expiresInHours) expiresAt = new Date(Date.now() + expiresInHours * 3600000).toISOString();
  
  // Validate allowedPersonas if provided
  const personaIds = Array.isArray(allowedPersonas) && allowedPersonas.length > 0
    ? allowedPersonas.map(Number).filter(n => !isNaN(n))
    : null;

  const tokenId = createAccessToken(hash, "owner", JSON.stringify(finalScopes), label, expiresAt, personaIds);

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
      createdAt: new Date().toISOString(),
      expiresAt
    }
  });
});

// Get details of a specific token with its scopes
app.get("/api/v1/tokens/:id", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can view token details" });
  
  const tokens = getAccessTokens();
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
  
  res.json({
    data: {
      id: token.tokenId,
      label: token.label,
      description: null,
      scopes: scopes,
      allowedPersonas: token.allowedPersonas || null,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      active: !token.revokedAt
    }
  });
});

// Update token scopes
app.put("/api/v1/tokens/:id", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can update tokens" });
  
  const { scopes } = req.body;
  if (!scopes || (!Array.isArray(scopes) && typeof scopes !== 'string')) {
    return res.status(400).json({ error: "scopes must be provided as a string or array" });
  }
  
  const tokens = getAccessTokens();
  const token = tokens.find(t => t.tokenId === req.params.id);
  if (!token) return res.status(404).json({ error: "Token not found" });
  
  // Parse new scopes
  let finalScopes = [];
  if (typeof scopes === 'string') {
    const expanded = expandScopeTemplate(scopes);
    if (expanded) {
      finalScopes = expanded;
    } else if (validateScope(scopes)) {
      finalScopes = [scopes];
    } else {
      return res.status(400).json({ error: `Invalid scope: ${scopes}` });
    }
  } else if (Array.isArray(scopes)) {
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
  }
  
  // Remove duplicates
  finalScopes = [...new Set(finalScopes)];
  
  if (finalScopes.length === 0) {
    return res.status(400).json({ error: "No valid scopes provided" });
  }
  
  // Update token scopes: revoke old, grant new
  revokeScopes(req.params.id);
  grantScopes(req.params.id, finalScopes);
  
  // Update the scope field in access_tokens
  const updateStmt = db.prepare('UPDATE access_tokens SET scope = ? WHERE id = ?');
  updateStmt.run(JSON.stringify(finalScopes), req.params.id);
  
  createAuditLog({ 
    requesterId: req.tokenMeta.tokenId, 
    action: "update_token_scopes", 
    resource: `/tokens/${req.params.id}`, 
    scope: req.tokenMeta.scope, 
    ip: req.ip,
    details: { newScopes: finalScopes }
  });
  
  res.json({ 
    data: {
      id: req.params.id,
      scopes: finalScopes,
      updatedAt: new Date().toISOString()
    }
  });
});

// List available scopes (requires admin:* or special access)
app.get("/api/v1/scopes", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can list scopes" });
  
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
        read: ['identity:read', 'vault:read', 'services:read', 'brain:read', 'audit:read', 'skills:read'],
        professional: ['identity:read'],
        availability: ['identity:read'],
        guest: ['identity:read'],
        admin: ['admin:*']
      }
    }
  });
});

// Regenerate token secret (returns a new raw token for same token id/scopes)
app.post("/api/v1/tokens/:id/regenerate", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can regenerate tokens" });

  const tokens = getAccessTokens();
  const token = tokens.find(t => t.tokenId === req.params.id);
  if (!token) return res.status(404).json({ error: "Token not found" });
  if (token.revokedAt) return res.status(400).json({ error: "Cannot regenerate a revoked token" });

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

// Regenerate master token (creates a new full-scope master token)
app.post('/api/v1/tokens/master/regenerate', authenticate, (req, res) => {
  if (req.tokenMeta.scope !== 'full') return res.status(403).json({ error: 'Only master token can regenerate master token' });

  try {
    const ownerId = req.tokenMeta.ownerId || 'admin';
    revokeExistingMasterTokens(ownerId);
    const rawToken = 'myapi_' + crypto.randomBytes(32).toString("hex");
    const hash = bcrypt.hashSync(rawToken, 10);
    const tokenId = createAccessToken(hash, ownerId, 'full', 'Master Token', null, null);

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'regenerate_master_token',
      resource: '/tokens/master/regenerate',
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { tokenId }
    });

    // Security: update integrity hash and alert
    try { checkDbIntegrity(); } catch(_) {}
    console.warn(`🔑 SECURITY: Master token regenerated by=${req.tokenMeta.tokenId}, ip=${req.ip}`);

    res.json({ data: { id: tokenId, token: rawToken, scope: 'full' } });
  } catch (error) {
    console.error('Master token regeneration error:', error);
    res.status(500).json({ error: 'Failed to regenerate master token' });
  }
});

// Bootstrap a master token for authenticated session users when client has none.
app.post('/api/v1/tokens/master/bootstrap', authenticate, (req, res) => {
  try {
    const ownerId = req?.tokenMeta?.ownerId || req?.session?.user?.id || req?.user?.id;
    if (!ownerId) return res.status(401).json({ error: 'Not authenticated' });

    // Do NOT revoke existing master tokens! This breaks external scripts.
    // revokeExistingMasterTokens(ownerId);
    
    const rawToken = 'myapi_' + crypto.randomBytes(32).toString("hex");
    const hash = bcrypt.hashSync(rawToken, 10);
    const tokenId = createAccessToken(hash, ownerId, 'full', 'Master Token (Dashboard Session)', null, null);

    if (req.session) {
      req.session.masterTokenRaw = rawToken;
      req.session.masterTokenId = tokenId;
      req.session.save?.();  // Explicitly save session
    }

    // Also save to global.sessions for Bearer token users
    const authHeader = req.headers.authorization;
    if (authHeader && global.sessions) {
      const bearerToken = authHeader.replace('Bearer ', '');
      if (global.sessions[bearerToken]) {
        global.sessions[bearerToken].masterTokenRaw = rawToken;
        global.sessions[bearerToken].masterTokenId = tokenId;
      }
    }

    createAuditLog({
      requesterId: req?.tokenMeta?.tokenId || ownerId,
      action: 'bootstrap_master_token',
      resource: '/tokens/master/bootstrap',
      scope: req?.tokenMeta?.scope || 'session',
      ip: req.ip,
      details: { tokenId, ownerId }
    });

    res.json({ data: { id: tokenId, token: rawToken, scope: 'full' } });
  } catch (error) {
    console.error('Master token bootstrap error:', error);
    res.status(500).json({ error: 'Failed to bootstrap master token' });
  }
});

// Revoke (delete) a token
app.delete("/api/v1/tokens/:id", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can revoke tokens" });
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
  
  res.json({ data: { tokenId: req.params.id, revoked: true } });
});

// List all tokens (legacy endpoint with scopes)
app.get("/api/v1/tokens", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can list tokens" });
  
  const tokens = getAccessTokens();
  const tokensWithScopes = tokens.map(t => ({
    ...t,
    scopes: getTokenScopes(t.tokenId),
    allowedPersonas: t.allowedPersonas || null
  }));
  
  createAuditLog({ 
    requesterId: req.tokenMeta.tokenId, 
    action: "list_tokens", 
    resource: "/tokens", 
    scope: req.tokenMeta.scope, 
    ip: req.ip 
  });
  
  res.json({ data: tokensWithScopes });
});

// Validate token endpoint (for login page)
app.post("/api/v1/tokens/validate", authRateLimit, (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token is required" });
  
  const tokens = getAccessTokens();
  let matched = null;
  
  // Find matching token
  for (const tokenRecord of tokens) {
    if (!tokenRecord.revokedAt && bcrypt.compareSync(token, tokenRecord.hash)) {
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
    name: 'Free',
    price_cents: 0,
    priceMonthly: 0, // deprecated, kept for backwards compat
    description: 'Perfect for individuals getting started',
    features: [
      '1 AI Persona',
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
    stripe_product_id: null,
    stripePaymentLinkEnv: null,
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
      'Priority support'
    ],
    monthlyApiCallLimit: 100000,
    maxServices: -1, // unlimited
    maxTeamMembers: 10,
    maxSkillsPerPersona: -1, // unlimited
    stripe_product_id: 'prod_pro_myapi',
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
      'Priority 24/7 support',
      'Custom SLA & onboarding',
      'Dedicated infrastructure option'
    ],
    monthlyApiCallLimit: -1, // unlimited
    maxServices: -1, // unlimited
    maxTeamMembers: -1, // unlimited
    maxSkillsPerPersona: -1, // unlimited
    stripe_product_id: 'prod_enterprise_myapi',
    stripePaymentLinkEnv: 'STRIPE_PAYMENT_LINK_ENTERPRISE',
  },
};

const PLAN_ENFORCEMENT_ENABLED = process.env.NODE_ENV === 'test'
  ? false
  : process.env.ENFORCE_PLAN_LIMITS !== 'false';

const PLAN_LIMITS = {
  free: {
    personas: 1,
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
    const workspaceId = getRequestWorkspaceId(req);
    if (workspaceId) {
      const sub = getBillingSubscriptionByWorkspace(workspaceId);
      return resolveWorkspaceCurrentPlan(sub).id;
    }

    if (req?.user?.id) {
      const user = getUserById(req.user.id);
      if (user?.plan && BILLING_PLAN_LIMITS[String(user.plan).toLowerCase()]) return String(user.plan).toLowerCase();
    }

    const ownerId = req?.tokenMeta?.ownerId;
    if (ownerId) {
      const owner = getUserById(ownerId);
      if (owner?.plan && BILLING_PLAN_LIMITS[String(owner.plan).toLowerCase()]) return String(owner.plan).toLowerCase();
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

// --- BILLING / STRIPE CHECKOUT + USAGE ---
app.post('/api/v1/billing/checkout', authenticate, async (req, res) => {
  try {
    const { plan } = req.body || {};
    const selectedPlan = String(plan || '').toLowerCase().trim();
    const definition = BILLING_PLANS[selectedPlan];
    if (!definition) {
      return res.status(400).json({ error: `Invalid plan. Allowed: ${Object.keys(BILLING_PLANS).join(', ')}` });
    }

    const workspaceId = getRequestWorkspaceId(req);
    if (!workspaceId) return res.status(400).json({ error: 'Workspace context is required' });

    if (!isStripeConfigured()) {
      upsertBillingSubscription(workspaceId, {
        stripe_subscription_id: `mock_sub_${Date.now()}`,
        plan_id: selectedPlan,
        status: selectedPlan === 'free' ? 'active' : 'pending',
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

    // MVP-safe: if checkout price mapping is not configured, keep current payment-link behavior
    const paymentLink = process.env[definition.stripePaymentLinkEnv] || (selectedPlan === 'pro' ? process.env.STRIPE_PAYMENT_LINK || '' : '');
    upsertBillingSubscription(workspaceId, {
      stripe_subscription_id: `pending_${Date.now()}`,
      plan_id: selectedPlan,
      status: selectedPlan === 'free' ? 'active' : 'pending',
    });

    return res.json({
      url: paymentLink || null,
      plan: selectedPlan,
      provider: 'stripe',
      customerId: customer?.stripe_customer_id || null,
      message: paymentLink ? undefined : 'No Stripe payment link configured for this plan',
    });
  } catch (error) {
    console.error('Stripe checkout init error:', error);
    return res.status(500).json({ error: 'Failed to initialize checkout' });
  }
});

app.get('/api/v1/billing/current', (req, res) => {
  const workspaceId = getRequestWorkspaceId(req);
  if (!workspaceId) return res.status(400).json({ error: 'Workspace context is required' });

  const subscription = getBillingSubscriptionByWorkspace(workspaceId);
  const plan = resolveWorkspaceCurrentPlan(subscription);

  res.json({
    data: {
      workspaceId,
      plan: plan.id,
      status: subscription?.status || 'active',
      subscription: subscription ? {
        stripeSubscriptionId: subscription.stripe_subscription_id,
        periodStart: subscription.period_start,
        periodEnd: subscription.period_end,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      } : null,
      billingConfigured: isStripeConfigured(),
    },
  });
});

app.get('/api/v1/billing/invoices', (req, res) => {
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

app.get('/api/v1/billing/usage', (req, res) => {
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

  const subscription = getBillingSubscriptionByWorkspace(workspaceId);
  const usageVsLimits = computeUsageVsLimits(resolveWorkspaceCurrentPlan(subscription), totals);

  res.json({
    data: {
      workspaceId,
      range: `${days}d`,
      totals,
      daily: rows,
      limits: usageVsLimits.metrics,
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

app.post('/api/v1/billing/webhook', async (req, res) => {
  const configuredSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const event = req.body || {};

  if (configuredSecret) {
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing Stripe signature' });
    // NOTE: verification requires raw request body middleware; keep strict failure instead of silent acceptance.
    if (typeof req.body !== 'string' && !Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'Webhook verification requires raw body middleware configuration' });
    }
  }

  const type = event?.type;
  const obj = event?.data?.object || {};
  const metadataWorkspaceId = obj?.metadata?.workspace_id || null;

  if (type === 'customer.subscription.created' || type === 'customer.subscription.updated') {
    if (metadataWorkspaceId) {
      upsertBillingSubscription(metadataWorkspaceId, {
        stripe_subscription_id: obj.id,
        plan_id: (obj.items?.data?.[0]?.price?.nickname || obj.items?.data?.[0]?.price?.lookup_key || 'free').toLowerCase(),
        status: obj.status || 'active',
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
    }
  }

  return res.json({ received: true });
});

// --- CONNECTORS ---
app.get("/api/v1/connectors", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Insufficient scope" });
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "list_connectors", resource: "/connectors", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: getConnectors() });
});

app.post("/api/v1/connectors", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Insufficient scope" });
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
  // Only master token can access full context
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can access gateway context" });
  
  try {
    // Read USER.md
    let userProfile = {};
    if (fs.existsSync(USER_MD_PATH)) {
      const raw = fs.readFileSync(USER_MD_PATH, "utf8");
      const lines = raw.split("\n");
      for (const line of lines) {
        const match = line.match(/^\s*[-*]\s*\*\*(.+?)\*\*[:\s]*(.+)/);
        if (match) {
          const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
          userProfile[key] = match[2].trim();
        }
      }
    }
    
    // Get active persona from database
    let soulProfile = {};
    const activePersona = getActivePersona();
    if (activePersona) {
      soulProfile.raw = activePersona.soul_content; // Use active persona's soul_content
      const lines = activePersona.soul_content.split("\n");
      for (const line of lines) {
        const match = line.match(/^\s*[-*]\s*\*\*(.+?)\*\*[:\s]*(.+)/);
        if (match) {
          const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
          soulProfile[key] = match[2].trim();
        }
      }
    } else {
      // Fallback to SOUL.md file if no active persona
      if (fs.existsSync(SOUL_MD_PATH)) {
        const raw = fs.readFileSync(SOUL_MD_PATH, "utf8");
        soulProfile.raw = raw;
        const lines = raw.split("\n");
        for (const line of lines) {
          const match = line.match(/^\s*[-*]\s*\*\*(.+?)\*\*[:\s]*(.+)/);
          if (match) {
            const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
            soulProfile[key] = match[2].trim();
          }
        }
      }
    }
    
    // Read MEMORY.md
    const memoryMdPath = path.join(__dirname, "..", "..", "..", "MEMORY.md");
    let memoryContext = {};
    if (fs.existsSync(memoryMdPath)) {
      const raw = fs.readFileSync(memoryMdPath, "utf8");
      memoryContext.raw = raw; // Include full MEMORY.md
    }
    
    // Get available connectors
    const connectors = getConnectors();
    
    // Get vault tokens (without exposing values)
    const vaultTokens = getVaultTokens().map(t => ({
      id: t.id,
      label: t.label,
      description: t.description,
      createdAt: t.createdAt,
      // Never include the actual token value
    }));
    
    // Get all personas (for meta)
    const allPersonas = getPersonas(getRequestOwnerId(req));
    const personaList = allPersonas.map(p => ({
      id: p.id,
      name: p.name,
      active: p.active,
      created_at: p.created_at
    }));
    
    // Assemble gateway context
    const context = {
      timestamp: new Date().toISOString(),
      version: "1.0",
      user: {
        profile: userProfile,
        persona: {
          identity: soulProfile,
          preferences: vault.preferences["owner"] || {},
        },
      },
      services: {
        connectors: connectors,
        vault: {
          tokens: vaultTokens,
        },
      },
      memory: {
        context: memoryContext,
      },
      meta: {
        requesterId: req.tokenMeta.tokenId,
        timestamp: new Date().toISOString(),
        personas: personaList,
        activePersonaId: activePersona ? activePersona.id : null,
      },
    };
    
    // Log the request
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
    res.status(500).json({ error: "Failed to assemble gateway context", details: error.message });
  }
});

// --- AUDIT LOG ---
app.get("/api/v1/audit", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can view audit log" });
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = (page - 1) * limit;
  const { logs, total } = getAuditLogs(limit, offset);
  res.json({ data: logs, meta: { total, page, limit } });
});

// ============================
// PUBLIC AUTH (Register + Login)
// ============================
app.post("/api/v1/auth/register", (req, res) => {
  const { username, password, display_name, email, timezone } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password are required" });

  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: "Password must be at least 8 characters and contain 3 of: uppercase, lowercase, number, symbol" });
  }

  try {
    const user = createUser(username, display_name || username, email, timezone, password);
    createAuditLog({ requesterId: user.id, action: "user_register", resource: `/users/${user.id}`, scope: "public", ip: req.ip });
    res.status(201).json({ data: user });
  } catch (e) {
    if (e.message && e.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Username already exists" });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/v1/auth/login", (req, res) => {
  const { username, password, totpCode } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password are required" });
  const user = getUserByUsername(username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

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
      return res.status(401).json({ error: "Invalid 2FA code", requires2FA: true });
    }
  }

  // Generate a session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  // Store session in memory (simple approach)
  if (!global.sessions) global.sessions = {};
  global.sessions[sessionToken] = { userId: user.id, username: user.username, createdAt: Date.now() };
  createAuditLog({ requesterId: user.id, action: "user_login", resource: `/users/${user.id}`, scope: "session", ip: req.ip });
  res.json({ data: { token: sessionToken, user: { id: user.id, username: user.username, displayName: user.displayName, email: user.email, timezone: user.timezone, twoFactorEnabled: Boolean(user.twoFactorEnabled) } } });
});

// Token-based login (for API access tokens)
app.post("/api/v1/auth/token-login", authRateLimit, (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token is required" });
  
  // Verify token against stored tokens
  const tokens = getAccessTokens();
  const tokenRecord = tokens.find(t => {
    // Check if token matches the hash
    return bcrypt.compareSync(token, t.hash);
  });
  
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
    const normalizedUser = {
      ...sessionUser,
      displayName: sessionUser.displayName || sessionUser.display_name || sessionUser.username || null,
      avatarUrl: sessionUser.avatarUrl || sessionUser.avatar_url || null,
      email: sessionUser.email || null,
    };

    // Keep backward compatibility (flat shape) while exposing canonical user payload.
    return res.json({
      success: true,
      ...normalizedUser,
      user: normalizedUser,
      bootstrap: req.session.masterTokenRaw && req.session.masterTokenId
        ? { masterToken: req.session.masterTokenRaw, tokenId: req.session.masterTokenId }
        : null,
    });
  }

  // Legacy bearer session-token auth
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.replace("Bearer ", "");
  if (global.sessions && global.sessions[token]) {
    const session = global.sessions[token];
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
        bootstrap: session.masterTokenRaw && session.masterTokenId
          ? { masterToken: session.masterTokenRaw, tokenId: session.masterTokenId }
          : null,
      });
    }
  }
  res.status(401).json({ error: "Invalid session" });
});

// GET /api/v1/auth/debug — Public diagnostic endpoint
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

    const enabled = enableUserTwoFactor(userId);
    if (!enabled) return res.status(500).json({ error: 'Failed to enable 2FA for this user' });
    if (req.session?.user) req.session.user.two_factor_enabled = true;

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

    disableUserTwoFactor(userId);
    if (req.session?.user) req.session.user.two_factor_enabled = false;

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

app.post('/api/v1/auth/2fa/challenge', (req, res) => {
  try {
    const { code } = req.body || {};
    const pendingUser = req?.session?.pending_2fa_user;
    if (!pendingUser?.id) return res.status(401).json({ error: 'No pending 2FA challenge' });
    if (!code) return res.status(400).json({ error: '2FA code is required' });

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
    if (!verified) return res.status(401).json({ error: 'Invalid 2FA code' });

    req.session.user = pendingUser;
    delete req.session.pending_2fa_user;

    if (!req.session.masterTokenRaw) {
      const existingTokens = getAccessTokens();
      const hasValidMaster = existingTokens.some(t => 
        t.scope === 'full' && !t.revokedAt && t.ownerId === String(pendingUser.id)
      );
      
      if (!hasValidMaster) {
        const rawMasterToken = 'myapi_' + crypto.randomBytes(32).toString("hex");
        const hash = bcrypt.hashSync(rawMasterToken, 10);
        const tokenId = createAccessToken(hash, pendingUser.id, 'full', 'Master Token (OAuth 2FA)', null, null);
        req.session.masterTokenRaw = rawMasterToken;
        req.session.masterTokenId = tokenId;
      }
    }

    createAuditLog({ requesterId: String(pendingUser.id), action: '2fa_challenge_passed', resource: '/auth/2fa/challenge', scope: 'session', ip: req.ip });
    return req.session.save(() => {
      res.json({ ok: true, data: { user: req.session.user, bootstrap: { masterToken: req.session.masterTokenRaw, tokenId: req.session.masterTokenId || null } } });
    });
  } catch (error) {
    return res.status(500).json({ error: `2FA challenge failed: ${error.message}` });
  }
});

app.post("/api/v1/auth/logout", (req, res) => {
  if (req.session) {
    delete req.session.pending_2fa_user;
    req.session.destroy(() => {});
  }

  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    if (global.sessions) delete global.sessions[token];
  }
  res.json({ ok: true });
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
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can create users" });
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
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can list users" });
  if (!requirePowerUser(req, res)) return;
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "list_users", resource: "/users", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: getUsers() });
});

app.put('/api/v1/users/:id/plan', planFeatureRateLimit, authenticate, (req, res) => {
  if (req.tokenMeta.scope !== 'full') return res.status(403).json({ error: 'Only master token can manage plans' });
  if (!requirePowerUser(req, res)) return;
  try {
    const { id } = req.params;
    const { plan } = req.body || {};
    const user = updateUserPlan(id, plan);
    if (!user) return res.status(404).json({ error: 'User not found' });

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
  if (req.tokenMeta.scope !== 'full') return res.status(403).json({ error: 'Only master token can manage subscriptions' });
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
  if (req.tokenMeta.scope !== 'full') return res.status(403).json({ error: 'Only master token can delete users' });
  if (!requirePowerUser(req, res)) return;

  try {
    const { id } = req.params;
    const user = getUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (String(user.email || '').toLowerCase() === 'admin@your.domain.com') {
      return res.status(400).json({ error: 'Cannot delete power user account' });
    }

    const tx = db.transaction((userId) => {
      db.prepare('DELETE FROM oauth_tokens WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM access_tokens WHERE owner_id = ?').run(userId);
      db.prepare('DELETE FROM handshakes WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)').run(userId);
      db.prepare('DELETE FROM conversations WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM persona_documents WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)').run(userId);
      db.prepare('DELETE FROM persona_skills WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)').run(userId);
      db.prepare('DELETE FROM skills WHERE owner_id = ?').run(userId);
      db.prepare('DELETE FROM personas WHERE owner_id = ?').run(userId);
      db.prepare('DELETE FROM kb_documents WHERE owner_id = ?').run(userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });
    tx(id);

    createAuditLog({ requesterId: req.tokenMeta.tokenId, action: 'delete_user', resource: `/users/${id}`, scope: req.tokenMeta.scope, ip: req.ip, details: { email: user.email || null } });
    res.json({ ok: true, deletedUserId: id });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.post('/api/v1/users/cleanup-test-users', authenticate, (req, res) => {
  if (req.tokenMeta.scope !== 'full') return res.status(403).json({ error: 'Only master token can cleanup users' });
  if (!requirePowerUser(req, res)) return;

  const prefix = String(req.body?.prefix || 'phase12a_');
  try {
    const users = db.prepare('SELECT id, email, username FROM users WHERE username LIKE ?').all(`${prefix}%`);
    let deleted = 0;
    const tx = db.transaction((list) => {
      for (const u of list) {
        db.prepare('DELETE FROM oauth_tokens WHERE user_id = ?').run(u.id);
        db.prepare('DELETE FROM access_tokens WHERE owner_id = ?').run(u.id);
        db.prepare('DELETE FROM handshakes WHERE user_id = ?').run(u.id);
        db.prepare('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)').run(u.id);
        db.prepare('DELETE FROM conversations WHERE user_id = ?').run(u.id);
        db.prepare('DELETE FROM persona_documents WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)').run(u.id);
        db.prepare('DELETE FROM persona_skills WHERE persona_id IN (SELECT id FROM personas WHERE owner_id = ?)').run(u.id);
        db.prepare('DELETE FROM skills WHERE owner_id = ?').run(u.id);
        db.prepare('DELETE FROM personas WHERE owner_id = ?').run(u.id);
        db.prepare('DELETE FROM kb_documents WHERE owner_id = ?').run(u.id);
        const r = db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
        if (r.changes > 0) deleted += 1;
      }
    });
    tx(users);

    createAuditLog({ requesterId: req.tokenMeta.tokenId, action: 'cleanup_test_users', resource: '/users/cleanup-test-users', scope: req.tokenMeta.scope, ip: req.ip, details: { prefix, deleted } });
    res.json({ ok: true, prefix, deleted });
  } catch (error) {
    console.error('Cleanup test users error:', error);
    res.status(500).json({ error: 'Failed to cleanup test users' });
  }
});

// ============================
// NEW: HANDSHAKES (AI Agent Access Requests)
// ============================

// PUBLIC: AI agent initiates a handshake request (no auth required — this is the entry point)
app.post("/api/v1/handshakes", (req, res) => {
  const { agentId, userId, requestedScopes, message } = req.body;
  if (!agentId || !requestedScopes || !Array.isArray(requestedScopes)) {
    return res.status(400).json({ error: "agentId and requestedScopes (array) are required" });
  }
  const validScopes = ["read", "professional", "availability"];
  const invalidScopes = requestedScopes.filter(s => !validScopes.includes(s));
  if (invalidScopes.length > 0) {
    return res.status(400).json({ error: `Invalid scopes: ${invalidScopes.join(", ")}. Allowed: ${validScopes.join(", ")}` });
  }
  const targetUser = userId || "owner";
  const handshake = createHandshake(targetUser, agentId, requestedScopes, message);
  createAuditLog({ requesterId: agentId, action: "handshake_request", resource: `/handshakes/${handshake.id}`, scope: requestedScopes.join(","), ip: req.ip });
  res.status(201).json({
    data: {
      handshakeId: handshake.id,
      status: "pending",
      message: "Your access request has been submitted. The user will review and approve/deny it."
    }
  });
});

// ADMIN: List handshakes (with optional status filter)
app.get("/api/v1/handshakes", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can view handshakes" });
  const status = req.query.status || null;
  const handshakes = getHandshakes(status);
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "list_handshakes", resource: "/handshakes", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: handshakes });
});

// ADMIN: Approve a handshake → creates scoped token for the agent
app.post("/api/v1/handshakes/:id/approve", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can approve handshakes" });
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
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can deny handshakes" });
  const denied = denyHandshake(req.params.id);
  if (!denied) return res.status(404).json({ error: "Handshake not found" });
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "handshake_deny", resource: `/handshakes/${req.params.id}`, scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: { handshakeId: req.params.id, status: "denied" } });
});

// ADMIN: Revoke a handshake (also revokes the associated token)
app.post("/api/v1/handshakes/:id/revoke", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can revoke handshakes" });
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

// POST /api/v1/personas — Create new persona
app.post("/api/v1/personas", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can create personas" });
  const { name, soul_content, description, templateData } = req.body;
  if (!name || !soul_content) return res.status(400).json({ error: "name and soul_content are required" });
  
  // Validate soul_content is markdown-like
  if (typeof soul_content !== 'string' || soul_content.trim().length === 0) {
    return res.status(400).json({ error: "soul_content must be non-empty markdown text" });
  }

  const ownerId = getRequestOwnerId(req);
  const personaCount = getPersonas(ownerId).length;
  const personaLimitErr = enforcePlanLimit(req, 'personas', personaCount, 1);
  if (personaLimitErr) return res.status(403).json(personaLimitErr);
  
  const persona = createPersona(name, soul_content, description, templateData, ownerId);
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

// GET /api/v1/personas — List all personas
app.get("/api/v1/personas", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can list personas" });
  const ownerId = getRequestOwnerId(req);
  const personas = getPersonas(ownerId);
  createAuditLog({ 
    requesterId: req.tokenMeta.tokenId, 
    action: "list_personas", 
    resource: "/personas", 
    scope: req.tokenMeta.scope, 
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
      created_at: p.created_at
    }))
  });
});

// GET /api/v1/personas/:id — Get specific persona (including soul_content)
app.get("/api/v1/personas/:id", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can view personas" });
  const ownerId = getRequestOwnerId(req);
  const persona = getPersonaById(parseInt(req.params.id), ownerId);
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

// PUT /api/v1/personas/:id — Update persona or set as active
app.put("/api/v1/personas/:id", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can update personas" });
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

// DELETE /api/v1/personas/:id — Remove persona (if not the only one)
app.delete("/api/v1/personas/:id", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can delete personas" });
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

// GET /api/v1/personas/:id/documents — Get attached KB documents
app.get("/api/v1/personas/:id/documents", authenticate, (req, res) => {
  const personaId = parseInt(req.params.id);
  const ownerId = getRequestOwnerId(req);
  const docs = getPersonaDocuments(personaId, ownerId);
  res.json({ data: docs });
});

// POST /api/v1/personas/:id/documents — Attach a KB document
app.post("/api/v1/personas/:id/documents", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Insufficient scope" });
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

// DELETE /api/v1/personas/:id/documents/:docId — Detach a KB document
app.delete("/api/v1/personas/:id/documents/:docId", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Insufficient scope" });
  const personaId = parseInt(req.params.id);
  const { docId } = req.params;
  detachDocumentFromPersona(personaId, docId);
  res.json({ ok: true });
});

// --- Persona Skills ---
app.get('/api/v1/personas/:id/skills', authenticate, (req, res) => {
  const personaId = parseInt(req.params.id);
  const ownerId = getRequestOwnerId(req);
  const skills = getPersonaSkills(personaId, ownerId);
  res.json({ data: skills });
});

app.post('/api/v1/personas/:id/skills', authenticate, (req, res) => {
  if (req.tokenMeta.scope !== 'full') return res.status(403).json({ error: 'Insufficient scope' });
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
  if (req.tokenMeta.scope !== 'full') return res.status(403).json({ error: 'Insufficient scope' });
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

// GET /api/v1/oauth/authorize/:service — Start OAuth flow
app.get("/api/v1/oauth/authorize/:service", (req, res) => {
  const { service } = req.params;
  const mode = (req.query.mode || 'connect').toString();
  
  // DEBUG: Log all requests
  console.log(`[OAuth] authorize/${service} requested`);
  console.log(`[OAuth] Mode: ${mode}`);
  console.log(`[OAuth] Available services: ${OAUTH_SERVICES.join(', ')}`);

  // Validate service parameter
  if (!service || typeof service !== 'string' || service.trim().length === 0) {
    console.log(`[OAuth] ERROR: Invalid service parameter: "${service}"`);
    return res.status(400).json({ 
      error: 'Invalid service parameter',
      message: `Service parameter must be a non-empty string. Got: ${typeof service}`
    });
  }

  // Check if service is in the list of supported OAuth services
  if (!OAUTH_SERVICES.includes(service)) {
    console.log(`[OAuth] ERROR: Service "${service}" not in supported services. Available: ${OAUTH_SERVICES.join(', ')}`);
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
    console.log(`[OAuth] ERROR: Service "${service}" is not enabled. Configured: ${isConfigured}`);
    
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
    state = createStateToken(service, 10);
  } catch (stateError) {
    console.error(`[OAuth] Failed to create state token for ${service}:`, stateError);
    return res.status(500).json({ 
      error: 'Failed to initialize OAuth flow',
      message: 'Could not create secure state token'
    });
  }

  // Store OAuth flow metadata in session
  req.session.oauthStateMeta = req.session.oauthStateMeta || {};
  req.session.oauthStateMeta[state] = {
    mode,
    returnTo: String(req.query.returnTo || '/dashboard/'),
    createdAt: Date.now(),
  };

  // Get authorization URL from adapter
  let authUrl;
  try {
    const adapter = oauthAdapters[service];
    const runtimeAuthParams = {};
    if (service === 'twitter') {
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
    details: { service, mode, state: state.substring(0, 10) + '...' }
  });

  // Determine response format (JSON or redirect)
  const wantsJson = String(req.query.json || '').toLowerCase() === '1';
  
  if (wantsJson) {
    console.log(`[OAuth] Returning JSON response for ${service}`);
    return res.json({ 
      ok: true, 
      authUrl, 
      state,
      service
    });
  }

  // Default behavior: redirect to OAuth provider
  console.log(`[OAuth] Redirecting to ${service} OAuth provider at: ${authUrl.split('?')[0]}`);
  return res.redirect(authUrl);
});

// Catch incomplete OAuth callbacks (e.g., /api/v1/oauth without :service)
// and provide helpful error message
app.get(["/api/v1/oauth", "/oauth"], (req, res) => {
  return res.status(400).json({ 
    error: "OAuth callback incomplete - missing service parameter",
    hint: "Expected /api/v1/oauth/callback/:service (e.g., /api/v1/oauth/callback/google)"
  });
});

// GET /api/v1/oauth/callback/:service — Handle OAuth callback
// Also support legacy/public callback paths to avoid provider-side 404s when
// an app is configured without the /api/v1 prefix.
app.get([
  "/api/v1/oauth/callback/:service",
  "/oauth/callback/:service",
  "/api/oauth/callback/:service",
], async (req, res) => {
  const { service } = req.params;
  const { code, state, error: providerError, error_description: providerErrorDescription } = req.query;

  if (!OAUTH_SERVICES.includes(service)) {
    return res.status(400).json({ error: "Invalid OAuth service" });
  }
  if (!state || !validateStateToken(service, state)) {
    return res.status(400).json({ error: "Invalid or expired state token" });
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

  const stateMeta = req.session?.oauthStateMeta?.[state];
  if (!stateMeta) {
    return res.status(400).json({ error: "OAuth flow session expired or invalid state" });
  }
  if (req.session?.oauthStateMeta) delete req.session.oauthStateMeta[state];

  // Prevent open redirect
  let safeReturnTo = stateMeta.returnTo || '/dashboard/';
  if (!safeReturnTo.startsWith('/') || safeReturnTo.startsWith('//')) {
    safeReturnTo = '/dashboard/';
  }

  try {
    const adapter = oauthAdapters[service];
    const runtimeTokenParams = {};
    if (service === 'twitter') {
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

      const email = p.email || idTokenPayload.email || `${service}_${Date.now()}@local.myapi`;
      const name = p.name || idTokenPayload.name || p.given_name || idTokenPayload.given_name || email.split('@')[0] || `${service}_user`;
      const avatarUrl = p.picture?.data?.url || p.picture || idTokenPayload.picture || null;

      const usernameBase = email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 30) || `${service}_${Date.now()}`;
      let username = usernameBase;
      let existing = getUserByUsername(username);
      if (existing && existing.email !== email) {
        username = `${usernameBase}_${Date.now().toString().slice(-6)}`;
        existing = getUserByUsername(username);
      }

      let appUser = getUsers().find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || existing;
      let isNewUser = false;
      if (!appUser) {
        appUser = createUser(
          username,
          name,
          email,
          'UTC',
          crypto.randomBytes(24).toString('hex'),
          'free',
          avatarUrl
        );
        isNewUser = true;
      } else {
        appUser = updateUserOAuthProfile(appUser.id, { displayName: name, email, avatarUrl }) || appUser;
      }

      if (appUser.twoFactorEnabled) {
        req.session.pending_2fa_user = {
          id: appUser.id,
          username: appUser.username,
          display_name: appUser.displayName || appUser.username,
          displayName: appUser.displayName || appUser.username,
          email: appUser.email || email,
          avatar_url: appUser.avatarUrl || avatarUrl || null,
          avatarUrl: appUser.avatarUrl || avatarUrl || null,
          two_factor_enabled: true,
          roles: appUser.roles || 'user',
        };
        const next = encodeURIComponent(safeReturnTo);
        const redirectUrl = `/dashboard/?oauth_service=${service}&oauth_status=pending_2fa&next=${next}`;
        return req.session.save(() => {
          res.redirect(redirectUrl);
        });
      }

      req.session.user = {
        id: appUser.id,
        username: appUser.username,
        display_name: appUser.displayName || appUser.username,
        displayName: appUser.displayName || appUser.username,
        email: appUser.email || email,
        avatar_url: appUser.avatarUrl || avatarUrl || null,
        avatarUrl: appUser.avatarUrl || avatarUrl || null,
        two_factor_enabled: Boolean(appUser.twoFactorEnabled),
        roles: appUser.roles || 'user',
      };

      // Mark if this is the user's first login
      req.session.isFirstLogin = isNewUser;

      // Ensure each OAuth-logged-in user receives a full master token for dashboard/API actions.
      // Always create a fresh master token for this session (can't retrieve hashed ones from DB)
      const rawMasterToken = 'myapi_' + crypto.randomBytes(32).toString("hex");
      const hash = bcrypt.hashSync(rawMasterToken, 10);
      const tokenId = createAccessToken(hash, appUser.id, 'full', 'Master Token (OAuth Session)', null, null);
      req.session.masterTokenRaw = rawMasterToken;
      req.session.masterTokenId = tokenId;

      // NOW store the OAuth token under the correct user ID
      console.log(`[OAuth] Storing ${service} token for user: ${appUser.id}`);
      const storeResult = storeOAuthToken(service, appUser.id, tokenData.accessToken, tokenData.refreshToken || null, expiresAt, tokenData.scope);
      console.log(`[OAuth] Token stored successfully:`, { tokenId: storeResult.id, service, userId: appUser.id, scope: storeResult.scope });
    }

    // For service-connect-only mode (not login), store token using current session user
    if (req.session.user && stateMeta.mode !== 'login') {
      // This handles the case where it's not login mode but user is already authenticated
      console.log(`[OAuth] Storing ${service} token for existing session user: ${req.session.user.id}`);
      const storeResult = storeOAuthToken(service, req.session.user.id, tokenData.accessToken, tokenData.refreshToken || null, expiresAt, tokenData.scope);
      console.log(`[OAuth] Token stored successfully:`, { tokenId: storeResult.id, service, userId: req.session.user.id, scope: storeResult.scope });
    }

    if (req.session.user) {
      const ws = getWorkspaces(req.session.user.id);
      if (ws?.length) {
        incrementUsageDaily(ws[0].id, new Date().toISOString().slice(0, 10), {
          active_services: countConnectedOAuthServices(req.session.user.id),
        });
      }
    }

    // Emit notification for service connection
    if (req.session.user) {
      NotificationService.emitNotification(req.session.user.id, 'service_connected',
        `${service.charAt(0).toUpperCase() + service.slice(1)} Connected`,
        `Your ${service} account has been successfully connected to MyApi`,
        { relatedEntityType: 'service', relatedEntityId: service, actionUrl: '/dashboard/services' }
      ).catch(err => console.error('Notification error:', err));
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
    const masterToken = req.session.masterTokenRaw || 'myapi_' + crypto.randomBytes(32).toString("hex");
    
    // Set master token as a persistent cookie so the dashboard can use it
    res.cookie('myapi_master_token', masterToken, {
      httpOnly: false, // Allow JS to read it
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax'
    });
    
    // Also set user info for quick access (use session.user which is already set)
    if (req.session.user) {
      res.cookie('myapi_user', JSON.stringify(req.session.user), {
        httpOnly: false,
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
    res.redirect(`/dashboard/?oauth_service=${service}&oauth_status=error&error=${encodeURIComponent(error.message)}`);
  }
});

// GET /api/v1/oauth/status — Get all connected services (PUBLIC - no auth required)
app.get("/api/v1/oauth/status", (req, res) => {
  const statuses = getOAuthStatus();
  
  // Get user ID for token lookup
  const userId = req.session?.user?.id ? String(req.session.user.id) : (req.tokenMeta?.ownerId ? String(req.tokenMeta.ownerId) : null);
  
  const services = OAUTH_SERVICES.map(service => {
    const status = statuses.find(s => s.serviceName === service);
    
    // Check if user has an active token for this service (with error handling)
    let token = null;
    if (userId) {
      try {
        token = getOAuthToken(service, userId);
      } catch (err) {
        // Log decryption errors but don't crash
        console.warn(`[OAuth Status] Failed to decrypt token for ${service}:`, err.message);
        token = null;
      }
    }
    
    // Status is "connected" if user has a non-revoked token, otherwise based on global status
    const connectionStatus = token && !token.revoked_at ? "connected" : (status?.status || "disconnected");
    
    return {
      name: service,
      status: connectionStatus,
      lastSync: status?.lastSyncedAt || null,
      lastApiCall: token?.lastApiCall || null,  // Phase 5.4: Last API call timestamp
      scope: token?.scope || null,
      enabled: isOAuthServiceEnabled(service)
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

// POST /api/v1/oauth/disconnect/:service — Revoke OAuth connection
app.post("/api/v1/oauth/disconnect/:service", authenticate, async (req, res) => {
  const { service } = req.params;
  
  // Validate service
  if (!OAUTH_SERVICES.includes(service)) {
    return res.status(400).json({ error: "Invalid OAuth service" });
  }
  
  try {
    const userId = getOAuthUserId(req);
    const token = getOAuthToken(service, userId);
    
    if (!token) {
      return res.status(404).json({ error: "No token found for this service" });
    }
    
    // Revoke token on remote service
    const adapter = oauthAdapters[service];
    await adapter.revokeToken(token.accessToken);
    
    // Delete token from database
    revokeOAuthToken(service, userId);
    
    // Update OAuth status
    updateOAuthStatus(service, "disconnected");

    const ws = getWorkspaces(userId);
    if (ws?.length) {
      incrementUsageDaily(ws[0].id, new Date().toISOString().slice(0, 10), {
        active_services: countConnectedOAuthServices(userId),
      });
    }

    // Log disconnection
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: "oauth_disconnect",
      resource: `/oauth/disconnect/${service}`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { service }
    });
    
    res.json({ ok: true, message: `Successfully disconnected ${service}` });
  } catch (error) {
    console.error(`OAuth disconnect error for ${service}:`, error.message);
    
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: "oauth_disconnect_error",
      resource: `/oauth/disconnect/${service}`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { service, error: error.message }
    });
    
    res.status(500).json({ error: "Failed to disconnect OAuth service", message: error.message });
  }
});

// GET /api/v1/oauth/test/:service — Test token validity
app.get("/api/v1/oauth/test/:service", authenticate, async (req, res) => {
  const { service } = req.params;
  
  // Validate service
  if (!OAUTH_SERVICES.includes(service)) {
    return res.status(400).json({ error: "Invalid OAuth service" });
  }
  
  try {
    const userId = getOAuthUserId(req);
    const token = getOAuthToken(service, userId);
    
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

// POST /api/v1/keys/rotate — Rotate encryption keys for OAuth tokens
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

// GET /api/v1/keys/status — Check encryption key status
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

// Test service connection
app.get('/api/v1/services/:serviceName/test', authenticate, async (req, res) => {
  try {
    const { serviceName } = req.params;
    const { getServiceByName } = require('./database');
    const service = getServiceByName(serviceName);
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // Simple health check - can be expanded for each service
    const testResult = {
      service: serviceName,
      status: 'available',
      apiEndpoint: service.api_endpoint,
      authType: service.auth_type,
      documentationUrl: service.documentation_url,
      timestamp: new Date().toISOString(),
      message: `✅ Service is available and ready to integrate. Use the documentation link to set up authentication.`
    };
    
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
    let token = getOAuthToken(serviceName, userId);
    const authType = service.auth_type || service.authType;
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

// POST /api/v1/services/:serviceName/proxy — Direct API proxy (pass-through to service API)
// Allows AI agents to call any endpoint on a connected service without predefined methods
app.post('/api/v1/services/:serviceName/proxy', authenticate, async (req, res) => {
  try {
    const { serviceName } = req.params;
    const { path: apiPath, method: httpMethod = 'GET', body: reqBody, query: queryParams } = req.body;

    if (!apiPath) {
      return res.status(400).json({ error: 'path is required (e.g. "/user/repos")' });
    }

    // Service scope enforcement
    const { checkScopes } = require('./middleware/scope-validator');
    const rawScope = req.tokenMeta?.scope || req.tokenData?.scope || '';
    const tokenScopes = rawScope === 'full' ? ['admin:*'] : rawScope.split(',').map(s => s.trim()).filter(Boolean);
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes((httpMethod || 'GET').toUpperCase());
    const requiredScopes = [
      `services:${serviceName}:${isWrite ? 'write' : 'read'}`,  // specific: services:github:read
      `services:${serviceName}`,                                   // service-level: services:github
      'services:*',                                                // wildcard
      `services:${isWrite ? 'write' : 'read'}`,                  // generic: services:read
    ];
    const hasScope = tokenScopes.includes('admin:*') || requiredScopes.some(s => tokenScopes.includes(s));
    if (!hasScope) {
      return res.status(403).json({
        error: 'Insufficient scope',
        message: `Token needs one of: ${requiredScopes.join(', ')}`,
        hint: 'Update token scope to include service access'
      });
    }

    const { getOAuthToken, isTokenExpired, refreshOAuthToken } = require('./database');
    const userId = getOAuthUserId(req);
    let token = getOAuthToken(serviceName, userId);

    if (!token) {
      return res.status(403).json({ error: `Service '${serviceName}' not connected. Please connect it first via /api/v1/oauth/authorize/${serviceName}` });
    }

    // Auto-refresh if expired
    if (isTokenExpired(token)) {
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
    const apiRoot = provider?.apiRoot;
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
      headers['Authorization'] = serviceName === 'github' ? `token ${token.accessToken}` : `Bearer ${token.accessToken}`;
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

    res.status(result.statusCode >= 400 ? result.statusCode : 200).json({
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
    });
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
    const relevantDocs = knowledgeBase.queryKnowledgeBase(message, 3, getRequestOwnerId(req));

    // Add persona-scoped docs + skills package when persona scope is active
    let personaDocs = [];
    let personaSkillPackages = [];
    if (personaScope.personaId !== null && personaScope.personaId !== undefined) {
      const ownerId = getRequestOwnerId(req);
      personaDocs = getPersonaDocumentContents(personaScope.personaId, ownerId);
      personaSkillPackages = Object.values(getPersonaSkillPackages(personaScope.personaId, ownerId));
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
  try {
    const { source, title, content } = req.body;

    if (!source || !title || !content) {
      return res.status(400).json({ error: 'source, title, and content are required' });
    }

    const currentBytes = getKnowledgeBaseBytesUsed(req);
    const incomingBytes = Buffer.byteLength(String(content || ''), 'utf8');
    const kbLimitErr = enforcePlanLimit(req, 'knowledgeBytes', currentBytes, incomingBytes);
    if (kbLimitErr) return res.status(403).json(kbLimitErr);

    const docs = await knowledgeBase.addDocument(source, title, content, getRequestOwnerId(req));

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
      tokensProcessed: content.split(/\s+/).length,
      documentsCreated: docs.length
    });
  } catch (error) {
    console.error('Add KB document error:', error);
    res.status(500).json({ error: 'Failed to add document' });
  }
});

// POST /api/v1/brain/knowledge-base/upload - Upload and ingest document
app.post('/api/v1/brain/knowledge-base/upload', authenticate, kbUploadFields, async (req, res) => {
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
  try {
    const ownerId = getRequestOwnerId(req);
    const documents = getKBDocuments(ownerId);

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
  try {
    const { id } = req.params;
    const ownerId = getRequestOwnerId(req);
    const doc = getKBDocumentById(id, ownerId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

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

// GET /api/v1/brain/context - Get current assembled context
app.get('/api/v1/brain/context', authenticate, async (req, res) => {
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
  try {
    const ownerId = getRequestOwnerId(req);
    const skills = getSkills(ownerId);
    res.json({ data: skills });
  } catch (err) {
    console.error('Skills list error:', err);
    res.status(500).json({ error: 'Failed to get skills' });
  }
});

app.get('/api/v1/skills/:id', authenticate, (req, res) => {
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
  try {
    const ownerId = getRequestOwnerId(req);
    const result = deleteSkill(req.params.id, ownerId);
    if (!result) return res.status(404).json({ error: 'Skill not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Skill delete error:', err);
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

app.put('/api/v1/skills/:id/activate', authenticate, (req, res) => {
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
  try {
    const listingId = parseInt(req.params.id, 10);
    if (!Number.isFinite(listingId)) {
      return res.status(400).json({ error: 'Invalid listing id' });
    }

    const listing = getMarketplaceListing(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    let provisioned = null;

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
        const result = db.prepare(`
          INSERT INTO services (name, label, category_id, icon, description, auth_type, api_endpoint, documentation_url, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).run(
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
        service = db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid);
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

      // Get the current user's ID (owner) from token metadata
      const ownerId = req.tokenMeta.ownerId || req.tokenMeta.userId || 'owner';

      // Idempotency by marketplace listing id for skill installs
      const existingSkill = getSkills(ownerId).find((s) => {
        const cfg = s.config_json && typeof s.config_json === 'object' ? s.config_json : null;
        return String(cfg?.marketplace_listing_id || '') === String(listing.id);
      });

      if (existingSkill) {
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

        provisioned = {
          type: 'skill',
          skillId: newSkill.id,
          skillName: newSkill.name,
          skillVersion: newSkill.version,
          skillCategory: newSkill.category,
        };
      }
    }

    const alreadyInstalled = !!(provisioned && provisioned.alreadyInstalled);
    if (!alreadyInstalled) {
      incrementInstallCount(listingId);
      trackWorkspaceUsage(req, { installs: 1 });
    }
    trackWorkspaceUsage(req, { active_services: countConnectedOAuthServices(req.tokenMeta.ownerId) });
    const updated = getMarketplaceListing(listingId);

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'marketplace_install',
      resource: `/api/v1/marketplace/${listingId}/install`,
      scope: req.tokenMeta.scope,
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

// --- Serve React app for all /dashboard routes ---
const sendDashboardIndex = (req, res) => {
  // Prevent stale SPA shell on mobile browsers after deploys
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'dist', 'index.html'));
};

app.get('/dashboard', sendDashboardIndex);
app.get('/dashboard/', sendDashboardIndex);
app.get('/dashboard/*', (req, res) => {
  const relPath = req.path.replace(/^\/dashboard\/?/, '');
  const looksLikeStaticAsset = relPath.startsWith('assets/') || relPath === 'vite.svg' || /\.[a-z0-9]+$/i.test(relPath);

  if (looksLikeStaticAsset) {
    return res.status(404).send('Asset not found');
  }

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
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    
    let userId = null;
    let isAuthenticated = false;

    // Handle WebSocket messages
    ws.on('message', (message) => {
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
      console.log('WebSocket connection closed');
    });

    // Handle WebSocket errors
    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

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

// --- Error Handlers (must be last) ---

// 404 handler - return JSON
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

// --- Start ---
if (process.env.NODE_ENV !== 'test') {
  bootstrap();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server ready on http://0.0.0.0:${PORT}`);
    if (WebSocketServer) {
      console.log(`WebSocket ready on ws://0.0.0.0:${PORT}`);
    }
  });
}

module.exports = { app, server, bootstrap };
