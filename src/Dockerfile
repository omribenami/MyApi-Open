# Build stage
FROM node:22-alpine as builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev) for build
RUN npm ci

# Build/compile native modules (if needed)
RUN npm rebuild better-sqlite3

# Copy frontend package files and install frontend dependencies
COPY public/dashboard-app/package*.json ./public/dashboard-app/
RUN cd public/dashboard-app && npm ci

# Copy application code
COPY . .

# Build the React/Vite frontend (outputs to public/dist/)
RUN npm run build:frontend

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    dumb-init

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY --chown=node:node . .

# Copy built frontend assets from builder (public/dist/ is excluded from COPY . . via .dockerignore)
COPY --from=builder --chown=node:node /app/public/dist ./public/dist

# Create directories for data and logs
RUN mkdir -p data logs && \
    chown -R node:node /app

# Use non-root user
USER node

# Expose the application port
EXPOSE 4500

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4500/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to properly handle signals
ENTRYPOINT ["/sbin/dumb-init", "--"]

# Initialize database and start server
CMD ["sh", "-c", "node scripts/init-db.js && node index.js"]
