# MyApi Platform - Human Dashboard

A personal API platform with secure token management, external service connectors, and a beautiful React dashboard.

## 🚀 Features

### Backend (Express + SQLite)
- **Token Vault**: Securely store external API tokens with encryption
- **Guest Access Tokens**: Generate scoped tokens with fine-grained permissions (Phase 9)
- **Scope System**: Hierarchical permission model (`identity:read`, `brain:chat`, `admin:*`, etc.)
- **Service Connectors**: Integrate with GitHub, Google, Calendar, etc.
- **Audit Logging**: Complete audit trail of all API access, including scope violations
- **Rate Limiting**: Built-in protection against abuse
- **SQLite Database**: Persistent storage with better-sqlite3

### Frontend (React + Vite + Tailwind)
- **🔐 Login**: Secure master token authentication
- **📊 Dashboard Home**: System status and metrics overview
- **🔗 Service Connectors**: Visual cards for connecting external services
- **💾 Token Vault**: CRUD interface for managing external API tokens
- **🎟️ Guest Access**: Token generator with scope selection

## 📁 Project Structure

```
MyApi/
├── src/
│   ├── index.js              # Main Express server
│   ├── database.js           # SQLite database layer
│   ├── db.sqlite             # Database file (auto-created)
│   ├── package.json          # Backend dependencies
│   └── public/
│       ├── dist/             # Built React app (served at /dashboard/)
│       └── dashboard-app/    # React source code
│           ├── src/
│           │   ├── App.jsx
│           │   ├── components/
│           │   │   └── Layout.jsx
│           │   └── pages/
│           │       ├── Login.jsx
│           │       ├── DashboardHome.jsx
│           │       ├── ServiceConnectors.jsx
│           │       ├── TokenVault.jsx
│           │       └── GuestAccess.jsx
│           ├── vite.config.js
│           ├── tailwind.config.js
│           └── package.json
```

## 🛠️ Installation

### 1. Install Backend Dependencies
```bash
cd src
npm install
```

### 2. Install Frontend Dependencies
```bash
cd src/public/dashboard-app
npm install
```

### 3. Build Frontend
```bash
cd src/public/dashboard-app
npm run build
```

## 🚀 Running the Server

### Start the Backend
```bash
cd src
node index.js
```

The server will:
- Start on port 4500
- Initialize SQLite database at `src/db.sqlite`
- Generate a **Master Token** (SAVE THIS!)
- Serve the dashboard at `http://localhost:4500/dashboard/`

### Example Output
```
=== MyApi Dashboard Started ===
Master Token (SAVE THIS): 9ff89b2d70bdbe1ce9a72f63f5c32b528509ff27d0b16307e8ce43a7abc5e7ca
Listening on port 4500
Dashboard: http://localhost:4500/dashboard/
==============================
```

## 🔑 Authentication

### Master Token
- Copy the master token from server startup logs
- Use it to log into the dashboard at `/dashboard/`
- Required for all admin operations (creating tokens, accessing vault, etc.)

### Guest Tokens
- Generate from the "Guest Access" page
- Available scopes:
  - `read` - Basic info (name, role, company)
  - `professional` - Skills, education, experience
  - `availability` - Calendar, timezone

## 📡 API Endpoints

### Authentication
All endpoints require `Authorization: Bearer <token>` header.

### Identity & Preferences
- `GET /api/v1/identity` - Get identity (scoped)
- `GET /api/v1/identity/professional` - Professional info
- `GET /api/v1/identity/availability` - Availability info
- `GET /api/v1/preferences` - User preferences (master only)
- `PUT /api/v1/preferences` - Update preferences (master only)

### Token Management — Fine-Grained Scopes (Phase 9)
Guest access tokens now support hierarchical, fine-grained scopes for delegated access control.

- `POST /api/v1/tokens` - Create guest token with scopes (master only)
  - Input: `{ label, scopes: ["identity:read", "brain:chat"], expiresInHours?, description? }`
  - Scopes: `identity:read`, `identity:write`, `vault:read`, `vault:write`, `services:read`, `services:write`, `brain:chat`, `brain:read`, `audit:read`, `personas:read`, `personas:write`, `admin:*`
  - Templates: `read`, `professional`, `availability`, `guest`, `admin`, `custom`
  - Output: `{ id, token, scopes, label, createdAt, expiresAt }`
  - Audit: `create_guest_token_scoped`

- `GET /api/v1/tokens` - List all tokens with scopes (master only)
  - Output: `[ { tokenId, label, scopes, createdAt, expiresAt, active } ]`

