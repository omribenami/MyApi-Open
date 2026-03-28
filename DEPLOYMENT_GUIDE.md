# MyApi Production Deployment Guide
**VPS:** YOUR_SERVER_IP  
**User:** root  
**Repository:** https://github.com/omribenami/MyApi.git  
**Branch:** main  

## Prerequisites

- SSH access to VPS (root@YOUR_SERVER_IP)
- GitHub repository access
- PM2 installed on VPS
- Node.js v18+ installed

## Deployment Steps

### 1. Connect to VPS

```bash
ssh root@YOUR_SERVER_IP
```

### 2. Navigate to Application Directory

```bash
cd /root/MyApi
```

If the directory doesn't exist:
```bash
git clone https://github.com/omribenami/MyApi.git /root/MyApi
cd /root/MyApi
```

### 3. Pull Latest Code

```bash
git fetch origin
git reset --hard origin/main
git pull origin main
```

### 4. Install Dependencies

```bash
npm install --production
```

### 5. Configure Environment

Check if `.env` exists:
```bash
ls -la .env
```

If not, create it:
```bash
cat > .env << 'EOF'
# MyApi Production Configuration
NODE_ENV=production
PORT=4500

# Database (SQLite - production ready)
DB_PATH=/root/MyApi/data/myapi.db

# Security
SESSION_SECRET=REPLACE_WITH_RANDOM_STRING
ENCRYPTION_KEY=REPLACE_WITH_RANDOM_STRING
VAULT_KEY=REPLACE_WITH_RANDOM_STRING
JWT_SECRET=REPLACE_WITH_RANDOM_STRING

# URLs
BASE_URL=https://www.myapiai.com
PUBLIC_URL=https://www.myapiai.com

# Session Cookie
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_DOMAIN=.myapiai.com

# CORS
CORS_ORIGIN=https://www.myapiai.com

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@myapiai.com
EMAIL_FROM_NAME=MyApi

# Power User
POWER_USER_EMAIL=admin@your.domain.com

# OAuth Credentials
GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=YOUR_GITHUB_CLIENT_SECRET
GITHUB_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/github

SLACK_CLIENT_ID=YOUR_SLACK_CLIENT_ID
SLACK_CLIENT_SECRET=YOUR_SLACK_CLIENT_SECRET
SLACK_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/slack

DISCORD_CLIENT_ID=YOUR_DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET=YOUR_DISCORD_CLIENT_SECRET
DISCORD_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/discord

LINKEDIN_CLIENT_ID=YOUR_LINKEDIN_CLIENT_ID
LINKEDIN_CLIENT_SECRET=YOUR_LINKEDIN_CLIENT_SECRET
LINKEDIN_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/linkedin

NOTION_CLIENT_ID=YOUR_NOTION_CLIENT_ID
NOTION_CLIENT_SECRET=YOUR_NOTION_CLIENT_SECRET
NOTION_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/notion

FACEBOOK_CLIENT_ID=YOUR_FACEBOOK_CLIENT_ID
FACEBOOK_CLIENT_SECRET=YOUR_FACEBOOK_CLIENT_SECRET
FACEBOOK_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/facebook

# Stripe (PostQuee account)
STRIPE_SECRET_KEY=sk_live_REPLACE_WITH_FULL_KEY
STRIPE_PUBLISHABLE_KEY=YOUR_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET

# Google Maps
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
EOF
```

### 6. Create Data Directory

```bash
mkdir -p /root/MyApi/data
```

### 7. Stop Existing Instance

```bash
pm2 stop myapi 2>/dev/null || true
```

Or force kill:
```bash
pkill -f "node.*index.js"
```

### 8. Start Application

```bash
pm2 delete myapi 2>/dev/null || true
pm2 start src/index.js --name myapi --time
pm2 save
```

### 9. Check Status

```bash
pm2 status myapi
pm2 logs myapi --lines 50
```

### 10. Verify Deployment

From VPS:
```bash
curl http://localhost:4500/health
```

From external:
```bash
curl https://www.myapiai.com/health
```

## Post-Deployment Checks

### 1. Health Check
```bash
curl https://www.myapiai.com/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "database": {
    "healthy": true
  }
}
```

### 2. API Discovery
```bash
curl https://www.myapiai.com/api/v1/
```

### 3. Dashboard Access
Open in browser: https://www.myapiai.com/dashboard/

### 4. Check Logs
```bash
ssh root@YOUR_SERVER_IP 'pm2 logs myapi --lines 100'
```

## Troubleshooting

### Port Already in Use
```bash
lsof -i :4500
kill -9 <PID>
pm2 restart myapi
```

### Database Errors
```bash
# Check database file
ls -lh /root/MyApi/data/myapi.db

# Check permissions
chown -R root:root /root/MyApi/data

# Reset if corrupted (WARNING: loses data)
rm /root/MyApi/data/myapi.db
pm2 restart myapi
```

### Environment Variables Missing
```bash
# Check current environment
pm2 show myapi

# Update .env file
nano /root/MyApi/.env

# Restart to apply
pm2 restart myapi
```

### PM2 Not Installed
```bash
npm install -g pm2
```

## Rollback

If deployment fails:
```bash
cd /root/MyApi
git log --oneline -n 5  # Find previous working commit
git reset --hard <commit-hash>
pm2 restart myapi
```

## Monitoring

```bash
# Real-time logs
pm2 logs myapi

# Monitor CPU/memory
pm2 monit

# Process status
pm2 status

# Restart on crash
pm2 startup
pm2 save
```

## Security Notes

1. **Update Secrets**: Replace all `REPLACE_WITH_*` values in `.env`
2. **Generate Random Secrets**:
   ```bash
   openssl rand -hex 32  # For SESSION_SECRET, JWT_SECRET, VAULT_KEY
   ```
3. **Backup Database**: Regularly backup `/root/MyApi/data/myapi.db`
4. **SSL Certificate**: Ensure reverse proxy (nginx/caddy) handles HTTPS

## Success Indicators

✅ `pm2 status myapi` shows "online"  
✅ `curl https://www.myapiai.com/health` returns `{ "status": "ok" }`  
✅ Dashboard loads at https://www.myapiai.com/dashboard/  
✅ No errors in `pm2 logs myapi`  
✅ API responds to authenticated requests  

## Support

If issues persist:
1. Check logs: `pm2 logs myapi --lines 200 --err`
2. Check database: `ls -lh /root/MyApi/data/`
3. Check environment: `pm2 show myapi`
4. Restart: `pm2 restart myapi`
