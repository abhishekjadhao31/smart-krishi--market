'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// Behind a proxy (Render/Railway/Vercel) — needed for correct client IP + rate limiting.
app.set('trust proxy', 1);

// Security + parsing
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
const allowedOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / curl (no Origin header) and whitelisted origins.
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Global rate limit — protects auth + write endpoints from brute force.
app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Static serving for uploaded crop images
const uploadDir = path.resolve(__dirname, '..', env.UPLOAD_DIR);
app.use('/uploads', express.static(uploadDir));

// API routes
app.use('/api', routes);

// Root
app.get('/', (_req, res) => {
  res.json({
    name: 'Smart Krishi Market API',
    status: 'ok',
    docs: '/api/health',
  });
});

// 404 + error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
