'use strict';

require('dotenv').config();

const app = require('./app');
const { pool } = require('./config/db');
const env = require('./config/env');

const PORT = env.PORT;

async function start() {
  let server = null;

  try {
    // Verify DB connectivity at boot — fail loudly rather than serving 500s later.
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    // eslint-disable-next-line no-console
    console.log(`[db] connected to ${env.DB_NAME} on ${env.DB_HOST}:${env.DB_PORT}`);
  } catch (err) {
    // In development, allow server to start even if DB is offline so frontend and other
    // non-DB APIs can be iterated on. In production we still fail fast.
    // eslint-disable-next-line no-console
    console.error('[db] connection failed:', err.message);
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('[server] continuing without DB (development mode) — some endpoints will fail until DB is available');
    }
  }

  const startListening = (port) => new Promise((resolve, reject) => {
    server = app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`[server] Smart Krishi Market API listening on :${port} (${env.NODE_ENV})`);
      resolve();
    });

    server.on('error', reject);
  });

  let activePort = PORT;
  while (activePort <= PORT + 10) {
    try {
      await startListening(activePort);
      break;
    } catch (err) {
      if (err.code === 'EADDRINUSE' && env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(`[server] port ${activePort} is busy, trying ${activePort + 1}...`);
        activePort += 1;
        continue;
      }
      throw err;
    }
  }

  if (!server) {
    throw new Error(`Unable to bind to any port from ${PORT} to ${PORT + 10}`);
  }

  const shutdown = (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\n[server] received ${signal}, shutting down...`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
