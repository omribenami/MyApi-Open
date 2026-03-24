# 🐳 MyApi Docker Setup Guide

**Status:** ✅ Production-Ready  
**Created:** 2026-03-24  
**Task:** MYA-1 (Paperclip Phase 6)

---

## 📋 Quick Start (2 minutes)

```bash
# 1. Copy environment template
cp .env.docker .env.local

# 2. Edit with your secrets (database password, API keys, etc.)
vim .env.local

# 3. Start all services (backend, frontend, database)
docker-compose up -d

# 4. Verify services are running
docker-compose ps

# 5. Access the application
# Backend API:  http://localhost:4500/api/health
# Frontend UI:  http://localhost:5173
# Database:     localhost:5432 (myapi:myapi)
```

---

## 📦 What's Included

| Service | Port | Image | Purpose |
|---------|------|-------|---------|
| **PostgreSQL** | 5432 | `postgres:17-alpine` | Primary database, persistent |
| **Backend** | 4500 | `node:22-alpine` + custom build | Node.js API server |
| **Frontend** | 5173 | `node:22-alpine` + Vite | React UI with hot reload |
| **Cloudflare Tunnel** | N/A | `cloudflare/cloudflared` | *Optional* - Public HTTPS access |

---

## 🔧 Configuration

### Environment Variables (`.env.local`)

Copy from `.env.docker` and update these **essential** variables:

```bash
# Database
DB_PASSWORD=your-secure-password-here

# Secrets (generate with: openssl rand -hex 32)
JWT_SECRET=<secure-random-string>
SESSION_SECRET=<secure-random-string>
VAULT_KEY=<secure-random-string>

# OAuth Services (if needed)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Email (if enabling notifications)
SENDGRID_API_KEY=...

# Stripe (if using payments)
STRIPE_SECRET_KEY=...
```

**⚠️ CRITICAL:** 
- **Never commit `.env.local` to git** (already in `.gitignore`)
- **Generate secure secrets** — don't use defaults in production
- **Rotate secrets** when deploying to shared environments

### Port Mapping

If ports 4500, 5173, or 5432 are already in use, override in `.env.local`:

```bash
BACKEND_PORT=4501       # Changed from 4500
FRONTEND_PORT=5174      # Changed from 5173
DB_PORT=5433            # Changed from 5432
```

Then access via new ports:
```bash
curl http://localhost:4501/api/health
open http://localhost:5174
```

---

## 📊 Service Details

### 1. PostgreSQL Database

- **Image:** `postgres:17-alpine` (lightweight, latest stable)
- **User:** myapi (default)
- **Database:** myapi (default)
- **Port:** 5432 (internal), 5432 (exposed)
- **Volume:** `pgdata/` → persists data across restarts
- **Health Check:** Enabled ✅

**Connecting to database:**
```bash
# From host
psql -h localhost -U myapi -d myapi

# From within Docker network
psql -h postgres -U myapi -d myapi

# Using connection string (in code)
postgresql://myapi:myapi@postgres:5432/myapi
```

**Reset database (⚠️ destructive):**
```bash
docker-compose down
docker volume rm myapi_pgdata  # Deletes all data
docker-compose up -d
```

### 2. Backend (Node.js API)

- **Image:** Built from `./backend/Dockerfile`
- **Port:** 4500
- **Framework:** Express.js (typical)
- **Health Check:** GET `/api/health` ✅
- **Volume:** `./backend/data/` → local file storage

**Environment Setup:**
```
DATABASE_URL=postgresql://myapi:${DB_PASSWORD}@postgres:5432/myapi
PORT=4500
JWT_SECRET=<from .env.local>
```

**Logs:**
```bash
docker-compose logs -f backend
```

**Rebuild after code changes:**
```bash
docker-compose build backend
docker-compose up -d backend
```

### 3. Frontend (React + Vite)

- **Image:** Built from `./frontend/Dockerfile`
- **Port:** 5173
- **Framework:** React + Vite (fast, modern)
- **Health Check:** GET `/` returns 200 ✅
- **Dev Mode:** Hot reload enabled (auto-refresh on code change)