- `GET /api/v1/tokens/:id` - Get token details with scopes (master only)
  - Output: `{ id, label, description, scopes, createdAt, expiresAt, revokedAt, active }`

- `PUT /api/v1/tokens/:id` - Update token scopes (master only)
  - Input: `{ scopes: ["vault:read"] }`
  - Output: `{ id, scopes, updatedAt }`
  - Audit: `update_token_scopes`

- `DELETE /api/v1/tokens/:id` - Revoke token (master only)
  - Audit: `revoke_token`

- `GET /api/v1/scopes` - List available scopes (master only)
  - Output: `{ scopes: [ { name, description, category } ], templates: {...} }`

**See [docs/SCOPES.md](docs/SCOPES.md) for complete scope reference.**

### Token Vault (External API Tokens)
- `POST /api/v1/vault/tokens` - Add external token (master only)
- `GET /api/v1/vault/tokens` - List vault tokens (master only)
- `DELETE /api/v1/vault/tokens/:id` - Delete vault token (master only)

### Connectors
- `POST /api/v1/connectors` - Add connector (master only)
- `GET /api/v1/connectors` - List connectors (master only)

### Gateway Context Assembly
- `GET /api/v1/gateway/context` - Get unified context (user profile, persona, services, memory) for AI platform consumption (master only)

### Personas — SOUL.md Variants (Phase 6)
Manage multiple personality variants. The active persona's `soul_content` is used in `/api/v1/gateway/context` instead of the hardcoded SOUL.md file.

- `POST /api/v1/personas` - Create new persona
  - Input: `{ name, soul_content (markdown), description? }`
  - Output: `{ id, name, active, created_at }`
  - Example: Create a "Professional" variant with different tone/approach

- `GET /api/v1/personas` - List all personas
  - Output: `[ { id, name, active, description, created_at } ]`

- `GET /api/v1/personas/:id` - Get specific persona (includes full soul_content)
  - Output: `{ id, name, soul_content, description, active, created_at }`

- `PUT /api/v1/personas/:id` - Update persona or set as active
  - Input: `{ name?, soul_content?, description?, active? }`
  - To set as active: `{ "active": true }`
  - To update fields: `{ "name": "...", "soul_content": "..." }`
  - Output: updated persona object

- `DELETE /api/v1/personas/:id` - Remove persona variant
  - Constraint: Cannot delete the last remaining persona
  - Output: `{ ok: true }`

### OAuth 2.0 Connector Proxying (Phase 7)
Real OAuth 2.0 flows for external service connections. Supports Google, GitHub, Slack, Discord, and WhatsApp Business API.

- `GET /api/v1/oauth/authorize/:service` - Start OAuth flow
  - Services: `google`, `github`, `slack`, `discord`, `whatsapp`
  - Output: `{ ok: true, authUrl, state }`
  - Generates CSRF-protected state token
  - Redirects user to service authorization page

- `GET /api/v1/oauth/callback/:service` - OAuth callback handler
  - Input: `code` (authorization code), `state` (CSRF token)
  - Exchanges code for access token via service API
  - Stores encrypted token in database
  - Updates OAuth status to "connected"
  - Returns: Redirect to dashboard with success/error status

- `GET /api/v1/oauth/status` - Get all connected OAuth services
  - Output: `{ services: [ { name, status, lastSync, scope, enabled } ] }`
  - Status: `connected` or `disconnected`
  - Requires authentication (master token)

- `POST /api/v1/oauth/disconnect/:service` - Revoke OAuth connection
  - Input: Service name in URL
  - Revokes token on remote service
  - Deletes encrypted token from database
  - Updates status to "disconnected"
  - Output: `{ ok: true, message }`

- `GET /api/v1/oauth/test/:service` - Test token validity
  - Input: Service name in URL
  - Verifies token with service API
  - Output: `{ service, valid, error, data }`

### Audit
- `GET /api/v1/audit` - View audit logs (master only)

### Health
- `GET /health` - Server health check

## 🎨 Dashboard Pages

### 1. Login (`/dashboard/`)
- Enter master token to access dashboard
- Token stored in localStorage for convenience

### 2. Dashboard Home (`/dashboard/`)
- System status overview
- Token count, connector count, audit log count
- Server uptime

### 3. Service Connectors (`/dashboard/connectors`)
- Visual cards for services (GitHub, Google, Calendar, etc.)
- Connect/disconnect buttons
- Mock OAuth flow (stores "connected: true" status)

### 4. Token Vault (`/dashboard/vault`)
- Add external API tokens with label + description
- Tokens encrypted before storage
- Masked preview (e.g., `abc1***xyz9`)
- Delete tokens

