# MyApi OAuth Connection Flow - Testing Guide

## Overview
This guide walks through testing the newly fixed OAuth connection flow for all services in the MyApi dashboard.

## Pre-requisites
- MyApi backend running on `http://localhost:4500`
- Dashboard frontend running on `http://localhost:5173` (or your configured port)
- Browser with developer tools open

## Test Scenarios

### Scenario 1: Connect Google Analytics Service

**Steps:**
1. Open browser to `http://localhost:5173/dashboard/services`
2. Find "Google Analytics" service card
3. Click "Connect" button
4. **Expected Result**: Browser redirects to Google OAuth login page

**What Should NOT Happen:**
- ❌ Error message "Failed to connect google. Please try again"
- ❌ No page load/redirect
- ❌ Browser stays on dashboard

**Browser Console Checks:**
- Check for logs: `[OAuth] Starting OAuth flow for: google`
- Check for logs: `[OAuth] Redirecting to: /api/v1/oauth/authorize/google`
- No error messages in console

**Server Logs Should Show:**
```
[OAuth] authorize/google requested
[OAuth] Mode: connect
[OAuth] Available services: google, github, slack, discord, ...
[OAuth] Redirecting to google OAuth provider at: https://accounts.google.com/o/oauth2/v2/auth
```

### Scenario 2: Connect GitHub Service

**Steps:**
1. Open browser to `http://localhost:5173/dashboard/services`
2. Find "GitHub" service card
3. Click "Connect" button
4. **Expected Result**: Browser redirects to GitHub OAuth login page

**Verification:**
- Check the URL includes `https://github.com/login/oauth/authorize?`
- Proper client_id is in the URL
- Redirect URI points to `myapiai.com/api/v1/oauth/callback/github`

### Scenario 3: Connect Gmail Service (Google OAuth Provider)

**Steps:**
1. Open browser to `http://localhost:5173/dashboard/services`
2. Find "Gmail" or similar Google service
3. Click "Connect" button
4. **Expected Result**: Browser redirects to Google OAuth login page (same provider as Google Analytics)

**Important**: Both "Gmail" and "Google Analytics" should use the same "google" OAuth provider

### Scenario 4: Test Error Handling

**Test Invalid Service Name:**
```bash
curl -s 'http://localhost:4500/api/v1/oauth/authorize/invalidservice' | jq .
```

**Expected Response:**
```json
{
  "error": "Service \"invalidservice\" not supported",
  "availableServices": ["google", "github", "slack", ...],
  "message": "The service \"invalidservice\" is not available for OAuth..."
}
```

### Scenario 5: Test Service Status Endpoint

**Command:**
```bash
curl -s 'http://localhost:4500/api/v1/oauth/status' | jq '.services[] | {name, enabled, status}'
```

**Expected Output:**
```json
{
  "name": "google",
  "enabled": true,
  "status": "disconnected"  // or "connected" if already connected
}
```

**Verify:**
- All configured OAuth services show `"enabled": true`
- Unconfigured services show `"enabled": false`
- Status accurately reflects connection state

### Scenario 6: Test OAuth Callback

**Steps:**
1. Start connection flow for Google
2. Log in with Google account
3. Check browser URL for callback parameters
4. **Expected**: Redirects to `/dashboard/?oauth_service=google&oauth_status=connected`

**Server Should Log:**
```
oauth_callback_success
Service successfully connected and token stored
```

### Scenario 7: Test Disconnect/Revoke

**Steps:**
1. After connecting a service, it should show "Disconnect" button
2. Click "Disconnect"
3. **Expected**: Service status changes to "Disconnected"
4. Connect button reappears

## Debugging Tips

### Enable Verbose Logging
Add to ServiceConnectors.jsx for more detailed logs:
```javascript
console.log(`[Debug] Service mapping: ${service.name} => ${getOAuthProvider(service.name)}`);
```

### Check Browser LocalStorage
```javascript
// In browser console:
console.log(sessionStorage.getItem('oauth_service'));
console.log(sessionStorage.getItem('oauth_mode'));
console.log(sessionStorage.getItem('oauth_returnTo'));
```

