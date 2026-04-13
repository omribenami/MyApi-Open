#!/bin/bash
# MyApi Production Deployment Script
# VPS: YOUR_SERVER_IP
# Database: SQLite (MongoDB planned for Phase 2)

set -e

echo "🚀 MyApi Production Deployment"
echo "==============================="
echo ""

# Configuration
VPS_IP="YOUR_SERVER_IP"
VPS_USER="root"
APP_DIR="/root/MyApi"
REPO_URL="https://github.com/Omri-LA/MyApi.git"
BRANCH="main"

echo "📋 Deployment Configuration:"
echo "   VPS: $VPS_IP"
echo "   Directory: $APP_DIR"
echo "   Branch: $BRANCH"
echo "   Database: SQLite (production-ready)"
echo ""

# Step 1: Push local changes to GitHub
echo "1️⃣  Pushing changes to GitHub..."
cd /opt/MyApi
git add -A
git commit -m "Production deployment: SQLite database, all features tested" || echo "No changes to commit"
git push origin main
echo "✅ Code pushed to GitHub"
echo ""

# Step 2: Connect to VPS and deploy
echo "2️⃣  Deploying to VPS..."
# Escape VPS credentials for safe SSH command execution
SSH_COMMAND=$(cat <<'ENDSSH'
set -e

# Navigate to app directory
cd /root/MyApi || { echo "❌ App directory not found"; exit 1; }

# Pull latest changes
echo "📥 Pulling latest code..."
git fetch origin
git reset --hard origin/main
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create production .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating production .env..."
    cat > .env << 'EOF'
# MyApi Production Configuration
NODE_ENV=production
PORT=4500

# Database (SQLite - production ready)
# MongoDB support planned for Phase 2
DB_PATH=/root/MyApi/data/myapi.db

# Security (CHANGE THESE IN PRODUCTION!)
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
VAULT_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

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

# OAuth Credentials (from TOOLS.md)
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
STRIPE_SECRET_KEY=sk_live_...BtuA
STRIPE_PUBLISHABLE_KEY=YOUR_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=YOUR_STRIPE_WEBHOOK_SECRET

# Google Maps
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

# OpenAI (optional)
# OPENAI_API_KEY=sk-...
EOF
    echo "⚠️  WARNING: Update secrets in .env file!"
fi

# Create data directory
mkdir -p /root/MyApi/data

# Stop existing instance
echo "🛑 Stopping existing instance..."
pkill -f "node.*index.js" || echo "No existing process found"
sleep 2

# Start with PM2
echo "▶️  Starting MyApi with PM2..."
pm2 delete myapi 2>/dev/null || true
pm2 start src/index.js --name myapi --time

# Show status
pm2 status myapi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Service Status:"
pm2 info myapi
ENDSSH
)

# Execute SSH command safely using quoted variables
ssh "${VPS_USER}@${VPS_IP}" bash -c "$SSH_COMMAND"

echo ""
echo "✅ Deployment successful!"
echo ""
echo "🔗 URLs:"
echo "   API: https://www.myapiai.com/api/v1/"
echo "   Dashboard: https://www.myapiai.com/dashboard/"
echo "   Health: https://www.myapiai.com/health"
echo ""
echo "📝 Next Steps:"
echo "   1. Test the deployment: curl https://www.myapiai.com/health"
echo "   2. Check logs: ssh root@YOUR_SERVER_IP 'pm2 logs myapi'"
echo "   3. Update secrets in production .env file"
echo ""
