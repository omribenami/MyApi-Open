/**
 * PM2 Ecosystem Configuration
 * Supports both development and production environments
 * 
 * Usage:
 *   Development:  pm2 start ecosystem.config.js --env development
 *   Production:   pm2 start ecosystem.config.js --env production
 *   Docker:       Use docker-compose.yml (PM2 optional for bare-metal)
 */

module.exports = {
  apps: [
    {
      // Application identifier
      name: 'myapi-platform',
      
      // Entry point
      script: './index.js',
      
      // Working directory
      cwd: __dirname,
      
      // Instance mode for clustering
      instances: 'max',
      exec_mode: 'cluster',
      
      // Environment variables per environment
      env: {
        development: {
          NODE_ENV: 'development',
          PORT: 4500,
        },
        production: {
          NODE_ENV: 'production',
          PORT: 4500,
        }
      },
      
      // Error and output logs
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      watch: ['index.js', 'routes/', 'middleware/', 'utils/'],  // Set to false in production
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'logs', 'data', '.git'],
      max_memory_restart: '512M',
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      
      // Crash restart settings
      max_restarts: 10,
      min_uptime: '10s',
      
      // Process naming and versioning
      instance_var: 'INSTANCE_ID',
      
      // Arguments (if needed)
      args: '',
      
      // Node arguments
      node_args: '--max-old-space-size=512',
      
      // Merge logs from cluster
      merge_logs: true,
      
      // Autorestart on file changes (optional)
      // watch: true,
      // ignore_watch: ['node_modules', 'logs', 'data'],
      
      // Execution mode: 'cluster' for multi-core, 'fork' for single
      // Currently set to cluster for better resource utilization
    },
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'node',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/myapi.git',
      path: '/opt/myapi',
      'post-deploy': 'npm ci && npm run build:frontend && pm2 start ecosystem.config.js --env production --update-env',
      'pre-deploy-local': 'echo "Deploying to production server..."'
    },
    development: {
      user: 'node',
      host: 'your-dev-server.com',
      ref: 'origin/develop',
      repo: 'https://github.com/yourusername/myapi.git',
      path: '/opt/myapi-dev',
      'post-deploy': 'npm ci && npm run build:frontend && pm2 start ecosystem.config.js --env development --update-env'
    }
  }
};

/**
 * QUICK START GUIDE
 * 
 * 1. Install PM2 globally:
 *    npm install -g pm2
 * 
 * 2. Start in development:
 *    pm2 start ecosystem.config.js --env development
 * 
 * 3. Start in production:
 *    pm2 start ecosystem.config.js --env production
 * 
 * 4. View logs:
 *    pm2 logs myapi-platform
 * 
 * 5. Monitor processes:
 *    pm2 monit
 * 
 * 6. Restart all instances:
 *    pm2 restart myapi-platform
 * 
 * 7. Stop all instances:
 *    pm2 stop myapi-platform
 * 
 * 8. Delete from PM2:
 *    pm2 delete myapi-platform
 * 
 * 9. Set up auto-startup:
 *    pm2 startup
 *    pm2 save
 * 
 * 10. For Docker deployment:
 *     Use docker-compose.yml instead of PM2
 *     PM2 is available for bare-metal deployments
 * 
 * CLUSTERING:
 * - exec_mode: 'cluster' enables multi-core clustering
 * - instances: 'max' will use all available CPU cores
 * - Set to a specific number (e.g., instances: 2) if desired
 * 
 * NOTES:
 * - In development, use `npm run dev` with nodemon instead
 * - In Docker, use docker-compose.yml with dumb-init for signal handling
 * - PM2 is optional for Docker environments (already handled by dumb-init)
 * - For production on bare metal, PM2 provides excellent process management
 */