### 5. Guest Access (`/dashboard/guest`)
- Generate scoped access tokens
- Select scopes via checkboxes
- Set expiration (1hr, 24hr, 7d, 30d, never)
- Copy generated token to clipboard
- View/revoke active guest tokens

## 🔒 Security Features

- ✅ Token hashing with bcrypt
- ✅ External API token encryption (AES-256)
- ✅ Rate limiting (60 requests/minute per IP)
- ✅ Helmet.js security headers
- ✅ CORS protection
- ✅ Request size limits (100kb)
- ✅ Audit logging for all actions
- ✅ Token expiration support

## 🗄️ Database Schema

### `vault_tokens`
- External API tokens (encrypted)
- Fields: id, label, description, encrypted_token, token_preview

### `access_tokens`
- Guest access tokens (hashed)
- Fields: id, hash, owner_id, scope, label, created_at, revoked_at, expires_at

### `connectors`
- External service connections
- Fields: id, type, label, config (JSON), active, created_at

### `audit_log`
- Complete audit trail
- Fields: id, timestamp, requester_id, action, resource, scope, ip, details

### `personas` (Phase 6)
- SOUL.md personality variants
- Fields: id (int, pk), name (text), soul_content (text), description (text), active (bool), created_at (timestamp), updated_at (timestamp)
- One persona is marked as `active=1` and its `soul_content` is used in gateway context

## 🧪 Testing the API

### 1. Get Identity
```bash
curl -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  http://localhost:4500/api/v1/identity
```

### 2. Create Guest Token
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"Test Guest","scope":"read","expiresInHours":24}' \
  http://localhost:4500/api/v1/tokens
```

### 3. Add External Token to Vault
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"OpenAI","description":"GPT-4 API","token":"sk-..."}' \
  http://localhost:4500/api/v1/vault/tokens
```

### 4. Manage Personas (Phase 6)

#### Create a new persona variant
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Professional Variant",
    "soul_content": "# Professional Mode\n\n**Tone**: Formal and business-focused\n**Approach**: Structured and methodical",
    "description": "For professional interactions"
  }' \
  http://localhost:4500/api/v1/personas
```

#### List all personas
```bash
curl -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  http://localhost:4500/api/v1/personas
```

#### Get a specific persona (with full soul_content)
```bash
curl -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  http://localhost:4500/api/v1/personas/1
```

#### Set a persona as active
```bash
curl -X PUT \
  -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"active": true}' \
  http://localhost:4500/api/v1/personas/2
```

#### Update persona details
```bash
curl -X PUT \
  -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name", "description": "New description"}' \
  http://localhost:4500/api/v1/personas/1
```

#### Delete a persona
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  http://localhost:4500/api/v1/personas/1
```

#### Get gateway context (uses active persona's soul_content)
```bash
curl -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  http://localhost:4500/api/v1/gateway/context
```

### 5. OAuth 2.0 Flow (Phase 7)

#### Configuration
OAuth credentials should be stored in environment variables (never hardcoded):

```bash
# Google OAuth
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"
export GOOGLE_REDIRECT_URI="http://localhost:4500/api/v1/oauth/callback/google"

# GitHub OAuth
export GITHUB_CLIENT_ID="your-github-client-id"
export GITHUB_CLIENT_SECRET="your-github-client-secret"
export GITHUB_REDIRECT_URI="http://localhost:4500/api/v1/oauth/callback/github"

# Slack OAuth
export SLACK_CLIENT_ID="your-slack-client-id"
export SLACK_CLIENT_SECRET="your-slack-client-secret"
export SLACK_REDIRECT_URI="http://localhost:4500/api/v1/oauth/callback/slack"

# Discord OAuth
export DISCORD_CLIENT_ID="your-discord-client-id"
export DISCORD_CLIENT_SECRET="your-discord-client-secret"
export DISCORD_REDIRECT_URI="http://localhost:4500/api/v1/oauth/callback/discord"

# WhatsApp Business API (token-based, no OAuth2)
export WHATSAPP_BUSINESS_ACCOUNT_ID="your-business-account-id"
export WHATSAPP_API_TOKEN="your-whatsapp-api-token"
```

Then start the server:
```bash
cd src
node index.js
```

#### Start OAuth flow for Google
```bash
curl -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  http://localhost:4500/api/v1/oauth/authorize/google
```

Returns:
```json
{
  "ok": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "state": "state-token-for-csrf-protection"
}
```

Open the `authUrl` in a browser. After user approves, they're redirected to the callback endpoint.

#### Check OAuth status (connected services)
```bash
curl -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  http://localhost:4500/api/v1/oauth/status
```

