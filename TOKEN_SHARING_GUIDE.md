# Multi-Device Access - Quick Fix Guide

## Problem
Desktop browser shows empty data while Mobile has your data.

**Why?** Each browser session is separate. You need to log in on BOTH devices as the SAME user.

## Solution: Use Master Token to Access Your Account on Other Devices

### Option 1: Use the Same OAuth Login (Recommended)

**On Desktop:**
1. Go to http://localhost:4500/dashboard/
2. Click "Login" or "Sign In"
3. Choose the SAME service you used on Mobile (Google, GitHub, etc.)
4. Use the SAME email account
5. Approve the login

→ This will automatically access your same account on Desktop.

### Option 2: Use Master Token (If OAuth Doesn't Work)

**On Mobile (source device):**
1. Go to Settings → Access Tokens
2. Find your "Master Token" (marked as session)
3. Copy it

**On Desktop (new device):**
1. Go to http://localhost:4500/api/v1/auth/token-login
2. Send a POST request with your token:
   ```bash
   curl -X POST http://localhost:4500/api/v1/auth/token-login \
     -H "Content-Type: application/json" \
     -d '{"token": "your-master-token-here"}'
   ```
3. Refresh http://localhost:4500/dashboard/
4. You should see the same data as Mobile

---

## How It Works

✅ **Persistent User Accounts:**
- Each user has ONE account in the database
- Your email/OAuth identity is unique
- All your data is tied to YOUR user ID, not the device

✅ **Cross-Device Access:**
- Use the same OAuth login on any device → same account
- OR use your Master Token to access your account from anywhere
- Mobile, Desktop, tablet, etc. all see the SAME data

✅ **Master Token:**
- Personal API token tied to your account
- Works on any device
- Can be shared with AI agents/scripts for API access

---

## Why This Fix Works

**Before (broken):**
```
Mobile → OAuth → User A created → Data for User A
Desktop → Fresh session → User B created (empty) → No data
```

**After (fixed):**
```
Mobile → OAuth → User A → Data for User A
Desktop → OAuth (same email) → User A → Data for User A (same!)
        OR
Desktop → Master Token → User A → Data for User A (same!)
```

---

## Next Steps

**For production, we need:**
1. ✅ Persistent user accounts (DONE)
2. ✅ Login endpoints (DONE)
3. ⏳ Login UI on dashboard (showing master token, token login form)
4. ⏳ User registration form
5. ⏳ Token management in Settings

---

**Try Option 1 first** - log in on Desktop with the same OAuth service.
If that doesn't work, use Option 2 with the master token.

Report back which one works!
