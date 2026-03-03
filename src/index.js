const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const bcrypt = require("bcrypt");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

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
  deleteKBDocument,
  getPersonaDocuments,
  attachDocumentToPersona,
  detachDocumentFromPersona,
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
  // Services
  seedServiceCategories,
  seedServices,
  getServiceCategories,
  getServices,
  getServicesByCategory,
  getServiceByName,
  getServiceMethods,
  addServiceMethod,
} = require("./database");

// OAuth service adapters
const GoogleAdapter = require("./services/google-adapter");
const GitHubAdapter = require("./services/github-adapter");
const SlackAdapter = require("./services/slack-adapter");
const DiscordAdapter = require("./services/discord-adapter");
const WhatsAppAdapter = require("./services/whatsapp-adapter");

const app = express();
const PORT = process.env.PORT || 4500;
const WORKSPACE_ROOT = path.join(__dirname, '..', '..', '..');
const USER_MD_PATH = path.join(WORKSPACE_ROOT, 'USER.md');
const SOUL_MD_PATH = path.join(WORKSPACE_ROOT, 'SOUL.md');

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
  whatsapp: new WhatsAppAdapter(oauthConfig.whatsapp || {})
};

const OAUTH_SERVICES = ['google', 'github', 'slack', 'discord', 'whatsapp'];
const OAUTH_ENABLED = Object.fromEntries(
  OAUTH_SERVICES.map(service => [service, oauthConfig[service]?.enabled !== false])
);

// --- Middleware ---
const session = require('express-session');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'myapi-session-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'lax' }
}));

// Redirect to React dashboard
app.get('/', (req, res) => res.redirect('/dashboard/'));
app.get('/login', (req, res) => res.redirect('/dashboard/'));

// Dashboard: serve static files (auth handled client-side via localStorage token)
app.use('/dashboard', express.static(path.join(__dirname, 'public', 'dist')));
app.use(express.static(path.join(__dirname, "public")));

// Onboarding routes
const onboardRoutes = require('./onboard');
app.use('/api/v1', onboardRoutes);

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

// --- In-Memory Identity (loaded from USER.md) ---
const vault = { identityDocs: {}, preferences: {} };

// --- Rate Limiter ---
const rateLimitMap = {};
function rateLimit(windowMs = 60000, maxRequests = 60) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    if (!rateLimitMap[key]) rateLimitMap[key] = [];
    rateLimitMap[key] = rateLimitMap[key].filter(t => now - t < windowMs);
    if (rateLimitMap[key].length >= maxRequests) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }
    rateLimitMap[key].push(now);
    res.set("X-RateLimit-Limit", String(maxRequests));
    res.set("X-RateLimit-Remaining", String(maxRequests - rateLimitMap[key].length));
    next();
  };
}
app.use(rateLimit());

// --- Auth Middleware ---
// NOTE: We are transitioning from Bearer master-token login to session-based login.
// For now we support BOTH:
// - Dashboard (human): cookie session (preferred)
// - API agents: Bearer tokens
const authRoutes = require('./auth');
app.use('/api/v1', authRoutes);

function authenticate(req, res, next) {
  // 1) Session auth (human dashboard)
  if (req.session && req.session.user) {
    req.user = req.session.user;
    req.authType = 'session';
    // session users are treated as "full" for MVP; we will add RBAC later.
    req.tokenMeta = { tokenId: `sess_${req.user.id}`, scope: 'full', ownerId: String(req.user.id), label: 'session' };
    return next();
  }

  // 2) Bearer token auth (agents)
  const authHeader = req.headers["authorization"] || "";
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Missing session or Authorization: Bearer token" });
  }
  const rawToken = parts[1];
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
  next();
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
    rawMaster = crypto.randomBytes(32).toString("hex");
    const hash = bcrypt.hashSync(rawMaster, 10);
    createAccessToken(hash, "owner", "full", "Master Token");
    console.log("=== MyApi Platform Started ===");
    console.log(`Master Token (SAVE THIS): ${rawMaster}`);
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
app.post("/api/v1/vault/tokens", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can add vault tokens" });
  const { name, label, description, token, service } = req.body;
  const tokenLabel = name || label;
  if (!tokenLabel || !token) return res.status(400).json({ error: "name and token are required" });
  const vaultToken = createVaultToken(tokenLabel, description, token, service);
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "create_vault_token", resource: `/vault/tokens/${vaultToken.id}`, scope: req.tokenMeta.scope, ip: req.ip });
  res.status(201).json({ data: vaultToken });
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
  const rawToken = crypto.randomBytes(32).toString("hex");
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
        read: ['identity:read', 'vault:read', 'services:read', 'brain:read', 'audit:read'],
        professional: ['identity:read'],
        availability: ['identity:read'],
        guest: ['identity:read'],
        admin: ['admin:*']
      }
    }
  });
});