Returns:
```json
{
  "services": [
    {
      "name": "google",
      "status": "connected",
      "lastSync": "2024-02-27T12:30:00.000Z",
      "scope": "email profile gmail.readonly calendar.readonly",
      "enabled": true
    },
    {
      "name": "github",
      "status": "disconnected",
      "lastSync": null,
      "scope": null,
      "enabled": true
    }
  ]
}
```

#### Test token validity
```bash
curl -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  http://localhost:4500/api/v1/oauth/test/google
```

Returns:
```json
{
  "service": "google",
  "valid": true,
  "error": null,
  "data": { "expires_in": 3599, "access_type": "offline", ... }
}
```

#### Disconnect OAuth service
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  http://localhost:4500/api/v1/oauth/disconnect/google
```

Returns:
```json
{
  "ok": true,
  "message": "Successfully disconnected google"
}
```

## 🔧 Development

### Frontend Development (with Hot Reload)
```bash
cd src/public/dashboard-app
npm run dev
```
Access dev server at `http://localhost:5173`

### Build Frontend for Production
```bash
cd src/public/dashboard-app
npm run build
```

### Backend Development (with Auto-Restart)
```bash
cd src
npm run dev  # Uses nodemon
```

## 🧠 Personal Brain API (Phase 8)

The Personal Brain provides context-aware AI responses using LangChain integration. It combines user profile, persona, conversation history, and knowledge base documents.

### Brain Features
- **Context Assembly**: Automatically loads user profile, persona, and memories
- **Conversation Memory**: Maintains full conversation history
- **Knowledge Base**: Semantic search over personal documents
- **Multiple LLM Providers**: Gemini (default), OpenAI, Claude, Ollama
- **Audit Logging**: Full audit trail of all brain operations
- **Caching**: Intelligent context caching for performance

### Brain API Endpoints

#### Chat with AI
```bash
POST /api/v1/brain/chat
Authorization: Bearer YOUR_TOKEN

{
  "message": "What is my name?",
  "conversationId": "conv_abc123",
  "model": "gemini-pro",
  "temperature": 0.7
}
```

#### List Conversations
```bash
GET /api/v1/brain/conversations
Authorization: Bearer YOUR_TOKEN
```

#### Get Conversation History
```bash
GET /api/v1/brain/conversations/{id}
Authorization: Bearer YOUR_TOKEN
```

#### Add Document to Knowledge Base
```bash
POST /api/v1/brain/knowledge-base
Authorization: Bearer YOUR_TOKEN

{
  "source": "documentation",
  "title": "My Project",
  "content": "Documentation content..."
}
```

#### List Knowledge Base Documents
```bash
GET /api/v1/brain/knowledge-base
Authorization: Bearer YOUR_TOKEN
```

#### Get Current Context
```bash
GET /api/v1/brain/context
Authorization: Bearer YOUR_TOKEN
```

### Configuration

Set up in `config/brain.json`:
```json
{
  "llm": {
    "model": "gemini-pro",
    "temperature": 0.7,
    "maxTokens": 2048
  },
  "context": {
    "maxHistoryMessages": 10,
    "cacheEnabled": true,
    "cacheTTL": 3600
  }
}
```

### Environment Setup

```bash
# Google Gemini (recommended, lowest cost)
export GOOGLE_API_KEY="your-gemini-key"

# or OpenAI
export OPENAI_API_KEY="your-openai-key"

# or Claude
export ANTHROPIC_API_KEY="your-claude-key"
```

### Knowledge Base

The brain automatically seeds from:
- `USER.md` - User identity
- `SOUL.md` - AI personality  
- `MEMORY.md` - Long-term memories

For detailed setup and examples, see [BRAIN_SETUP.md](./docs/BRAIN_SETUP.md).

## 🌟 Future Enhancements

- [ ] Real OAuth flows for connectors
- [ ] Token rotation and refresh
- [ ] Multi-user support
- [ ] 2FA for master token
- [ ] Token usage analytics
- [ ] Export/import vault data
- [ ] WebSocket for real-time updates
- [ ] Docker containerization

## 📝 Notes

- **Master Token**: Critical! Save it securely. No recovery if lost (must regenerate by deleting db.sqlite)
- **Database**: Located at `src/db.sqlite` - backup regularly
- **Environment Variables**: 
  - `PORT` - Server port (default: 4500)
  - `VAULT_KEY` - Encryption key for vault tokens (default: insecure, set in production!)
  - `CORS_ORIGIN` - CORS allowed origin (default: *)

## 🎉 Credits

Built with:
- Express.js
- React + Vite
- Tailwind CSS
- better-sqlite3
- bcrypt
- Helmet.js

---

**Enjoy your personal API platform! 🚀**
