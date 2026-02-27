# 🚀 MyApi Dashboard - Quick Start

## ⚡ 5-Minute Setup

### 1. Start the Server
```bash
cd /opt/MyApi/src
node index.js
```

### 2. Save Your Master Token
The server will print:
```
=== MyApi Dashboard Started ===
Master Token (SAVE THIS): 9ff89b2d70bdbe1ce9a72f63f5c32b528509ff27d0b16307e8ce43a7abc5e7ca
Listening on port 4500
Dashboard: http://localhost:4500/dashboard/
==============================
```

**⚠️ COPY AND SAVE THIS TOKEN! It won't be shown again.**

### 3. Access the Dashboard
Open in your browser:
```
http://localhost:4500/dashboard/
```

### 4. Log In
Paste your master token and click "Sign in"

## 🎯 What You Can Do Now

### 1️⃣ Connect Services
- Go to **Connectors** tab
- Click "Connect" on GitHub, Google, Calendar, etc.
- Mock OAuth flow stores "connected: true" status

### 2️⃣ Store External API Tokens
- Go to **Token Vault** tab
- Click "+ Add Token"
- Add your OpenAI, GitHub, or other API keys
- They're encrypted before storage!

### 3️⃣ Generate Guest Tokens
- Go to **Guest Access** tab
- Click "+ Generate Token"
- Choose scopes (read, professional, availability)
- Set expiration time
- Copy the generated token

### 4️⃣ Use the API
```bash
# Example: Get your identity
curl -H "Authorization: Bearer YOUR_MASTER_TOKEN" \
  http://localhost:4500/api/v1/identity
```

## 📊 Current Master Token

If the server is currently running, your master token is:
```
9ff89b2d70bdbe1ce9a72f63f5c32b528509ff27d0b16307e8ce43a7abc5e7ca
```

## 🆘 Lost Your Token?

1. Stop the server
2. Delete `src/db.sqlite`
3. Restart the server
4. A new master token will be generated

## 🔧 Rebuild Frontend

If you make changes to the React app:
```bash
cd /opt/MyApi/src/public/dashboard-app
npm run build
```

## 📱 Access From Network

The server runs on `http://localhost:4500` by default.

To access from other devices on your network:
1. Find your machine's IP: `ip addr show` or `ifconfig`
2. Access: `http://YOUR_IP:4500/dashboard/`

## 🎉 You're Ready!

Enjoy your personal API platform with a beautiful dashboard!

For full documentation, see `README.md`
