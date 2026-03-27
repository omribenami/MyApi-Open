# Production Dockerfile for MyApi with MongoDB
FROM node:22

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only, no dev dependencies)
RUN npm install --omit=dev --no-audit

# Copy application code
COPY . .

# Create data directory for any local storage needs
RUN mkdir -p data logs

# Expose port
EXPOSE 4500

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=20s \
  CMD node -e "require('http').get('http://localhost:4500/api/v1/', r => { if (r.statusCode !== 200) throw new Error(r.statusCode) })" || exit 1

# Start application
CMD ["node", "index.js"]
