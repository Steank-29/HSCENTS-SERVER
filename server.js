const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const os = require('os');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Route files
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const contactRoutes = require('./routes/contactRoutes');
const couponRoutes = require('./routes/couponRoutes');
const offerRoutes = require('./routes/offerRoutes');
const orderRoutes = require('./routes/orderRoutes');

const app = express();

// ======================
// PRODUCTION OPTIMIZATIONS
// ======================

// Enable compression for better performance
app.use(compression());

// Body parser with increased limit for images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy (important for Render)
app.set('trust proxy', 1);

// CORS configuration for production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5050', 'https://www.hamdiscents.com', 'http://www.hamdiscents.com','https://hamdiscents.com','http://hamdiscents.com', process.env.CLIENT_URL];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:", "http:", "*.cloudinary.com"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Production logging (less verbose)
  app.use(morgan('combined', {
    skip: (req, res) => req.path === '/health' || req.path === '/api/health'
  }));
}

// Rate limiting with different limits for different endpoints
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute (changed from 1 hour)
  max: 100, // 100 requests per minute (changed from 5)
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' // Skip rate limiting for GET requests (viewing messages/stats)
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute (changed from 1 hour)
  max: 100, // 100 requests per minute (changed from 5)
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' // Skip rate limiting for GET requests (viewing messages/stats)
});

const contactLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute (changed from 1 hour)
  max: 100, // 100 requests per minute (changed from 5)
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' // Skip rate limiting for GET requests (viewing messages/stats)
});

// Apply rate limiting to specific routes
app.use('/api/', generalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/contact', contactLimiter);

// Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ======================
// COMPREHENSIVE HEALTH CHECKS
// ======================

// Simple health check (for uptime monitoring)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: process.env.APP_NAME || 'Hamdi Scents API',
    environment: process.env.NODE_ENV
  });
});

// Detailed health check (for debugging)
app.get('/api/health', async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: process.env.APP_NAME || 'Hamdi Scents API',
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + '%'
    },
    cpu: {
      cores: os.cpus().length,
      loadAverage: os.loadavg()
    },
    database: 'checking...',
    timestamp: new Date().toISOString()
  };

  // Check database connection
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      healthCheck.database = 'connected';
      healthCheck.databaseName = mongoose.connection.name;
      healthCheck.databaseHost = mongoose.connection.host;
    } else {
      healthCheck.database = 'disconnected';
      healthCheck.status = 'degraded';
    }
  } catch (error) {
    healthCheck.database = 'error';
    healthCheck.status = 'degraded';
    healthCheck.databaseError = error.message;
  }

  res.status(healthCheck.status === 'healthy' ? 200 : 503).json(healthCheck);
});

// Readiness probe (for Kubernetes/Render)
app.get('/ready', (req, res) => {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState === 1) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});

// Liveness probe
app.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// ======================
// API ROUTES
// ======================

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/orders', orderRoutes);

// API Info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    name: process.env.APP_NAME || 'Hamdi Scents API',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      contact: '/api/contact',
      coupons: '/api/coupons',
      offers: '/api/offers',
      orders: '/api/orders',
      health: '/health',
      detailedHealth: '/api/health'
    }
  });
});

// ======================
// ERROR HANDLING
// ======================

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
      timestamp: new Date().toISOString()
    });
  }
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: messages,
      timestamp: new Date().toISOString()
    });
  }
  
  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      timestamp: new Date().toISOString()
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ======================
// SERVER STARTUP
// ======================

const PORT = process.env.PORT || 7000;

const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 ${process.env.APP_NAME || 'Hamdi Scents API'} Server Started
║                                                          ║
║   📡 Port: ${PORT}
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}
║   🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5050'}
║   🏥 Health Check: /health
║   🔍 Detailed Health: /api/health
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Received shutdown signal, closing server gracefully...');
  server.close(async () => {
    console.log('Closed out remaining connections');
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  gracefulShutdown();
});

module.exports = app;