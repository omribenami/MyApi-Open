# MyApi Platform - MVP

A personal API platform with Vault, Gateway, and Brain components for managing digital identity and providing secure, scoped access to personal data.

## 🏗️ Architecture

### Three-Tier Design

1. **Vault (Data Layer)**: Encrypted storage for identity documents, preferences, and connector configurations
2. **Gateway (Management Layer)**: Token-based API access control with Personal and Guest tokens
3. **Personal Brain (Logic Layer)**: Privacy-aware middleware that evaluates requests and enforces data policies

## ✨ Features

- **🔐 Token-Based Authentication**: Personal tokens (full access) and Guest tokens (scoped read-only)
- **🧠 Privacy-First Brain**: Middleware that evaluates each request against token scope and privacy policies
- **📊 Audit Logging**: Every API access logged with timestamp, requester, scope, and action
- **🔒 Encryption at Rest**: All sensitive data encrypted using AES encryption
- **🎛️ Web Dashboard**: Simple UI for managing identity, tokens, and viewing audit logs
- **⚡ Rate Limiting**: Protects against abuse
- **🛡️ Security Headers**: Helmet.js for HTTP security
- **✅ Input Validation**: Express-validator for request validation

## 🚀 Quick Start

### Installation

```bash
# Navigate to project directory
cd /opt/MyApi/src

# Install dependencies
npm install

# Initialize database and create first personal token
npm run init-db

# Start the server
npm start
```

### Development Mode

```bash
npm run dev
```

## 📝 Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secure-secret-key
ENCRYPTION_KEY=your-32-character-encryption-key
DB_PATH=./data/myapi.db
USER_MD_PATH=/path/to/USER.md
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000
```

## 🔑 API Endpoints

### Public Endpoints

- `GET /health` - Health check

### Data Endpoints (Require Authentication)

- `GET /api/identity/:key` - Get identity data by key
- `GET /api/identity?category=X` - List identity data by category
- `GET /api/identity-all` - Get all identity data (personal tokens only)
- `POST /api/identity` - Store identity data (personal tokens only)
- `GET /api/preferences/:key` - Get preference by key
- `GET /api/preferences?category=X` - List preferences by category
- `POST /api/preferences` - Store preference (personal tokens only)
- `GET /api/connectors` - List connectors (personal tokens only)

### Management Endpoints (Require Personal Token)

- `POST /api/manage/tokens` - Create new token
- `GET /api/manage/tokens` - List all tokens
- `GET /api/manage/tokens/:id` - Get token by ID
- `DELETE /api/manage/tokens/:id` - Revoke token
- `GET /api/manage/audit` - Get audit logs
- `GET /api/manage/audit/stats` - Get audit statistics
- `GET /api/manage/audit/token/:tokenId` - Get audit logs for specific token
- `POST /api/manage/ingest-user-md` - Ingest USER.md file

## 🎨 Dashboard

Access the web dashboard at `http://localhost:3001`

Features:
- Token management (create, list, revoke)
- Audit log viewer with statistics
- Identity vault browser
- USER.md ingestion

## 🔐 Token Scopes

### Personal Token (Full Access)

```json
{
  "identity": "*",
  "preferences": "*",
  "connectors": "*"
}
```

### Guest Token (Scoped Access)

```json
{
  "identity": ["user_overview", "user_title"],
  "preferences": ["theme", "language"]
}
```

## 📊 Vault Structure

### Identity Data

Stored with encryption at rest:
- Key-value pairs organized by category
- Metadata support
- USER.md auto-parsing into structured sections

### Preferences

Simple key-value storage for user preferences:
- Theme, language, timezone
- Custom application settings

### Connectors

Configuration for external data sources:
- GitHub, LinkedIn, journal sources
- Read-only connectors (planned)

## 🛡️ Security Features

- **bcrypt** for token hashing
- **AES encryption** for data at rest
- **Helmet.js** for HTTP security headers
- **CORS** configuration
- **Rate limiting** (100 requests per 15 minutes)
- **Input validation** on all endpoints
- **Comprehensive audit logging**

## 📁 Project Structure

```
src/
├── server.js              # Main server entry point
├── config/
│   └── database.js        # SQLite database setup
├── vault/
│   └── vault.js           # Vault data layer
├── gateway/
│   ├── tokens.js          # Token management
│   └── audit.js           # Audit logging
├── brain/
│   └── brain.js           # Personal Brain middleware
├── middleware/
│   └── auth.js            # Authentication middleware
├── routes/
│   ├── api.js             # Data API routes
│   └── management.js      # Management API routes
├── utils/
│   ├── encryption.js      # Encryption utilities
│   └── logger.js          # Logging utilities
├── public/
│   └── index.html         # Dashboard UI
└── scripts/
    └── init-db.js         # Database initialization
```

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test authenticated endpoint (replace TOKEN)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/identity-all
```

## 📖 Usage Example

```javascript
// Create a guest token with limited scope
const response = await fetch('http://localhost:3001/api/manage/tokens', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_PERSONAL_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'External API Access',
    type: 'guest',
    scope: {
      identity: ['user_overview'],
      preferences: ['theme']
    },
    expiresInDays: 30
  })
});

const { token } = await response.json();

// Use the guest token to access scoped data
const data = await fetch('http://localhost:3001/api/identity/user_overview', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## 🔄 Future Enhancements

- Live Connectors integration (GitHub, LinkedIn, etc.)
- Zero-Knowledge encryption enhancements
- Webhooks for audit events
- API key rotation
- Multi-user support
- OAuth2 integration
- GraphQL API

## 📝 License

MIT

## 🤝 Contributing

This is part of the MyApi conceptual platform project. See the parent `ARCHITECTURE.md` for the full vision.
