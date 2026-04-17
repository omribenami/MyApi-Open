#!/bin/bash
# MyApi Production Deployment Script
# VPS: 65.21.156.211
# Database: SQLite (MongoDB planned for Phase 2)

set -e

echo "🚀 MyApi Production Deployment"
echo "==============================="
echo ""

# Configuration
VPS_IP="65.21.156.211"
VPS_USER="root"
APP_DIR="/root/MyApi"
REPO_URL="https://github.com/omribenami/MyApi-Open.git"
BRANCH="main"

echo "📋 Deployment Configuration:"
echo "   VPS: $VPS_IP"
echo "   Directory: $APP_DIR"
echo "   Branch: $BRANCH"
echo "   Database: SQLite (production-ready)"
echo ""

# Step 1: Push local changes to GitHub
echo "1️⃣  Pushing changes to GitHub..."
cd "${PROJECT_DIR:-.}"
git add -A
git commit -m "Production deployment: SQLite database, all features tested" || echo "No changes to commit"
git push origin main
echo "✅ Code pushed to GitHub"
echo ""

# Step 2: Connect to VPS and deploy
echo "2️⃣  Deploying to VPS..."
ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
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
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@myapiai.com
EMAIL_FROM_NAME=MyApi

# Power User
POWER_USER_EMAIL=your-admin-email@example.com

# OAuth credentials - set real values in the deployment environment before running.
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/github

SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/slack

DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/discord

LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/linkedin

NOTION_CLIENT_ID=your-notion-client-id
NOTION_CLIENT_SECRET=your-notion-client-secret
NOTION_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/notion

FACEBOOK_CLIENT_ID=your-facebook-client-id
FACEBOOK_CLIENT_SECRET=your-facebook-client-secret
FACEBOOK_REDIRECT_URI=https://www.myapiai.com/api/v1/oauth/callback/facebook

# Stripe
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret

# Google Maps
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# OpenAI (optional)
# OPENAI_API_KEY=your-openai-api-key
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
echo "   2. Check logs: ssh root@65.21.156.211 'pm2 logs myapi'"
echo "   3. Update secrets in production .env file"
echo ""
