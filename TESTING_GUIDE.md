# MyApi Dashboard - Testing Guide

## Quick Start Testing

### Prerequisites
- Node.js 18+ installed
- npm/yarn available
- Git configured
- OAuth credentials (optional for testing)

### Setup for Testing

#### 1. Install Dependencies
```bash
cd /opt/MyApi

# Backend
cd src
npm install

# Frontend
cd public/dashboard-app
npm install
```

#### 2. Configure Environment (Optional)
```bash
cd src
cp .env.example .env

# Leave default values or fill in real OAuth credentials
# GOOGLE_CLIENT_ID, GITHUB_CLIENT_ID, FACEBOOK_APP_ID
```

#### 3. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd src
npm run dev
# Should output: Server running on port 4500
```

**Terminal 2 - Frontend:**
```bash
cd src/public/dashboard-app
npm run dev
# Should output: Local: http://localhost:5173
```

---

## Manual Testing Checklist

### Phase 1: OAuth Integration

#### Login Page Appearance
- [ ] Navigate to http://localhost:5173
- [ ] See login page with MyApi branding
- [ ] See 3 OAuth buttons (Google, GitHub, Facebook)
- [ ] See token input field below
- [ ] Dark theme applied
- [ ] Page is responsive (test mobile size)

#### Token-Based Login
- [ ] Create a master token from backend (test flow)
- [ ] Enter token in input field
- [ ] Click "Sign In" button
- [ ] Loading state shows "Verifying..."
- [ ] Success: Redirects to dashboard
- [ ] Can see user is authenticated

#### OAuth Button Styling
- [ ] Google button shows blue color
- [ ] GitHub button shows dark color
- [ ] Facebook button shows blue color
- [ ] Buttons have icons/text
- [ ] Hover effect works
- [ ] Mobile layout: buttons stack vertically

#### Error Handling
- [ ] Enter invalid token
- [ ] Click "Sign In"
- [ ] Error message appears
- [ ] Message is red and clear
- [ ] Can retry with different token

### Phase 2: Services/Connectors Tab

#### Navigation to Services Tab
- [ ] Logged in to dashboard
- [ ] Click "Services" in navigation
- [ ] URL changes to `/dashboard/services`
- [ ] Page loads without errors

#### Services Tab Content
- [ ] Header visible: "Service Connectors"
- [ ] Description visible
- [ ] Loading spinner appears initially
- [ ] Services load after ~1-2 seconds

#### Service Cards Display
- [ ] Each service has a card
- [ ] Card shows service icon
- [ ] Card shows service name
- [ ] Card shows service description
- [ ] Status badge visible (Connected/Disconnected)
- [ ] Cards arranged in grid

#### Connected Services Section
- [ ] Shows services with green badge
- [ ] Displays "Connected" status
- [ ] Shows "Last synced: X ago"
- [ ] Has "Refresh" and "Disconnect" buttons

#### Available Services Section
- [ ] Shows services with amber badge
- [ ] Displays "Disconnected" status
- [ ] Has "Connect" button for each

#### Responsive Layout
- **Desktop (1024px+)**
  - [ ] 3-column grid
  - [ ] Good spacing

- **Tablet (640px-1024px)**
  - [ ] 2-column grid
  - [ ] Readable text

- **Mobile (<640px)**
  - [ ] 1-column grid
  - [ ] Full-width cards
  - [ ] Touch-friendly spacing

#### Empty State
- [ ] If no services configured
- [ ] Shows helpful message
- [ ] Has "Refresh Services" button
- [ ] Styling matches design

#### Loading States
- [ ] Initial load shows spinner
- [ ] After load, spinner gone
- [ ] Smooth transitions

#### Error States
- [ ] Simulate network error
- [ ] Error message appears in red
- [ ] "Try again" button visible
- [ ] Can recover from error

### Service Connection Flow (if OAuth credentials provided)

#### Connect to Service
- [ ] Click "Connect" on a service
- [ ] Redirected to OAuth provider
- [ ] Authorize access
- [ ] Redirected back to dashboard
- [ ] Service status changes to "Connected"
- [ ] Success message shown

#### Disconnect from Service
- [ ] Click "Disconnect" on connected service
- [ ] Modal dialog appears
- [ ] Shows service name
- [ ] Explains consequences
- [ ] Has Cancel and Disconnect buttons
- [ ] Click Disconnect
- [ ] Service revoked
- [ ] Service status changes to "Disconnected"
- [ ] Success message shown

### Dashboard Navigation

#### Layout & Navigation
- [ ] Sidebar visible on desktop
- [ ] Sidebar collapses on mobile
- [ ] Navigation items: Dashboard, Services, Token Vault, Guest Access
- [ ] Active tab highlighted
- [ ] Links work correctly

#### Dashboard Home
- [ ] Stats cards showing (Tokens, Services, Audit Logs)
- [ ] Quick action buttons
- [ ] Getting started guide visible

#### Other Tabs
- [ ] Token Vault loads
- [ ] Guest Access loads
- [ ] No errors in console

### Browser Console

#### No Errors
- [ ] Open DevTools (F12)
- [ ] Go to Console tab
- [ ] No red error messages
- [ ] No warnings about unhandled rejections

#### Network Requests
- [ ] Open DevTools Network tab
- [ ] Load Services page
- [ ] See request to `/api/v1/oauth/status`
- [ ] Response status 200 OK
- [ ] Response contains service data

#### Local Storage
- [ ] Open DevTools Application tab
- [ ] Look at Local Storage
- [ ] See `masterToken` after login
- [ ] See Session Storage with session data

---

## Automated Testing (Development)

### Frontend Build Test
```bash
cd src/public/dashboard-app
npm run build
```
**Expected Output:**
- No errors
- Build completes in ~3 seconds
- `dist/` folder created with files

### ESLint Check (if configured)
```bash
npm run lint
```
**Expected Output:**
- No errors
- No critical warnings

---

## Test Data & Scenarios

### Scenario 1: Fresh User
1. Visit app for first time
2. See login page
3. Enter valid master token
4. See dashboard
5. Services tab shows available services
6. No services connected yet

### Scenario 2: Returning User
1. Master token stored in localStorage
2. Refresh page
3. Automatically logged in (no login page)
4. Dashboard loads directly

### Scenario 3: Invalid Token
1. Enter wrong token
2. Click Sign In
3. Error message appears
4. Can retry

### Scenario 4: Service Management
1. Connect a service (if OAuth available)
2. Service appears in "Connected" section
3. Disconnect service
4. Service moves to "Available" section

### Scenario 5: Error Recovery
1. Simulate network error (DevTools)
2. Error message appears in Services tab
3. Click "Try again"
4. Services load successfully

---

## Performance Testing

### Page Load Time
- [ ] Services tab loads in < 2 seconds
- [ ] Dashboard loads in < 1 second
- [ ] No lag on interaction

### Smooth Interactions
- [ ] Button clicks respond instantly
- [ ] Modal opens smoothly
- [ ] Transitions are fluid
- [ ] No jank or stuttering

### Memory Usage
- [ ] Reasonable memory footprint
- [ ] No memory leaks over time
- [ ] Smooth on low-end devices (if tested)

---

## Accessibility Testing

### Keyboard Navigation
- [ ] Can tab through buttons
- [ ] Can activate buttons with Enter
- [ ] Can close modals with Esc
- [ ] Focus indicators visible

### Screen Reader (optional)
- [ ] Form labels readable
- [ ] Buttons labeled correctly
- [ ] Icons have alt text
- [ ] Status messages announced

### Color Contrast
- [ ] Use axe DevTools
- [ ] No contrast violations
- [ ] WCAG AA compliant

### Responsive Text
- [ ] Text resizable
- [ ] No overflow issues
- [ ] Readable at all sizes

---

## Security Testing

### Token Security
- [ ] Tokens never logged in console
- [ ] Tokens sent only in Authorization header
- [ ] Tokens cleared on logout
- [ ] Session token cleared on tab close

### CSRF Protection
- [ ] State token generated for OAuth
- [ ] State token validated on callback
- [ ] Prevents replay attacks

### Error Messages
- [ ] No sensitive data in errors
- [ ] Error messages are helpful
- [ ] No stack traces exposed

---

## Debugging Tips

### Frontend Console
```javascript
// Check auth store
console.log(useAuthStore.getState())

