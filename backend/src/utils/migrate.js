'use strict';

// Bootstraps the database tables required by the backend.
// Run with: npm run migrate

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function main() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const client = await pool.connect();
  try {
    // eslint-disable-next-line no-console
    console.log('[migrate] applying schema...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log('[migrate] done');
  } catch (err) {
    await client.query('ROLLBACK');
    // eslint-disable-next-line no-console
    console.error('[migrate] failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