**Environment Setup:**
```
VITE_API_URL=http://localhost:4500
VITE_API_BASE_PATH=/api
```

**Access:**
```bash
# Direct
open http://localhost:5173

# Via backend (if configured as proxy)
curl http://localhost:4500/
```

**Rebuild after code changes:**
```bash
docker-compose build frontend
docker-compose up -d frontend
```

---

## 🌍 Public Access (Cloudflare Tunnel)

To expose MyApi to the internet over HTTPS, use Cloudflare Tunnel.

### Setup Steps

1. **Create tunnel at:** https://dash.cloudflare.com/
   - Select domain → Cron-Share (My name) → Create tunnel
   - Name: `myapi-prod` or similar

2. **Get tunnel token:**
   - Copy the auto-generated `TUNNEL_TOKEN`

3. **Save to `.env.local`:**
   ```bash
   CLOUDFLARE_TUNNEL_TOKEN=eyJh...
   ```

4. **Uncomment `cloudflare` service in `docker-compose.yml`:**
   ```yaml
   cloudflare:
     image: cloudflare/cloudflared:latest
     ...
   ```

5. **Restart services:**
   ```bash
   docker-compose up -d
   ```

6. **Verify tunnel is live:**
   ```bash
   docker-compose logs cloudflare | grep "Ready to accept connections"
   ```

7. **Access via Cloudflare domain:**
   ```
   https://myapi.example.com → http://localhost:4500 (backend)
   ```

**Note:** Tunnel routes all traffic through Cloudflare's edge network. Ideal for:
- NAT traversal (no need to expose ports)
- Built-in HTTPS/TLS
- DDoS protection
- Rate limiting

---

## 🏥 Health Checks

All services include automated health checks:

```bash
# View health status
docker-compose ps

# Expected output:
# backend      running (health: starting)
# frontend     running (health: starting)  
# postgres     running (healthy)

# View detailed logs
docker-compose logs postgres | grep healthcheck
```

If a service is **unhealthy**, check logs:
```bash
docker-compose logs <service-name>
```

---

## 🔄 Common Operations

### Stop all services
```bash
docker-compose stop
```

### Start all services
```bash
docker-compose start
```

### Restart a service (e.g., backend)
```bash
docker-compose restart backend
```

### View logs (streaming)
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 50 lines
docker-compose logs --tail 50 backend
```

### Access container shell
```bash
docker-compose exec backend /bin/sh
docker-compose exec frontend /bin/sh
docker-compose exec postgres psql -U myapi
```

### Pull latest base images
```bash
docker-compose pull
docker-compose up -d
```

### Clean up everything (⚠️ destructive)
```bash
docker-compose down -v  # -v removes volumes (data!)
```

---

## ⚠️ Troubleshooting

### Backend can't connect to database
**Error:** `ECONNREFUSED postgres:5432`

**Solution:**
1. Ensure postgres is healthy: `docker-compose ps`
2. Wait 10 seconds and retry (startup delay)
3. Check postgres logs: `docker-compose logs postgres`
4. Verify connection string in `.env.local`

### Frontend can't reach backend
**Error:** `Failed to fetch from http://localhost:4500`

**Solution:**
1. Verify `VITE_API_URL` in `.env.local`
2. Check backend is healthy: `docker-compose ps`
3. Try accessing backend directly: `curl http://localhost:4500/api/health`
4. Check frontend logs: `docker-compose logs frontend`

### Port already in use
**Error:** `bind: address already in use`

**Solution:**
1. Find what's using the port: `lsof -i :4500`
2. Either:
   - Kill the process: `kill -9 <PID>`
   - Change port in `.env.local`: `BACKEND_PORT=4501`

### Database migration fails
**Error:** `Error: unable to execute migrations`

**Solution:**
1. Check if postgres is fully ready: `docker-compose logs postgres | grep "database system is ready"`
2. Wait 30 seconds and retry
3. Manually run migrations: `docker-compose exec backend npm run migrate`

