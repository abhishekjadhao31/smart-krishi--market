'use strict';

const { Pool } = require('pg');
const env = require('./env');

// Prefer DATABASE_URL when provided (Render/Railway), fall back to discrete vars locally.
const pool = env.DATABASE_URL
  ? new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    });

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[db] unexpected pool error:', err.message);
});

/**
 * Run a parameterized SQL query.
 * @param {string} text
 * @param {Array<any>} [params]
 */
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
