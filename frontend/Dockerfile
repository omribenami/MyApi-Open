# ============================================================================
# MyApi Frontend Dockerfile (React + Vite)
# ============================================================================
# Multi-stage build for optimal layer caching
# Stage 1: Dependencies + Build
# Stage 2: Production runtime (Nginx - lightweight)
#
# Build: docker build -t myapi-frontend:latest .
# Run:   docker run -p 5173:5173 myapi-frontend:latest
#
# ============================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* yarn.lock* npm-shrinkwrap.json* ./

# Install dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile || npm ci

# Copy source code
COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
COPY public ./public

# Build with Vite
RUN npm run build

# ============================================================================
# Production Stage (Nginx lightweight server)
# ============================================================================
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# For development with Vite preview
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/index.html ./
COPY --from=builder /app/package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${VITE_PORT:-5173} || exit 1

# Signal handler
ENTRYPOINT ["/usr/sbin/dumb-init", "--"]

# Start Vite preview server
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "${VITE_PORT:-5173}"]

EXPOSE ${VITE_PORT:-5173}

# ============================================================================
# Alternative: Use Nginx for truly lightweight production image
# Uncomment the below to use Nginx instead (smaller image, better performance)
# ============================================================================
#
# FROM nginx:alpine
# 
# # Copy built app from builder
# COPY --from=builder /app/dist /usr/share/nginx/html
# 
# # Copy nginx config
# COPY nginx.conf /etc/nginx/conf.d/default.conf
# 
# EXPOSE 5173
# CMD ["nginx", "-g", "daemon off;"]
#
# ============================================================================
