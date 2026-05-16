'use strict';

const { query } = require('../config/db');

const BUYER_COLUMNS = 'id, name, email, phone, role, state, district, created_at';

/**
 * List registered buyers. Used by the buyer directory page on the frontend.
 * Newest first; capped to a reasonable page size.
 */
async function listBuyers({ state, district, limit = 50, offset = 0 } = {}) {
  const where = [`role = 'buyer'`];
  const params = [];
  if (state) {
    params.push(state);
    where.push(`state = $${params.length}`);
  }
  if (district) {
    params.push(district);
    where.push(`district = $${params.length}`);
  }
  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    SELECT ${BUYER_COLUMNS}
      FROM users
     WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;
  const { rows } = await query(sql, params);
  return rows;
}

/**
 * Search active crop listings on behalf of a buyer.
 * `location` is matched against state OR district OR market (case-insensitive).
 * `maxPrice` filters by `price_per_kg` (NULL prices are excluded when filter is set).
 */
async function searchListings({ crop, location, maxPrice, limit = 50 } = {}) {
  const where = [`c.status = 'available'`];
  const params = [];

  if (crop) {
    params.push(`%${String(crop).toLowerCase()}%`);
    where.push(`LOWER(c.crop_name) LIKE $${params.length}`);
  }
  if (location) {
    params.push(`%${String(location).toLowerCase()}%`);
    const i = params.length;
    where.push(
      `(LOWER(COALESCE(c.state, '')) LIKE $${i}
        OR LOWER(COALESCE(c.district, '')) LIKE $${i}
        OR LOWER(COALESCE(c.market, '')) LIKE $${i})`
    );
  }
  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
    params.push(Number(maxPrice));
    where.push(`c.price_per_kg IS NOT NULL AND c.price_per_kg <= $${params.length}`);
  }
  params.push(limit);

  const sql = `
    SELECT c.id, c.farmer_id, c.crop_name, c.variety, c.quantity_kg, c.price_per_kg,
           c.state, c.district, c.market, c.harvest_date, c.storage_available,
           c.description, c.image_url, c.status, c.created_at, c.updated_at,
           u.name AS farmer_name, u.phone AS farmer_phone, u.email AS farmer_email
      FROM crops c
      JOIN users u ON u.id = c.farmer_id
     WHERE ${where.join(' AND ')}
     ORDER BY c.created_at DESC
     LIMIT $${params.length}
  `;
  const { rows } = await query(sql, params);
  return rows;
}

module.exports = { listBuyers, searchListings };
