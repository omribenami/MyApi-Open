# MyApi OAuth Integration Setup Guide

## Overview

This guide walks you through setting up OAuth integration for MyApi Dashboard with Google, GitHub, and Facebook.

## Phase 1: OAuth Integration (Backend + Frontend)

### 1. Backend OAuth Setup

The backend OAuth implementation is complete and includes:
- **OAuth Adapters**: Google, GitHub, Facebook, Slack, Discord, WhatsApp
- **Routes**: 
  - `GET /api/v1/oauth/authorize/:service` - Start OAuth flow
  - `GET /api/v1/oauth/callback/:service` - Handle OAuth callback
  - `GET /api/v1/oauth/status` - Get all connected services
  - `POST /api/v1/oauth/disconnect/:service` - Revoke connection

### 2. Environment Configuration

**Step 1: Copy the example .env file**
```bash
cd src
cp .env.example .env
```

**Step 2: Configure OAuth Credentials**

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add redirect URI: `http://localhost:4500/api/v1/oauth/callback/google`
6. Copy Client ID and Client Secret to `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

#### GitHub OAuth
1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set Authorization callback URL: `http://localhost:4500/api/v1/oauth/callback/github`
4. Copy Client ID and Client Secret to `.env`:
   ```
   GITHUB_CLIENT_ID=your-client-id
   GITHUB_CLIENT_SECRET=your-client-secret
   ```

#### Facebook OAuth
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add Facebook Login product
4. Configure OAuth Redirect URIs: `http://localhost:4500/api/v1/oauth/callback/facebook`
5. Copy App ID and App Secret to `.env`:
   ```
   FACEBOOK_APP_ID=your-app-id
   FACEBOOK_APP_SECRET=your-app-secret
   ```

### 3. Frontend Login Page

The login page has been updated with OAuth button components:
- **Google** login button
- **GitHub** login button
- **Facebook** login button (optional)
- **Fallback** token-based login

**Features:**
- OAuth buttons trigger the authorization flow
- User is redirected to OAuth provider
- Callback handler manages the redirect back
- Automatic authentication on successful OAuth
- Error handling and user feedback

### 4. Testing OAuth Flow

**Development Environment:**
```bash
# Terminal 1: Start backend server
cd src
npm run dev

# Terminal 2: Start frontend development server
cd src/public/dashboard-app
npm run dev
```

**Test Flow:**
1. Navigate to `http://localhost:5173` (or wherever Vite serves the frontend)
2. Click "Google" OAuth button
3. Authorize access to your account
4. Should redirect back to dashboard with authentication

## Phase 2: Services/Connectors Tab

### 1. UI Components

New components created:
- **ServiceCard** (`src/components/ServiceCard.jsx`): Displays individual service with status and actions
- **RevokeConfirmationModal** (`src/components/RevokeConfirmationModal.jsx`): Confirms service disconnection

### 2. Services Tab (`src/pages/ServiceConnectors.jsx`)

**Features:**
- Display all available services (Google, GitHub, Slack, Discord, WhatsApp)
- Show connected vs. disconnected services
- Connect services via OAuth
- Disconnect/revoke services with confirmation
- Service metadata (last synced, scopes)
- Error handling and loading states

**Layout:**
- Responsive grid (1 column mobile, 2 columns tablet, 3 columns desktop)
- Connected services section (green badge)
- Available services section (amber badge)
- Empty state when no services

### 3. State Management

**Zustand Stores:**
- **authStore** (`src/stores/authStore.js`): Authentication state, tokens
- **servicesStore** (`src/stores/servicesStore.js`): Services list, modals, UI state

**API Client:**
- **apiClient** (`src/utils/apiClient.js`): Axios instance with auth interceptors
- **oauth** utilities: OAuth flow helpers

### 4. Testing Services Tab

**In Dashboard:**
1. Navigate to Services tab
2. Click "Connect" button on a service
3. Complete OAuth flow
4. Service should appear in "Connected Services"
5. Click "Disconnect" to revoke access

## Architecture Overview

### Frontend Data Flow
```
Login Component
    ↓
OAuth Flow (startOAuthFlow)
    ↓
Backend OAuth Handler
    ↓
OAuth Provider (Google/GitHub/Facebook)
    ↓
Callback Handler
    ↓
Store Token in Database
    ↓
Redirect to Dashboard
    ↓
Zustand Auth Store
    ↓
Dashboard + Services Tab
```

### Services Tab Flow
```
ServiceConnectors Component
    ↓
Fetch Services (oauth.getStatus)
    ↓
Display ServiceCard Components
    ↓
User clicks Connect/Disconnect
    ↓
Handle OAuth Flow or Revocation
    ↓
Update Services List
    ↓
Re-render UI
```

## API Endpoints

### OAuth Endpoints
```
GET /api/v1/oauth/authorize/:service
  → Returns authUrl for starting OAuth flow

GET /api/v1/oauth/callback/:service?code=...&state=...
  → Handles OAuth callback, stores token, redirects to dashboard

GET /api/v1/oauth/status
  → Returns status of all connected services
  → Requires authentication

POST /api/v1/oauth/disconnect/:service
  → Revokes service access
  → Requires authentication

GET /api/v1/oauth/test/:service
  → Tests if stored token is valid
  → Requires authentication
```

## Troubleshooting

### OAuth Button Not Working
**Check:**
1. Backend server is running on port 4500
2. OAuth credentials are correct in `.env`
3. Redirect URIs match exactly in OAuth provider settings
4. Browser console for JavaScript errors

### Callback Not Redirecting
**Check:**
1. OAuth provider returned valid `code`
2. `state` token matches (CSRF protection)
3. Backend logs for detailed error messages
4. Database connection is working

### Services Not Showing
**Check:**
1. User is authenticated (valid master token)
2. Master token has proper scopes
3. Services are enabled in OAuth config
4. Backend `/api/v1/oauth/status` returns data

## Security Considerations

1. **Token Storage**:
   - Access tokens stored in database (server-side)
   - Session tokens in `sessionStorage` (client-side)
   - Never expose tokens in logs or UI

2. **CSRF Protection**:
   - State token generated for each OAuth flow
   - State token validated on callback
   - Prevents cross-site request forgery

3. **Scope Management**:
   - Each service requests minimal scopes needed
   - Scopes are logged and tracked
   - Users can see what permissions are granted

4. **Token Revocation**:
   - Tokens can be revoked at any time
   - Revocation is logged for audit trail
   - No data leakage on disconnection

## Environment Variables Reference

### Required for OAuth
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### Optional (Default to localhost)
```
GOOGLE_REDIRECT_URI=http://localhost:4500/api/v1/oauth/callback/google
GITHUB_REDIRECT_URI=http://localhost:4500/api/v1/oauth/callback/github
```

## Next Steps

1. ✅ Phase 1: OAuth Integration - COMPLETE
2. ✅ Phase 2: Services/Connectors Tab - COMPLETE
3. 📝 Phase 3: Token Vault - Build token creation and management
4. 📝 Phase 4: Personas - Create AI persona management
5. 📝 Phase 5: Identity - Edit USER.md and SOUL.md
6. 📝 Phase 6: Knowledge Base - Upload and manage documents

## Support

For issues or questions:
1. Check backend logs: `src/logs/`
2. Check browser console for frontend errors
3. Review OAuth provider documentation
4. Check database with: `sqlite3 src/db.sqlite`

---

**Status**: Phase 1 & 2 Complete
**Last Updated**: February 27, 2024
**Version**: 1.0.0
