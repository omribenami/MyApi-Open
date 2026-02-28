FROM node:18-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies and rebuild native modules
RUN npm ci --only=production && \
    npm rebuild better-sqlite3

# Copy application code
COPY . .

# Create directories for data and logs
RUN mkdir -p data logs

# Expose the application port
EXPOSE 3001

# Initialize database and start server
CMD ["sh", "-c", "node scripts/init-db.js && node server.js"]
