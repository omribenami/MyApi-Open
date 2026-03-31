# Production Dockerfile for MyApi with MongoDB
FROM node:22

WORKDIR /app

# Copy ALL files from root context
COPY . .

# Install dependencies
RUN npm install --no-audit

# Build frontend (React/Vite dashboard)
RUN cd src/public/dashboard-app && npm run build

# Ensure directories exist
RUN mkdir -p data logs && chmod -R 755 data logs

# Expose API port
EXPOSE 4500

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=20s \
  CMD node -e "require('http').get('http://localhost:4500/api/v1/', (r) => { if (r.statusCode !== 200) throw new Error(r.statusCode) })" || exit 1

# Start application in production mode
CMD ["node", "src/index.js"]
