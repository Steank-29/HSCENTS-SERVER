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
  : ['http://localhost:5050', 'http://localhost:3000', process.env.CLIENT_URL, 
  '3.12.251.153', '3.20.63.178', '3.77.67.4', '3.79.134.69', '3.105.133.239',
  '3.105.190.221', '3.133.226.214', '3.149.57.90', '3.212.128.62', '5.161.61.238',
  '5.161.73.160', '5.161.75.7', '5.161.113.195', '5.161.117.52', '5.161.177.47',
  '5.161.194.92', '5.161.215.244', '5.223.43.32', '5.223.53.147', '5.223.57.22',
  '18.116.205.62', '18.180.208.214', '18.192.166.72', '18.193.252.127', '24.144.78.39',
  '24.144.78.185', '34.198.201.66', '45.55.123.175', '45.55.127.146', '49.13.24.81',
  '49.13.130.29', '49.13.134.145', '49.13.164.148', '49.13.167.123', '52.15.147.27',
  '52.22.236.30', '52.28.162.93', '52.59.43.236', '52.87.72.16', '54.64.67.106',
  '54.79.28.129', '54.87.112.51', '54.167.223.174', '54.249.170.27', '63.178.84.147',
  '64.225.81.248', '64.225.82.147', '69.162.124.227', '69.162.124.235', '69.162.124.238',
  '78.46.190.63', '78.46.215.1', '78.47.98.55', '78.47.173.76', '88.99.80.227',
  '91.99.101.207', '128.140.41.193', '128.140.106.114', '129.212.132.140', '134.199.240.137',
  '138.197.53.117', '138.197.53.138', '138.197.54.143', '138.197.54.247', '138.197.63.92',
  '139.59.50.44', '142.132.180.39', '143.198.249.237', '143.198.250.89', '143.244.196.21',
  '143.244.196.211', '143.244.221.177', '144.126.251.21', '146.190.9.187', '152.42.149.135',
  '157.90.155.240', '157.90.156.63', '159.69.158.189', '159.223.243.219', '161.35.247.201',
  '167.99.18.52', '167.235.143.113', '168.119.53.160', '168.119.96.239', '168.119.123.75',
  '170.64.250.64', '170.64.250.132', '170.64.250.235', '178.156.181.172', '178.156.184.20',
  '178.156.185.127', '178.156.185.231', '178.156.187.238', '178.156.189.113', '178.156.189.249',
  '188.166.201.79', '206.189.241.133', '209.38.49.1', '209.38.49.206', '209.38.49.226',
  '209.38.51.43', '209.38.53.7', '209.38.124.252', '216.144.248.18', '216.144.248.19',
  '216.144.248.21', '216.144.248.22', '216.144.248.23', '216.144.248.24', '216.144.248.25',
  '216.144.248.26', '216.144.248.27', '216.144.248.28', '216.144.248.29', '216.144.248.30',
  '216.245.221.83'];

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

const PORT = process.env.PORT || 5000;

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