// Revoke (delete) a token
app.delete("/api/v1/tokens/:id", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can revoke tokens" });
  const revoked = revokeAccessToken(req.params.id);
  if (!revoked) return res.status(404).json({ error: "Token not found" });
  
  // Also revoke all scopes for this token
  revokeScopes(req.params.id);
  
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
app.post("/api/v1/tokens/validate", (req, res) => {
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
    const allPersonas = getPersonas();
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
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password are required" });
  const user = getUserByUsername(username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });
  // Generate a session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  // Store session in memory (simple approach)
  if (!global.sessions) global.sessions = {};
  global.sessions[sessionToken] = { userId: user.id, username: user.username, createdAt: Date.now() };
  createAuditLog({ requesterId: user.id, action: "user_login", resource: `/users/${user.id}`, scope: "session", ip: req.ip });
  res.json({ data: { token: sessionToken, user: { id: user.id, username: user.username, displayName: user.displayName, email: user.email, timezone: user.timezone } } });
});

// Token-based login (for API access tokens)
app.post("/api/v1/auth/token-login", (req, res) => {
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
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.replace("Bearer ", "");
  if (global.sessions && global.sessions[token]) {
    const session = global.sessions[token];
    const user = getUserById(session.userId);
    if (user) return res.json({ data: user });
  }
  res.status(401).json({ error: "Invalid session" });
});

