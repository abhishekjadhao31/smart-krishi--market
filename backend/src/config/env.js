'use strict';

// Centralized env loader so the rest of the app never reads process.env directly.
// Fails fast if required vars are missing in production.

require('dotenv').config();

const required = ['JWT_SECRET'];

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT, 10) || 5432,
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  DB_NAME: process.env.DB_NAME || 'smart_krishi_market',
  DATABASE_URL: process.env.DATABASE_URL || '',

  JWT_SECRET: process.env.JWT_SECRET || 'dev_only_insecure_secret_change_me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000',

  ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  AGMARKNET_API_KEY: process.env.AGMARKNET_API_KEY || process.env.VITE_AGMARKNET_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-flash',

  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  RAW_DATA_DIR: process.env.RAW_DATA_DIR || 'database/raw',
  MAX_UPLOAD_SIZE_MB: parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 5,
};

if (env.NODE_ENV === 'production') {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error(`[env] missing required vars in production: ${missing.join(', ')}`);
    process.exit(1);
  }
}

module.exports = env;