// Check services store
console.log(useServicesStore.getState())

// Check API client
import { apiClient } from './utils/apiClient'
// View requests in Network tab
```

### Backend Logs
```bash
# Terminal running backend server
# Check output for:
# - OAuth authorize requests
# - Callback requests
# - Error messages

# Database check
sqlite3 db.sqlite
SELECT * FROM oauth_tokens;
SELECT * FROM oauth_status;
```

### Network Requests
- Open DevTools Network tab
- Filter by XHR/Fetch
- Click on requests to see details
- Check Status, Headers, Response

---

## Common Issues & Solutions

### "Blank Page on Load"
- Check console for errors
- Verify backend is running (http://localhost:4500/health)
- Check browser supports ES6 (Chrome 90+)

### "Services Not Loading"
- Verify master token is valid
- Check `/api/v1/oauth/status` endpoint
- Look for CORS errors in console
- Check backend logs

### "OAuth Buttons Not Working"
- Check .env has OAuth credentials
- Verify redirect URIs match OAuth provider settings
- Check OAuth provider allows localhost
- Look at console for auth URL

### "Styling Issues"
- Verify Tailwind CSS compiled (in `<style>`)
- Check no CSS conflicts
- Verify dark mode is enabled
- Clear browser cache

### "Modal Not Closing"
- Check z-index issues
- Verify click handler working
- Check closeRevokeModal is called
- Look for JavaScript errors

---

## Final Checklist

Before marking as complete:

### Functionality
- [ ] Login works (token + OAuth)
- [ ] Services tab loads
- [ ] Services can be connected/disconnected
- [ ] All buttons are responsive
- [ ] Forms submit correctly
- [ ] Modals open/close properly

### User Experience
- [ ] No errors in console
- [ ] Loading states show
- [ ] Error messages are clear
- [ ] Success feedback shown
- [ ] Responsive on all sizes
- [ ] Navigation works

### Code Quality
- [ ] No broken imports
- [ ] No unused variables
- [ ] Proper error handling
- [ ] Clean code structure
- [ ] Comments where needed

### Documentation
- [ ] OAUTH_SETUP_GUIDE.md complete
- [ ] IMPLEMENTATION_COMPLETE.md complete
- [ ] TESTING_GUIDE.md complete
- [ ] Code comments present

### Build & Deployment
- [ ] Frontend builds without errors
- [ ] Production build optimized
- [ ] Environment variables documented
- [ ] Ready for staging/production

---

## Test Report Template

Use this to document your testing:

```markdown
## Testing Report - [Date]

### Tester: [Name]
### Environment: [Browser] [OS]
### Duration: [Hours]

### Functionality Tested
- [ ] OAuth Integration
- [ ] Services Tab
- [ ] Responsive Design
- [ ] Error Handling

### Issues Found
1. [Issue #1]
   - Severity: [High/Medium/Low]
   - Reproduction: [Steps]
   - Fix: [If applicable]

2. [Issue #2]
   - ...

### Overall Status
✅ PASS / ⚠️ PASS WITH ISSUES / ❌ FAIL

### Notes
[Any additional observations]
```

---

## Next Steps

Once testing is complete:
1. ✅ Verify all items in checklist
2. ✅ Document any issues found
3. ✅ Create fixes if needed
4. ✅ Re-test fixes
5. ✅ Mark as ready for deployment

---

**Testing Guide Version**: 1.0.0
**Last Updated**: February 27, 2024
**Status**: Ready for Testing
