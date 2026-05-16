'use strict';

const { query } = require('../config/db');

const PUBLIC_COLUMNS = 'id, name, email, phone, role, state, district, created_at';

async function findByEmail(email) {
  const { rows } = await query(
    `SELECT id, name, email, phone, role, state, district, password_hash, created_at
       FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function create({ name, email, phone, passwordHash, role, state, district }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, phone, password_hash, role, state, district)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, phone || null, passwordHash, role, state || null, district || null]
  );
  return rows[0];
}

async function updateByEmail(email, { name, phone, passwordHash, role, state, district }) {
  const { rows } = await query(
    `UPDATE users
        SET name = $1,
            phone = $2,
            password_hash = $3,
            role = $4,
            state = $5,
            district = $6
      WHERE email = $7
      RETURNING ${PUBLIC_COLUMNS}`,
    [name, phone || null, passwordHash, role, state || null, district || null, email]
  );
  return rows[0] || null;
}

module.exports = { findByEmail, findById, create, updateByEmail };