### Monitor Network Requests
1. Open DevTools → Network tab
2. Look for request to `/api/v1/oauth/authorize/{service}`
3. Check response status (should be 302 Found)
4. Check Location header for OAuth provider URL

### Server Log Analysis
```bash
# Watch server logs
tail -f /tmp/myapi.log | grep OAuth

# Or use jq to parse JSON responses
curl -s 'http://localhost:4500/api/v1/oauth/authorize/invalidservice' | jq '.error'
```

## Service to OAuth Provider Mapping Test

**Verify mapping is working:**

| Service Name | OAuth Provider | Expected Redirect |
|---|---|---|
| google | google | https://accounts.google.com/o/oauth2/v2/auth |
| googleanalytics | google | https://accounts.google.com/o/oauth2/v2/auth |
| gmail | google | https://accounts.google.com/o/oauth2/v2/auth |
| github | github | https://github.com/login/oauth/authorize |
| slack | slack | https://slack.com/oauth_authorize |
| discord | discord | https://discord.com/api/oauth2/authorize |
| facebook | facebook | https://www.facebook.com/v19.0/dialog/oauth |
| twitter | twitter | https://twitter.com/i/oauth2/authorize |
| reddit | reddit | https://www.reddit.com/api/v1/authorize |
| linkedin | linkedin | https://www.linkedin.com/oauth/v2/authorization |

## Common Issues and Solutions

### Issue: "Failed to connect google. Please try again"
**Cause**: Service name not mapped to OAuth provider
**Solution**: Check that `getOAuthProvider()` is being called before `startOAuthFlow()`

### Issue: "Service 'xxx' not supported"
**Cause**: Frontend is passing service name instead of OAuth provider name
**Solution**: Verify `oauthProviderMap.js` contains the service mapping

### Issue: Redirects to `/dashboard/?oauth_service=...&oauth_status=error`
**Cause**: OAuth provider configuration missing or service not enabled
**Solution**: Check `.env` file for OAuth credentials (GOOGLE_CLIENT_ID, etc.)

### Issue: OAuth provider doesn't recognize redirect URI
**Cause**: Redirect URI in env doesn't match provider configuration
**Solution**: Verify redirect URIs in provider's settings match `REDIRECT_URI` env vars

## Integration Testing Checklist

- [ ] Google OAuth flow completes and returns auth code
- [ ] GitHub OAuth flow completes and returns auth code  
- [ ] Facebook OAuth flow completes and returns auth code
- [ ] Twitter OAuth flow completes and returns auth code
- [ ] LinkedIn OAuth flow completes and returns auth code
- [ ] Service shows "Connected" status after OAuth completion
- [ ] Disconnect button appears for connected services
- [ ] Revoke disconnects service properly
- [ ] Error handling shows clear messages for misconfiguration
- [ ] Multiple services can be connected independently
- [ ] Service status is preserved across page reloads

## Performance Metrics

Monitor these during testing:
- Time to redirect to OAuth provider: < 500ms
- Time to complete OAuth callback: < 1 second
- Dashboard responsiveness after connection: Smooth, no lag
- Service list loads in < 2 seconds

## Rollout Checklist

Before deploying to production:
- [ ] All OAuth provider credentials are valid
- [ ] Redirect URIs match production domain
- [ ] Database migrations are applied
- [ ] Frontend build completes without errors
- [ ] All integration tests pass
- [ ] Error messages are clear and helpful
- [ ] Logging is configured appropriately
- [ ] Rate limiting is configured
- [ ] HTTPS is enforced in production

## Support and Troubleshooting

For issues:
1. Check server logs: `tail -f /tmp/myapi.log`
2. Check browser console for errors
3. Verify OAuth provider configuration in `.env`
4. Run diagnostic test: `curl -s http://localhost:4500/api/v1/oauth/status | jq .`
5. Review OAUTH_FIX_SUMMARY.md for detailed technical changes
