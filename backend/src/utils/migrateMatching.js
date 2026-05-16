#!/usr/bin/env node
'use strict';

/**
 * Migration script to add matching system tables
 * Usage: node src/utils/migrateMatching.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function migrate() {
  console.log('[migration] Starting matching system migration...');

  try {
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'migration_add_matching.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolons to get individual statements
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`[migration] Found ${statements.length} SQL statements`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        console.log(`[migration] Executing statement ${i + 1}/${statements.length}...`);
        await db.query(stmt);
        console.log(`[migration] ✓ Statement ${i + 1} executed`);
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message.includes('already exists') || err.code === '42P07' || err.code === '42701') {
          console.log(`[migration] ⓘ Statement ${i + 1} skipped (already exists): ${err.message.substring(0, 80)}`);
        } else {
          throw err;
        }
      }
    }

    console.log('[migration] ✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[migration] ❌ Error:', err.message);
    console.error('[migration] Details:', err);
    process.exit(1);
  }
}

migrate();