### Out of disk space
**Error:** `no space left on device`

**Solution:**
```bash
# Clean up dangling images/volumes
docker system prune -a --volumes

# Or explicitly remove old images
docker image rm <image-id>
```

---

## 📈 Performance Tuning

### Database Optimization
```yaml
# In docker-compose.yml, add to postgres environment:
environment:
  POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C --max_connections=200"
```

### Backend Memory Limit
```yaml
# Limit backend to 1GB RAM
backend:
  mem_limit: 1g
  memswap_limit: 1g
```

### Frontend Caching
Update `nginx.conf` (if using Nginx):
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## 🔐 Security Notes

1. **Database Password:**
   - Generate strong password: `openssl rand -base64 32`
   - Store in `.env.local` (never in git)

2. **JWT/Session Secrets:**
   - Must be unique per deployment
   - Rotate after key leakage

3. **CORS:**
   - Configure `CORS_ORIGINS` in `.env.local`
   - Only allow trusted domains

4. **Encryption at Rest:**
   - Use `VAULT_KEY` for sensitive data
   - Keep key secure and backed up

5. **Network Isolation:**
   - Services communicate via internal `myapi-network`
   - No direct internet access (except tunnel)

6. **SSL/TLS:**
   - Use Cloudflare Tunnel for automatic HTTPS
   - Or configure nginx as reverse proxy

---

## 📝 Maintenance

### Weekly
- Monitor logs for errors: `docker-compose logs | grep -i error`
- Check disk usage: `docker system df`

### Monthly
- Update base images: `docker-compose pull && docker-compose up -d`
- Back up database: See database backup script below

### Database Backup
```bash
#!/bin/bash
BACKUP_FILE="myapi_backup_$(date +%Y%m%d_%H%M%S).sql"
docker-compose exec -T postgres pg_dump -U myapi myapi > "$BACKUP_FILE"
echo "Backup saved to: $BACKUP_FILE"
```

### Database Restore
```bash
BACKUP_FILE="myapi_backup_20260324_120000.sql"
docker-compose exec -T postgres psql -U myapi myapi < "$BACKUP_FILE"
echo "Restored from: $BACKUP_FILE"
```

---

## 🚀 Deployment Checklist

Before going to production:

- [ ] All `.env.local` secrets are strong (not defaults)
- [ ] Database backups configured
- [ ] Logs are monitored / aggregated
- [ ] Health checks are passing
- [ ] SSL/TLS is enabled (via Cloudflare or nginx)
- [ ] CORS is restricted to trusted domains
- [ ] Rate limiting is configured
- [ ] Database connection pooling tuned
- [ ] Docker images scanned for vulnerabilities
- [ ] Disaster recovery plan documented

---

## 📚 Related Files

- **Configuration:** `.env.docker`, `.env.local` (not in git)
- **Backend Dockerfile:** `./backend/Dockerfile`
- **Frontend Dockerfile:** `./frontend/Dockerfile`
- **Docker Compose:** `./docker-compose.yml`
- **Project Status:** See `HEARTBEAT.md`, `MEMORY.md`

---

## 🎯 Task Status

**MYA-1: Create Docker Compose setup for self-hosted MyApi**

✅ **Completed:**
- docker-compose.yml (production-ready, all 3 services)
- .env.docker (comprehensive template)
- backend/Dockerfile (multi-stage, optimized)
- frontend/Dockerfile (Node.js Vite preview)
- DOCKER_SETUP.md (this guide)

⏳ **Next Steps (Phase 6):**
- Code review by Opus 4.6 (quality check)
- QA testing by Haiku (deployment validation)
- Cloudflare tunnel integration (public access)
- Optional: Nginx production variant

---

**Questions?** Check Docker docs: https://docs.docker.com/  
**Paperclip Link:** http://192.168.1.17:3100 (task MYA-1)  
**Status:** Ready for review → Opus 4.6

