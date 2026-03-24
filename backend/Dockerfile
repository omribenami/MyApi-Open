# ============================================================================
# MyApi Backend Dockerfile
# ============================================================================
# Multi-stage build for Node.js backend
# Stage 1: Dependencies + Build
# Stage 2: Production runtime (optimized)
#
# Build: docker build -t myapi-backend:latest .
# Run:   docker run --env-file .env.local -p 4500:4500 myapi-backend:latest
#
# ============================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* yarn.lock* npm-shrinkwrap.json* ./

# Install dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile || npm ci

# Copy source
COPY src ./src
COPY tsconfig.json* ./
COPY .env.example* ./

# Build (if TypeScript)
RUN npm run build || true

# ============================================================================
# Production Stage
# ============================================================================
FROM node:22-alpine

WORKDIR /app

# Install dumb-init (proper signal handling in container)
RUN apk add --no-cache dumb-init curl

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create data directory for local persistence
RUN mkdir -p /app/data && \
    chown -R nodejs:nodejs /app

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-4500}/api/health || exit 1

# Signal handler
ENTRYPOINT ["/usr/sbin/dumb-init", "--"]

# Start command
CMD ["node", "dist/index.js"]

EXPOSE ${PORT:-4500}
