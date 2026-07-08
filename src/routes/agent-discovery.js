/**
 * Agent discovery surface — machine-readable metadata that lets AI agents find,
 * authenticate with, and pay for the MyApi API without human help.
 *
 * Serves (all public, no auth):
 *   /.well-known/api-catalog                 RFC 9727 linkset
 *   /.well-known/oauth-authorization-server  RFC 8414 (+ auth.md agent_auth block)
 *   /.well-known/oauth-protected-resource    RFC 9728
 *   /auth.md                                 agent registration instructions
 *   /.well-known/acp.json                    Agentic Commerce Protocol discovery
 *   /.well-known/ucp                         Universal Commerce Protocol profile
 *   /.well-known/mcp/server-card.json        MCP Server Card (SEP-1649)
 *   /.well-known/agent-skills/index.json     Agent Skills Discovery RFC v0.2.0
 *   /.well-known/agent-skills/:name/SKILL.md skill bodies
 *
 * Plus two cross-cutting middlewares (mounted before the `/` route in index.js):
 *   - RFC 8288 Link headers on every response (incl. homepage)
 *   - Markdown for Agents: Accept: text/markdown on `/` returns markdown
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const CANONICAL_HOST = 'www.myapiai.com';
const origin = (req) => `https://${req.headers.host || CANONICAL_HOST}`;

const CACHE_HEADER = 'public, max-age=3600';

// ---------------------------------------------------------------------------
// Link headers (RFC 8288) — registered before the `/` handler so the homepage
// response carries them too (the previous middleware ran after `/` and missed it).
router.use((req, res, next) => {
  const o = origin(req);
  res.set('Link', [
    `<${o}/openapi.json>; rel="service-desc"`,
    `<${o}/api/v1/>; rel="api"`,
    `<${o}/api/v1/quick-start>; rel="help"`,
    `<${o}/.well-known/api-catalog>; rel="api-catalog"`,
    `<${o}/platform-docs>; rel="service-doc"`,
  ].join(', '));
  res.set('X-API-Docs', '/openapi.json');
  res.set('X-API-Root', '/api/v1/');
  next();
});

// ---------------------------------------------------------------------------
// Markdown for Agents — Accept: text/markdown on the homepage returns a markdown
// rendition instead of HTML/JSON. Browsers never send this Accept value.
router.use((req, res, next) => {
  if (req.path !== '/' || req.method !== 'GET') return next();
  const accept = String(req.headers.accept || '');
  if (!/\btext\/markdown\b/i.test(accept)) return next();
  const o = origin(req);
  const md = `# MyApi — Personal API Platform

One API for your whole digital life. Connect 100+ services (Gmail, GitHub, Slack,
Home Assistant, …) once, then let your AI agents act through a single gateway with
per-agent scopes, usage limits, and a full audit log.

## For agents

- API root: ${o}/api/v1/
- OpenAPI spec: ${o}/openapi.json
- Quick start: ${o}/api/v1/quick-start
- Authentication guide: ${o}/auth.md
- API catalog: ${o}/.well-known/api-catalog
- Agent skills: ${o}/.well-known/agent-skills/index.json
- MCP server card: ${o}/.well-known/mcp/server-card.json
- llms.txt: ${o}/llms.txt

## Authentication

Send \`Authorization: Bearer <token>\`. Obtain tokens via the OAuth 2.0
authorization-code flow (see ${o}/.well-known/oauth-authorization-server) or from
the dashboard at ${o}/dashboard/.

Before performing any action on a user's behalf, ask the human for explicit approval.
`;
  res.set('Content-Type', 'text/markdown; charset=utf-8');
  res.set('x-markdown-tokens', String(Math.ceil(md.length / 4)));
  res.set('Vary', 'Accept');
  return res.send(md);
});

// ---------------------------------------------------------------------------
// RFC 9727 API catalog
router.get('/.well-known/api-catalog', (req, res) => {
  const o = origin(req);
  res.set('Cache-Control', CACHE_HEADER);
  res.type('application/linkset+json').json({
    linkset: [
      {
        anchor: `${o}/api/v1/`,
        'service-desc': [{ href: `${o}/openapi.json`, type: 'application/json' }],
        'service-doc': [
          { href: `${o}/platform-docs`, type: 'text/html' },
          { href: `${o}/llms.txt`, type: 'text/plain' },
        ],
        'service-meta': [{ href: `${o}/.well-known/oauth-protected-resource`, type: 'application/json' }],
        status: [{ href: `${o}/api/v1/health` }],
      },
    ],
  });
});

// ---------------------------------------------------------------------------
// OAuth discovery
const SCOPES_SUPPORTED = [
  'full',
  'services:read',
  'services:write',
  'brain:read',
  'brain:write',
  'identity:read',
];

// RFC 8414 authorization-server metadata + auth.md agent_auth extension
router.get('/.well-known/oauth-authorization-server', (req, res) => {
  const o = origin(req);
  res.set('Cache-Control', CACHE_HEADER);
  res.json({
    issuer: o,
    authorization_endpoint: `${o}/api/v1/oauth-server/authorize`,
    token_endpoint: `${o}/api/v1/oauth-server/token`,
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: SCOPES_SUPPORTED,
    service_documentation: `${o}/platform-docs`,
    // auth.md (https://workos.com/auth-md) agent registration block
    agent_auth: {
      skill: `${o}/auth.md`,
      instructions_uri: `${o}/auth.md`,
      register_uri: `${o}/signup`,
      registration_methods: ['oauth2_authorization_code', 'dashboard_token', 'asc_device_key'],
      // Anonymous flow (auth.md spec): the agent registers an Ed25519 keypair,
      // then the account owner claims/approves the device at claim_uri.
      identity_types_supported: ['anonymous', 'user_delegated', 'agent'],
      anonymous: { credential_types_supported: ['ed25519_keypair', 'bearer_token'] },
      credential_types_supported: ['oauth2_authorization_code', 'bearer_token', 'ed25519_keypair'],
      claim_uri: `${o}/dashboard/devices`,
      revocation_uri: `${o}/dashboard/tokens`,
    },
  });
});

// RFC 9728 protected-resource metadata
router.get('/.well-known/oauth-protected-resource', (req, res) => {
  const o = origin(req);
  res.set('Cache-Control', CACHE_HEADER);
  res.json({
    resource: `${o}/api/v1/`,
    authorization_servers: [o],
    scopes_supported: SCOPES_SUPPORTED,
    bearer_methods_supported: ['header'],
    resource_name: 'MyApi API Gateway',
    resource_documentation: `${o}/openapi.json`,
  });
});

// auth.md — human/agent-readable registration instructions
router.get('/auth.md', (req, res) => {
  const o = origin(req);
  const md = `# auth.md — Authenticating with MyApi

MyApi is a personal API gateway. Agents authenticate with a Bearer token and act
within the scopes and usage limits the account owner grants.

## Agent registration

To register as an agent:

1. **Register an account** (or have the account owner invite you):
   \`${o}/signup\` (register_uri). Human owners register agents on their behalf.
2. **Choose a registration method / credential type:**
   - **OAuth 2.0 client registration (recommended for AI clients):**
     authorization-code flow with PKCE (S256). Discovery metadata:
     \`${o}/.well-known/oauth-authorization-server\`. The user approves your
     client on a consent screen; you receive an access token plus a refresh token.
   - **Bearer token:** the account owner registers your agent by creating a scoped
     token at \`${o}/dashboard/tokens\` and giving it to you.
   - **Ed25519 device keypair (MCP):** run \`npx myapi-asc-mcp\`. It registers an
     Ed25519 keypair against the account as a device credential.
3. **Claim the registration:** device registrations wait in an approval queue; the
   owner claims/approves them at \`${o}/dashboard/devices\` (claim URL). Until
   approved, calls return 403.

**Supported identity types:** \`user_delegated\` (agent acts for a human user) and
\`agent\` (device-bound agent identity).
**Supported credential types:** \`oauth2_authorization_code\`, \`bearer_token\`,
\`ed25519_keypair\`.

Machine-readable \`agent_auth\` block (also served in
\`/.well-known/oauth-authorization-server\`):

\`\`\`json
{
  "agent_auth": {
    "skill": "${o}/auth.md",
    "register_uri": "${o}/signup",
    "identity_endpoint": "${o}/api/v1/agentic/asc/register",
    "claim_uri": "${o}/dashboard/devices",
    "claim_endpoint": "${o}/dashboard/devices",
    "identity_types_supported": ["anonymous", "user_delegated", "agent"],
    "anonymous": { "credential_types_supported": ["ed25519_keypair", "bearer_token"] },
    "credential_types_supported": ["oauth2_authorization_code", "bearer_token", "ed25519_keypair"],
    "registration_methods": ["oauth2_authorization_code", "dashboard_token", "asc_device_key"],
    "revocation_uri": "${o}/dashboard/tokens"
  }
}
\`\`\`

## Call the API

\`\`\`
GET ${o}/api/v1/services
Authorization: Bearer <token>
\`\`\`

Full spec: \`${o}/openapi.json\`. Quick start: \`${o}/api/v1/quick-start\`.

## Scopes and limits

Scopes are hierarchical: \`full\` > \`services:*\` > \`services:{name}:read|write\`,
with per-resource sub-scopes on some services. Per-agent daily/monthly usage limits
may apply; exceeding them returns HTTP 429.

## Revocation

Owners revoke agent tokens at \`${o}/dashboard/tokens\` (revocation URL) and
device credentials at \`${o}/dashboard/devices\`. Revocation is immediate.

## Rules for agents

Before performing ANY action, describe what you intend to do and wait for explicit
human approval. Every request is written to an immutable audit log.
`;
  res.set('Cache-Control', CACHE_HEADER);
  res.type('text/markdown').send(md);
});

// ---------------------------------------------------------------------------
// Agentic Commerce Protocol discovery (rfc.discovery)
router.get('/.well-known/acp.json', (req, res) => {
  const o = origin(req);
  res.set('Cache-Control', CACHE_HEADER);
  res.json({
    protocol: { name: 'acp', version: '2026-01-15' },
    api_base_url: `${o}/api/v1/`,
    transports: ['https'],
    capabilities: {
      services: ['billing', 'subscriptions', 'marketplace'],
      checkout: { endpoint: `${o}/api/v1/billing/checkout`, methods: ['stripe'] },
      catalog: { plans: `${o}/api/v1/billing/plans`, marketplace: `${o}/api/v1/marketplace/listings` },
    },
    authentication: { discovery: `${o}/.well-known/oauth-authorization-server` },
    documentation: `${o}/openapi.json`,
  });
});

// Universal Commerce Protocol profile
router.get('/.well-known/ucp', (req, res) => {
  const o = origin(req);
  res.set('Cache-Control', CACHE_HEADER);
  res.json({
    ucp: {
      version: '2026-01-11',
      services: {
        'dev.ucp.shopping': {
          version: '2026-01-11',
          spec: 'https://ucp.dev/specification/overview/',
          endpoints: {
            catalog: `${o}/api/v1/billing/plans`,
            checkout: `${o}/api/v1/billing/checkout`,
          },
        },
      },
      capabilities: [
        { name: 'dev.ucp.shopping.checkout', version: '2026-01-11' },
      ],
      payment_handlers: ['stripe'],
      authentication: { discovery: `${o}/.well-known/oauth-authorization-server` },
    },
  });
});

// ---------------------------------------------------------------------------
// MCP Server Card (SEP-1649)
router.get('/.well-known/mcp/server-card.json', (req, res) => {
  const o = origin(req);
  res.set('Cache-Control', CACHE_HEADER);
  res.json({
    $schema: 'https://static.modelcontextprotocol.io/schemas/2025-11-25/server-card.schema.json',
    serverInfo: { name: 'myapi-asc-mcp', title: 'MyApi', version: '0.1.15' },
    description:
      'MyApi MCP server. Install with `npx myapi-asc-mcp`; it registers an Ed25519 device keypair, the user approves it at /dashboard/devices, and the keypair becomes the permanent credential. Exposes connected services (Gmail, GitHub, Slack, …), knowledge base, and personas as tools.',
    transport: { type: 'stdio', command: 'npx', args: ['-y', 'myapi-asc-mcp'] },
    capabilities: { tools: { listChanged: false } },
    documentation: `${o}/platform-docs`,
    homepage: o,
  });
});

// ---------------------------------------------------------------------------
// Agent Skills Discovery (RFC v0.2.0)
const SKILLS_DIR = path.join(__dirname, '..', 'public', 'agent-skills');
let skillsIndexCache = null;

function buildSkillsIndex(o) {
  if (skillsIndexCache) return skillsIndexCache(o);
  const entries = [];
  for (const name of fs.existsSync(SKILLS_DIR) ? fs.readdirSync(SKILLS_DIR) : []) {
    const file = path.join(SKILLS_DIR, name, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const body = fs.readFileSync(file);
    const descMatch = body.toString('utf8').match(/^description:\s*(.+)$/m);
    entries.push({
      name,
      type: 'skill',
      description: descMatch ? descMatch[1].trim() : `MyApi skill: ${name}`,
      path: `/.well-known/agent-skills/${name}/SKILL.md`,
      sha256: crypto.createHash('sha256').update(body).digest('hex'),
    });
  }
  skillsIndexCache = (org) => ({
    $schema: 'https://agentskills.io/schemas/index-v0.2.0.json',
    version: '0.2.0',
    skills: entries.map((e) => ({ ...e, url: `${org}${e.path}`, path: undefined })),
  });
  return skillsIndexCache(o);
}

router.get('/.well-known/agent-skills/index.json', (req, res) => {
  res.set('Cache-Control', CACHE_HEADER);
  res.json(buildSkillsIndex(origin(req)));
});

// ---------------------------------------------------------------------------
// A2A (Agent2Agent protocol) — Agent Card + JSON-RPC endpoint.
// MyApi's A2A agent is a public, read-only "platform concierge": it answers
// questions about the platform (auth, pricing, API surface) with pointers into
// the discovery documents. It never touches user data, so the endpoint is
// unauthenticated by design; anything stateful goes through the normal
// authenticated REST API instead.
const A2A_PROTOCOL_VERSION = '0.3.0';

function agentCard(o) {
  const iface = { url: `${o}/api/v1/a2a`, transport: 'JSONRPC', protocolVersion: A2A_PROTOCOL_VERSION };
  return {
    protocolVersion: A2A_PROTOCOL_VERSION,
    name: 'MyApi Platform Concierge',
    description:
      'Public A2A agent for the MyApi personal API gateway. Answers questions about authentication, pricing plans, and the API surface, and points agents at the right discovery documents. Acting on a user’s connected services requires the authenticated REST API (see /auth.md).',
    version: '1.0.0',
    url: `${o}/api/v1/a2a`,
    preferredTransport: 'JSONRPC',
    supportedInterfaces: [iface],
    additionalInterfaces: [iface],
    provider: { organization: 'MyApi', url: o },
    documentationUrl: `${o}/platform-docs`,
    iconUrl: `${o}/dashboard/myapi-logo.png`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
      extensions: [
        {
          uri: 'https://github.com/google-agentic-commerce/ap2/v1',
          description: 'AP2 payments: plan subscriptions and credit top-ups settle via Stripe Checkout (see /.well-known/acp.json and the x-payment-info OpenAPI extensions).',
          required: false,
          params: { roles: ['merchant'], payment_methods: ['stripe'] },
        },
      ],
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain', 'application/json'],
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', description: 'Optional. The concierge is public; Bearer tokens are only needed for the REST API.' },
    },
    security: [],
    skills: [
      {
        id: 'platform-info',
        name: 'Platform information',
        description: 'Explains what MyApi is and how AI agents integrate with it (gateway model, scopes, audit log).',
        tags: ['discovery', 'documentation'],
        examples: ['What is MyApi?', 'How do agents integrate with MyApi?'],
      },
      {
        id: 'auth-guidance',
        name: 'Authentication guidance',
        description: 'Describes agent registration and credential options: OAuth 2.0 + PKCE, dashboard-issued Bearer tokens, Ed25519 device keys.',
        tags: ['auth', 'registration'],
        examples: ['How do I authenticate?', 'How does an agent register?'],
      },
      {
        id: 'billing-plans',
        name: 'Billing plans',
        description: 'Lists pricing plans (Personal free, Pro $9/mo, Heavy $29/mo) and how checkout works.',
        tags: ['billing', 'pricing', 'payments'],
        examples: ['What does MyApi cost?', 'Which plan allows automations?'],
      },
    ],
  };
}

router.get('/.well-known/agent-card.json', (req, res) => {
  res.set('Cache-Control', CACHE_HEADER);
  res.json(agentCard(origin(req)));
});
// Legacy A2A discovery path (pre-0.3 clients)
router.get('/.well-known/agent.json', (req, res) => {
  res.set('Cache-Control', CACHE_HEADER);
  res.json(agentCard(origin(req)));
});

function conciergeReply(text, o) {
  const t = String(text || '').toLowerCase();
  if (/auth|login|register|token|credential|key/.test(t)) {
    return `Agents authenticate to MyApi with a Bearer token. Registration options: OAuth 2.0 authorization-code flow with PKCE (discovery: ${o}/.well-known/oauth-authorization-server), a dashboard-issued scoped token, or an Ed25519 device keypair via \`npx myapi-asc-mcp\`. Full walkthrough: ${o}/auth.md`;
  }
  if (/price|pricing|plan|cost|billing|pay|subscribe/.test(t)) {
    return `MyApi plans: Personal (free, up to 5 services, 1k calls/mo), Pro ($9/mo, all services, 10k calls/mo + $0.25/1k overage), Heavy ($29/mo, unlimited). Automations and MyApi-AI need Pro or Heavy. Machine-readable: GET ${o}/api/v1/billing/plans. Checkout settles via Stripe (${o}/.well-known/acp.json).`;
  }
  if (/api|endpoint|openapi|spec|docs|documentation|mcp|service/.test(t)) {
    return `MyApi is a personal API gateway: connect 100+ services once, then agents act through one API with scopes, per-agent limits, and an audit log. OpenAPI spec: ${o}/openapi.json · quick start: ${o}/api/v1/quick-start · MCP server card: ${o}/.well-known/mcp/server-card.json · agent skills: ${o}/.well-known/agent-skills/index.json`;
  }
  return `I'm the MyApi platform concierge. I can explain authentication and agent registration (${o}/auth.md), pricing plans (${o}/api/v1/billing/plans), and the API surface (${o}/openapi.json). Ask me about any of those — acting on a user's connected services requires the authenticated REST API.`;
}

const jsonRpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

router.post('/api/v1/a2a', (req, res) => {
  const body = req.body || {};
  const { id, method, params } = body;
  if (body.jsonrpc !== '2.0' || typeof method !== 'string') {
    return res.json(jsonRpcError(id, -32600, 'Invalid Request: expected JSON-RPC 2.0 envelope'));
  }
  if (method === 'message/send') {
    const parts = params?.message?.parts || [];
    const text = parts.filter((p) => p.kind === 'text' || p.type === 'text').map((p) => p.text).join('\n');
    const o = origin(req);
    return res.json({
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        kind: 'message',
        role: 'agent',
        messageId: crypto.randomUUID(),
        contextId: params?.message?.contextId || crypto.randomUUID(),
        parts: [{ kind: 'text', text: conciergeReply(text, o) }],
      },
    });
  }
  if (method === 'tasks/get' || method === 'tasks/cancel' || method === 'tasks/resubscribe') {
    // Concierge replies are synchronous messages; no tasks are ever created.
    return res.json(jsonRpcError(id, -32001, 'Task not found: this agent responds synchronously and does not create tasks'));
  }
  if (method === 'message/stream' || method === 'tasks/pushNotificationConfig/set' || method === 'tasks/pushNotificationConfig/get') {
    return res.json(jsonRpcError(id, -32003, 'This operation is not supported: streaming and push notifications are disabled (see capabilities)'));
  }
  return res.json(jsonRpcError(id, -32601, `Method not found: ${method}`));
});

router.get('/.well-known/agent-skills/:name/SKILL.md', (req, res) => {
  const name = String(req.params.name).replace(/[^a-z0-9-]/gi, '');
  const file = path.join(SKILLS_DIR, name, 'SKILL.md');
  if (!name || !fs.existsSync(file)) return res.status(404).json({ error: 'Skill not found' });
  res.set('Cache-Control', CACHE_HEADER);
  res.type('text/markdown').send(fs.readFileSync(file, 'utf8'));
});

module.exports = router;
