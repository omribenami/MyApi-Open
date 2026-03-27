# Production Dockerfile for MyApi with MongoDB
FROM node:22

WORKDIR /app

# Install dependencies first (before copying code, for better caching)
# Copy both package.json and package-lock.json
COPY package.json package-lock.json ./

# Install all dependencies (force refresh to bypass lock file issues)
RUN npm cache clean --force && npm install --legacy-peer-deps --no-audit

# Copy entire application code
COPY . .

# Ensure directories exist
RUN mkdir -p data logs && chmod -R 755 data logs

# Expose API port
EXPOSE 4500

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=20s \
  CMD node -e "require('http').get('http://localhost:4500/api/v1/', (r) => { if (r.statusCode !== 200) throw new Error(r.statusCode) })" || exit 1

# Start application in production mode
CMD ["node", "index.js"]
