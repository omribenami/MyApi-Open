# MyApi Development Environment

Quick start guide for local development with hot-reload.

## Prerequisites

- Docker + Docker Compose v2
- Node.js 22+ (for local CLI tools, optional if using Docker)
- Git
- MongoDB Atlas account (free tier ok)

## Quick Start (Docker)

### 1. Prepare Environment

```bash
cd /path/to/MyApi
cp .env.docker .env.local
```

### 2. Edit `.env.local`

Add your MongoDB connection string:

```bash
# .env.local
NODE_ENV=development
PORT=4500
DATABASE_URL=mongodb+srv://USER:PASS@cluster.mongodb.net/?appName=MyApi

# Generate these with: openssl rand -hex 32
JWT_SECRET=sk-<your-random-value>
SESSION_SECRET=ss-<your-random-value>
VAULT_KEY=vk-<your-random-value>
ENCRYPTION_KEY=<your-16-byte-hex>
```

### 3. Start Dev Server

```bash
docker-compose -f docker-compose.dev.yml up
```

**Backend running at:** http://localhost:4500/api/v1/

Changes to any file in `src/` will auto-reload (nodemon).

### 4. Frontend Development (Optional)

If you want hot-reload for the React dashboard:

```bash
cd src/public/dashboard-app
npm install
npm run dev
```

**Frontend running at:** http://localhost:5173/

---

## Local Development (No Docker)

If you prefer running Node directly:

```bash
# Install dependencies
npm install

# Create .env.local with your MongoDB URI
cp .env.docker .env.local

# Start with nodemon (hot reload)
npm run dev
```

**Backend at:** http://localhost:4500/api/v1/

---

## Common Tasks

### View Live Logs

```bash
docker-compose -f docker-compose.dev.yml logs -f myapi-dev
```

### Stop Dev Server

```bash
docker-compose -f docker-compose.dev.yml down
```

### Rebuild Docker Image

```bash
docker-compose -f docker-compose.dev.yml build --no-cache
```

### Test API

```bash
curl http://localhost:4500/api/v1/
```

### Access MongoDB

Use MongoDB Compass or mongosh:

```bash
mongosh "mongodb+srv://USER:PASS@cluster.mongodb.net/myapi?authSource=admin"
```

---

## Debugging

### Hot-Reload Not Working?

1. Check nodemon is running: `docker-compose logs myapi-dev | grep nodemon`
2. Verify file is saved (Docker sees changes after ~1 second)
3. Check console for errors

### MongoDB Connection Error?

1. Verify `DATABASE_URL` in `.env.local`
2. Check IP whitelist in MongoDB Atlas
3. Test connection locally: `mongosh "your-uri-here"`

### Port Already in Use?

Change in `.env.local`: `PORT=4501` (or any available port)

---

## Production vs Development

| Aspect | Dev | Prod |
|--------|-----|------|
| **Server** | Node with nodemon | Docker container |
| **Reloads** | Auto on file change | Manual (docker restart) |
| **Database** | MongoDB Atlas (cloud) | MongoDB Atlas (same) |
| **Logs** | Verbose (LOG_LEVEL=debug) | Production format |
| **Security** | Cookies not HTTPS | HTTPS via Cloudflare |

---

## Git Workflow

1. Create a branch: `git checkout -b feature/your-feature`
2. Make changes (they'll auto-reload)
3. Test locally at http://localhost:4500
4. Commit: `git add . && git commit -m "Feature: description"`
5. Push: `git push origin feature/your-feature`
6. Create Pull Request on GitHub

---

## Environment Variables

All available vars in `.env.docker`:

- `NODE_ENV` — development/production
- `PORT` — Server port (default 4500)
- `DATABASE_URL` — MongoDB connection string
- `JWT_SECRET` — Session token signing key
- `SESSION_SECRET` — Session encryption key
- `VAULT_KEY` — Data vault encryption key
- `ENCRYPTION_KEY` — Field-level encryption key

---

## Need Help?

1. Check logs: `docker-compose -f docker-compose.dev.yml logs myapi-dev`
2. Verify `.env.local` has all required vars
3. Ensure MongoDB Atlas IP whitelist includes your machine
4. Test API: `curl http://localhost:4500/health`

---

**Happy coding!** 🚀
