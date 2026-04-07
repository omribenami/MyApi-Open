# Production Dockerfile for MyApi
# Build context: repo root (one level above src/)
FROM node:22-noble

WORKDIR /app

# Copy src/ contents (the actual app)
COPY src/ .

# Stage AFP OAuth binaries if they exist in connectors/
RUN mkdir -p afp-oauth-dist
COPY connectors/afp-oauth/dist/ afp-oauth-dist/

# Install dependencies
RUN npm install --no-audit

# Build frontend (React/Vite dashboard)
RUN cd public/dashboard-app && npm install --no-audit && npm run build

# Ensure directories exist
RUN mkdir -p data logs && chmod -R 755 data logs

# Expose API port
EXPOSE 4500

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=20s \
  CMD node -e "require('http').get('http://localhost:4500/api/v1/', (r) => { if (r.statusCode !== 200) throw new Error(r.statusCode) })" || exit 1

# Start application in production mode
CMD ["node", "index.js"]
