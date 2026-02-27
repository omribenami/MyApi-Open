# OAuth 2.0 Testing Guide

This guide covers testing the OAuth 2.0 connector proxying implementation for MyApi Phase 7.

## Quick Test (No Real Credentials)

You can test the OAuth endpoints without real credentials:

```bash
# Test Google OAuth authorize endpoint
curl http://localhost:4500/api/v1/oauth/authorize/google

# Response:
# {
#   "ok": true,
#   "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
#   "state": "..."
# }
```

## Setting Up Real OAuth Credentials

To test with real OAuth flows, you need credentials from each service:

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Google+ API"
4. Create OAuth 2.0 credentials (Web Application)
5. Add `http://localhost:4500/api/v1/oauth/callback/google` to Authorized redirect URIs
6. Set environment variables:
   ```bash
   export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   export GOOGLE_CLIENT_SECRET="your-client-secret"
   export GOOGLE_REDIRECT_URI="http://localhost:4500/api/v1/oauth/callback/google"
   ```

### GitHub OAuth Setup
1. Go to Settings → Developer settings → OAuth Apps
2. Create a new OAuth App
3. Set `http://localhost:4500/api/v1/oauth/callback/github` as Authorization callback URL
4. Set environment variables:
   ```bash
   export GITHUB_CLIENT_ID="your-client-id"
   export GITHUB_CLIENT_SECRET="your-client-secret"
   export GITHUB_REDIRECT_URI="http://localhost:4500/api/v1/oauth/callback/github"
   ```

