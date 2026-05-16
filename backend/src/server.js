'use strict';

require('dotenv').config();

const app = require('./app');
const { pool } = require('./config/db');
const env = require('./config/env');

const PORT = env.PORT;

async function start() {
  try {
    // Verify DB connectivity at boot — fail loudly rather than serving 500s later.
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    // eslint-disable-next-line no-console
    console.log(`[db] connected to ${env.DB_NAME} on ${env.DB_HOST}:${env.DB_PORT}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] connection failed:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Smart Krishi Market API listening on :${PORT} (${env.NODE_ENV})`);
  });

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