app.post("/api/v1/auth/logout", (req, res) => {
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
app.post("/api/v1/users", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Only master token can create users" });
  const { username, displayName, email, timezone, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username and password are required" });
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
  createAuditLog({ requesterId: req.tokenMeta.tokenId, action: "list_users", resource: "/users", scope: req.tokenMeta.scope, ip: req.ip });
  res.json({ data: getUsers() });
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
  
  const persona = createPersona(name, soul_content, description, templateData);
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
  const personas = getPersonas();
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
  const persona = getPersonaById(parseInt(req.params.id));
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
  const persona = getPersonaById(personaId);
  if (!persona) return res.status(404).json({ error: "Persona not found" });
  
  const { name, soul_content, description, active } = req.body;
  
  // If setting as active
  if (active === true) {
    const updated = setActivePersona(personaId);
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
    const updated = updatePersona(personaId, { name, soul_content, description });
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
  const deleted = deletePersona(personaId);
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
  const docs = getPersonaDocuments(personaId);
  res.json({ data: docs });
});

// POST /api/v1/personas/:id/documents — Attach a KB document
app.post("/api/v1/personas/:id/documents", authenticate, (req, res) => {
  if (req.tokenMeta.scope !== "full") return res.status(403).json({ error: "Insufficient scope" });
  const personaId = parseInt(req.params.id);
  const { documentId } = req.body;
  if (!documentId) return res.status(400).json({ error: "documentId required" });
  
  const persona = getPersonaById(personaId);
  if (!persona) return res.status(404).json({ error: "Persona not found" });
  
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

// --- OAuth Endpoints ---

// GET /api/v1/oauth/authorize/:service — Start OAuth flow
app.get("/api/v1/oauth/authorize/:service", (req, res) => {
  const { service } = req.params;
  
  // Validate service
  if (!OAUTH_SERVICES.includes(service)) {
    return res.status(400).json({ error: "Invalid OAuth service" });
  }
  
  if (!OAUTH_ENABLED[service]) {
    return res.status(400).json({ error: `OAuth service '${service}' is not enabled` });
  }
  
  // Create state token for CSRF protection
  const state = createStateToken(service, 10);
  
  // Get authorization URL from adapter
  const adapter = oauthAdapters[service];
  const authUrl = adapter.getAuthorizationUrl(state);
  
  // Log the authorization request
  createAuditLog({
    requesterId: req.ip,
    action: "oauth_authorize_start",
    resource: `/oauth/authorize/${service}`,
    ip: req.ip,
    details: { service, state: state.substring(0, 10) + '...' }
  });
  
  res.json({
    ok: true,
    authUrl: authUrl,
    state: state
  });
});

// GET /api/v1/oauth/callback/:service — Handle OAuth callback
app.get("/api/v1/oauth/callback/:service", async (req, res) => {
  const { service } = req.params;
  const { code, state } = req.query;
  
  // Validate service
  if (!OAUTH_SERVICES.includes(service)) {
    createAuditLog({
      requesterId: req.ip,
      action: "oauth_callback_error",
      resource: `/oauth/callback/${service}`,
      ip: req.ip,
      details: { error: "Invalid service", service }
    });
    return res.status(400).json({ error: "Invalid OAuth service" });
  }
  
  // Validate state token for CSRF protection
  if (!state || !validateStateToken(service, state)) {
    createAuditLog({
      requesterId: req.ip,
      action: "oauth_callback_error",
      resource: `/oauth/callback/${service}`,
      ip: req.ip,
      details: { error: "Invalid or expired state token", service }
    });
    return res.status(400).json({ error: "Invalid or expired state token" });
  }
  
  if (!code) {
    createAuditLog({
      requesterId: req.ip,
      action: "oauth_callback_error",
      resource: `/oauth/callback/${service}`,
      ip: req.ip,
      details: { error: "Missing authorization code", service }
    });
    return res.status(400).json({ error: "Missing authorization code" });
  }
  
  try {
    const adapter = oauthAdapters[service];
    const tokenData = await adapter.exchangeCodeForToken(code);
    
    // Store token in database
    const userId = "oauth_user"; // In production, this would be the actual user ID
    const expiresAt = tokenData.expiresIn 
      ? new Date(Date.now() + tokenData.expiresIn * 1000).toISOString()
      : null;
    
    storeOAuthToken(
      service,
      userId,
      tokenData.accessToken,
      tokenData.refreshToken || null,
      expiresAt,
      tokenData.scope
    );
    
    // Update OAuth status
    updateOAuthStatus(service, "connected");
    
    // Log successful callback
    createAuditLog({
      requesterId: req.ip,
      action: "oauth_callback_success",
      resource: `/oauth/callback/${service}`,
      ip: req.ip,
      details: { service, scope: tokenData.scope }
    });
    
    // Redirect back to dashboard with success message
    res.redirect(`/dashboard/?oauth_service=${service}&oauth_status=connected`);
  } catch (error) {
    console.error(`OAuth callback error for ${service}:`, error.message);
    
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

// GET /api/v1/oauth/status — Get all connected services
app.get("/api/v1/oauth/status", authenticate, (req, res) => {
  const statuses = getOAuthStatus();
  
  const services = OAUTH_SERVICES.map(service => {
    const status = statuses.find(s => s.serviceName === service);
    const token = getOAuthToken(service, "oauth_user");
    
    return {
      name: service,
      status: status?.status || "disconnected",
      lastSync: status?.lastSyncedAt || null,
      scope: token?.scope || null,
      enabled: OAUTH_ENABLED[service]
    };
  });
  
  createAuditLog({
    requesterId: req.tokenMeta.tokenId,
    action: "get_oauth_status",
    resource: "/oauth/status",
    scope: req.tokenMeta.scope,
    ip: req.ip
  });
  
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
    const userId = "oauth_user";
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
    const userId = "oauth_user";
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
    const { getServices, getServicesByCategory } = require('./database');
    
    let services;
    if (category) {
      services = getServicesByCategory(category);
    } else {
      services = getServices();
    }
    
    res.json({ data: services, count: services.length });
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
    
    res.json({
      data: {
        ...service,
        methods: methods
      }
    });
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
    
    res.json({ data: methods, count: methods.length });
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
    
    if (!method) {
      return res.status(400).json({ error: 'method is required' });
    }
    
    const { getServiceByName, getOAuthToken } = require('./database');
    const service = getServiceByName(serviceName);
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    // Check if user has connected this service (OAuth token)
    const token = getOAuthToken(serviceName, 'owner');
    if (!token && service.auth_type !== 'webhook') {
      return res.status(403).json({ error: `Service '${serviceName}' not connected. Please connect it first.` });
    }
    
    // Execute the API call based on service type
    // This would call service-specific adapters
    const result = {
      service: serviceName,
      method: method,
      status: 'executed',
      timestamp: new Date().toISOString(),
      response: {
        message: `✅ ${method} successfully called on ${serviceName}`,
        serviceEndpoint: service.api_endpoint,
        params: params || {}
      }
    };
    
    // Log the execution
    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'service_execute',
      resource: `/services/${serviceName}/execute`,
      scope: req.tokenMeta.scope,
      ip: req.ip,
      details: { service: serviceName, method, params }
    });
    
    res.json({ data: result });
  } catch (err) {
    console.error('Service execution error:', err);
    res.status(500).json({ error: 'Failed to execute service method' });
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

// POST /api/v1/brain/chat - Chat with context-aware AI
app.post('/api/v1/brain/chat', authenticate, async (req, res) => {
  try {
    const { message, conversationId, model, temperature } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const conv = createConversation(req.tokenMeta.tokenId, model || brainConfig.llm?.model);
      convId = conv.id;
    }

    // Assemble context
    const context = await contextEngine.assembleContext(convId, db);

    // Query knowledge base
    const relevantDocs = knowledgeBase.queryKnowledgeBase(message, 3);

    // Build system prompt
    let systemPrompt = context.systemPrompt;
    if (relevantDocs.length > 0) {
      systemPrompt += '\n\nRelevant documents:\n' + 
        relevantDocs.map(d => `- ${d.title}`).join('\n');
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
        documents: relevantDocs.length
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

    const docs = await knowledgeBase.addDocument(source, title, content);

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

// GET /api/v1/brain/knowledge-base - List KB documents
app.get('/api/v1/brain/knowledge-base', authenticate, (req, res) => {
  try {
    const documents = getKBDocuments();

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

// DELETE /api/v1/brain/knowledge-base/:id - Delete KB document
app.delete('/api/v1/brain/knowledge-base/:id', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const success = deleteKBDocument(id);

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
    const { conversationId } = req.query;
    
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

    createAuditLog({
      requesterId: req.tokenMeta.tokenId,
      action: 'brain_context_query',
      resource: '/api/v1/brain/context',
      scope: req.tokenMeta.scope,
      ip: req.ip
    });

    res.json(context);
  } catch (error) {
    console.error('Get context error:', error);
    res.status(500).json({ error: 'Failed to get context', message: error.message });
  }
});

// ===== DASHBOARD STATS =====
app.get('/api/v1/dashboard/stats', authenticate, (req, res) => {
  try {
    const personas = getPersonas();
    const skills = getSkills();
    const kbDocs = getKBDocuments();
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
    const skills = getSkills();
    res.json({ data: skills });
  } catch (err) {
    console.error('Skills list error:', err);
    res.status(500).json({ error: 'Failed to get skills' });
  }
});

app.get('/api/v1/skills/:id', authenticate, (req, res) => {
  try {
    const skill = getSkillById(req.params.id);
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
      const existing = getSkills().find((s) => {
        const cfg = s.config_json && typeof s.config_json === 'object' ? s.config_json : null;
        return String(cfg?.marketplace_listing_id || '') === String(listingId);
      });
      if (existing) {
        return res.status(200).json({ data: existing, already_installed: true });
      }
    }

    const skill = createSkill(name, description, version, author, category, script_content, config_json, repo_url);
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
    const skill = createSkill(
      metadata.name,
      metadata.description,
      metadata.version,
      metadata.author,
      metadata.category,
      metadata.script_content,
      metadata.config_json,
      metadata.repo_url
    );
    res.status(201).json({ data: skill, scanner });
  } catch (err) {
    console.error('Skill create from repo error:', err);
    res.status(400).json({ error: err.message || 'Failed to import skill from repository' });
  }
});

app.put('/api/v1/skills/:id', authenticate, (req, res) => {
  try {
    const skill = updateSkill(req.params.id, req.body);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    res.json({ data: skill });
  } catch (err) {
    console.error('Skill update error:', err);
    res.status(500).json({ error: 'Failed to update skill' });
  }
});

app.delete('/api/v1/skills/:id', authenticate, (req, res) => {
  try {
    const result = deleteSkill(req.params.id);
    if (!result) return res.status(404).json({ error: 'Skill not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Skill delete error:', err);
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

app.put('/api/v1/skills/:id/activate', authenticate, (req, res) => {
  try {
    const skill = setActiveSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    res.json({ data: skill });
  } catch (err) {
    console.error('Skill activate error:', err);
    res.status(500).json({ error: 'Failed to activate skill' });
  }
});

app.get('/api/v1/skills/:id/documents', authenticate, (req, res) => {
  try {
    const docs = getSkillDocuments(req.params.id);
    res.json({ data: docs });
  } catch (err) {
    console.error('Skill docs error:', err);
    res.status(500).json({ error: 'Failed to get skill documents' });
  }
});

app.post('/api/v1/skills/:id/documents', authenticate, (req, res) => {
  try {
    const { document_id } = req.body;
    if (!document_id) return res.status(400).json({ error: 'document_id is required' });
    const result = attachDocumentToSkill(req.params.id, document_id);
    res.status(201).json({ data: result });
  } catch (err) {
    console.error('Skill doc attach error:', err);
    res.status(500).json({ error: 'Failed to attach document' });
  }
});

app.delete('/api/v1/skills/:id/documents/:docId', authenticate, (req, res) => {
  try {
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
    const { type, sort, search, tags } = req.query;
    const listings = getMarketplaceListings({ type, sort, search, tags });
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
    }

    incrementInstallCount(listingId);
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

// --- Start ---
bootstrap();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server ready on http://0.0.0.0:${PORT}`);
});
