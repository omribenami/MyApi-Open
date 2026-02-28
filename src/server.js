require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { initDatabase } = require('./config/database');
const Vault = require('./vault/vault');
const TokenManager = require('./gateway/tokens');
const AuditLog = require('./gateway/audit');
const PersonalBrain = require('./brain/brain');
const { authenticate } = require('./middleware/auth');
const createApiRoutes = require('./routes/api');
const createManagementRoutes = require('./routes/management');
const logger = require('./utils/logger');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
const dbPath = process.env.DB_PATH || './data/myapi.db';
initDatabase(dbPath);

// Initialize core components
const vault = new Vault(process.env.ENCRYPTION_KEY);
const tokenManager = new TokenManager();
const auditLog = new AuditLog();
const brain = new PersonalBrain(vault, auditLog);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (dashboard)
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// API routes (require authentication)
app.use('/api', authenticate(tokenManager, auditLog), createApiRoutes(brain, vault, tokenManager, auditLog));

// Management routes (require personal token)
app.use('/api/manage', authenticate(tokenManager, auditLog), createManagementRoutes(tokenManager, vault, auditLog));

// Serve dashboard for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error', { error: err.message, stack: err.stack });
  
  auditLog.log({
    action: 'server_error',
    endpoint: req.path,
    method: req.method,
    status: 500,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    details: { error: err.message }
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`MyApi Platform started`, {
    port: PORT,
    environment: process.env.NODE_ENV,
    dbPath
  });
  
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🔐 MyApi Platform - Personal API Gateway           ║
║                                                       ║
║   Server running on: http://localhost:${PORT}         ║
║   Dashboard: http://localhost:${PORT}                 ║
║                                                       ║
║   Components:                                         ║
║   ✓ Vault (Identity & Preferences)                   ║
║   ✓ Gateway (Token Management)                       ║
║   ✓ Personal Brain (Privacy Middleware)              ║
║   ✓ Audit Log (Full Tracking)                        ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