### Slack OAuth Setup
1. Go to [Slack API Dashboard](https://api.slack.com/apps)
2. Create a new app
3. Go to OAuth & Permissions
4. Set `http://localhost:4500/api/v1/oauth/callback/slack` as Redirect URL
5. Add scopes: `chat:write`, `channels:read`, `users:read`
6. Set environment variables:
   ```bash
   export SLACK_CLIENT_ID="your-client-id"
   export SLACK_CLIENT_SECRET="your-client-secret"
   export SLACK_REDIRECT_URI="http://localhost:4500/api/v1/oauth/callback/slack"
   ```

### Discord OAuth Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to OAuth2 → General
4. Set `http://localhost:4500/api/v1/oauth/callback/discord` as Redirect URL
5. Add scopes: `identify`, `email`, `guilds`
6. Set environment variables:
   ```bash
   export DISCORD_CLIENT_ID="your-client-id"
   export DISCORD_CLIENT_SECRET="your-client-secret"
   export DISCORD_REDIRECT_URI="http://localhost:4500/api/v1/oauth/callback/discord"
   ```

### WhatsApp Business API Setup
1. Get approval for WhatsApp Business API access
2. Create a Business Account
3. Generate API token from Meta Business Suite
4. Set environment variables:
   ```bash
   export WHATSAPP_BUSINESS_ACCOUNT_ID="your-business-account-id"
   export WHATSAPP_API_TOKEN="your-api-token"
   export WHATSAPP_WEBHOOK_TOKEN="your-webhook-token"
   ```

## Running the Server with OAuth Credentials

```bash
cd /opt/MyApi/src

# Set all environment variables
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
export GOOGLE_REDIRECT_URI="http://localhost:4500/api/v1/oauth/callback/google"
# ... (repeat for other services)

# Start the server
node index.js
```

## Testing the OAuth Flow

### 1. Get OAuth Status
```bash
# Get the master token from server startup logs
MASTER_TOKEN="your-master-token"

# Check connected services
curl -H "Authorization: Bearer $MASTER_TOKEN" \
  http://localhost:4500/api/v1/oauth/status
```

### 2. Start OAuth Flow
```bash
# Get authorization URL for Google
curl -H "Authorization: Bearer $MASTER_TOKEN" \
  http://localhost:4500/api/v1/oauth/authorize/google

# Response:
# {
#   "ok": true,
#   "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
#   "state": "..."
# }

# Open the authUrl in your browser
# After approving, you'll be redirected to the callback endpoint
```

### 3. Verify Token Storage
```bash
# Test if token is valid
curl -H "Authorization: Bearer $MASTER_TOKEN" \
  http://localhost:4500/api/v1/oauth/test/google

# Response:
# {
#   "service": "google",
#   "valid": true,
#   "error": null,
#   "data": { ... }
# }
```

### 4. Disconnect OAuth Service
```bash
# Revoke the OAuth token
curl -X POST \
  -H "Authorization: Bearer $MASTER_TOKEN" \
  http://localhost:4500/api/v1/oauth/disconnect/google

# Response:
# {
#   "ok": true,
#   "message": "Successfully disconnected google"
# }
```

## Testing Token Encryption

The OAuth tokens are encrypted using AES-256-GCM at rest. To verify encryption:

1. Check the database:
   ```bash
   cd /opt/MyApi/src
   sqlite3 db.sqlite "SELECT id, service_name, access_token FROM oauth_tokens LIMIT 1;"
   ```

2. The `access_token` column should contain a JSON object with encrypted data:
   ```json
   {
     "encrypted": "hex-encoded-encrypted-data",
     "iv": "hex-encoded-initialization-vector",
     "authTag": "hex-encoded-authentication-tag"
   }
   ```

3. Tokens are decrypted on retrieval via the `getOAuthToken()` function

## Audit Logging

All OAuth operations are logged:

```bash
# View audit logs
curl -H "Authorization: Bearer $MASTER_TOKEN" \
  http://localhost:4500/api/v1/audit | jq '.logs | .[] | select(.action | contains("oauth"))'
```

Logged events:
- `oauth_authorize_start` - User initiates OAuth flow
- `oauth_callback_success` - Token successfully exchanged and stored
- `oauth_callback_error` - OAuth callback error
- `oauth_disconnect` - User disconnects OAuth service
- `oauth_test` - Token validity check

## State Token CSRF Protection

State tokens are generated for each OAuth flow and validated on callback:

1. **Generation**: `POST /api/v1/oauth/authorize/:service`
   - Creates a random 32-byte state token
   - Stores in database with 10-minute expiration
   - Returns state to client

2. **Validation**: `GET /api/v1/oauth/callback/:service?code=...&state=...`
   - Validates state token exists and hasn't expired
   - Checks against service name
   - One-time use: token deleted after validation
   - If invalid, callback is rejected with error

## Troubleshooting

### "Invalid or expired state token"
- State tokens expire after 10 minutes
- Each state token can only be used once
- Ensure state parameter matches the one from authorize request

### "OAuth service is not enabled"
- Check `config/oauth.json`
- Some services are disabled by default (e.g., WhatsApp)
- Set `"enabled": true` in config for the service

### "Missing authorization code"
- The OAuth provider didn't return an auth code
- Check that redirect URI matches the one registered with the provider

### "Token validation failed"
- Token may have expired
- OAuth credentials in environment variables may be incorrect
- The remote service API may be unreachable

## Security Notes

1. **Environment Variables**: Never commit OAuth credentials to git. Use `.env` file or system environment variables.

2. **Token Encryption**: All tokens are encrypted using AES-256-GCM before storage.

3. **HTTPS in Production**: Always use HTTPS in production to protect tokens in transit.

4. **Token Expiration**: Implement token refresh logic for services that provide refresh tokens.

5. **Rate Limiting**: Callback endpoints are rate-limited to prevent brute force attacks.

6. **Audit Trail**: All OAuth operations are logged for compliance and debugging.

## Mock OAuth for Testing

If you don't have real OAuth credentials, you can:

1. Test the endpoints without authentication to verify they exist
2. Test the database functions directly in Node.js REPL
3. Use the audit logs to verify the flow logic
4. Mock HTTP responses in unit tests

Example mock test:

```javascript
// In a test file
const GoogleAdapter = require('./services/google-adapter');

const adapter = new GoogleAdapter({
  clientId: 'test-id',
  clientSecret: 'test-secret',
  redirectUri: 'http://localhost:4500/api/v1/oauth/callback/google'
});

const authUrl = adapter.getAuthorizationUrl('mock-state-token');
console.log('Auth URL:', authUrl);
// Should output a valid Google OAuth URL with test credentials
```

## References

- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [Slack OAuth](https://api.slack.com/authentication/oauth-v2)
- [Discord OAuth](https://discord.com/developers/docs/topics/oauth2)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
