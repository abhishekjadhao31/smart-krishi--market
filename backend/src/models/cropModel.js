'use strict';

const { query } = require('../config/db');

const SELECT_FIELDS = `
  c.id, c.farmer_id, c.crop_name, c.variety, c.quantity_kg, c.price_per_kg,
  c.state, c.district, c.market, c.harvest_date, c.storage_available,
  c.description, c.image_url, c.latitude, c.longitude, c.status, c.created_at, c.updated_at,
  u.name AS farmer_name, u.phone AS farmer_phone, u.email AS farmer_email
`;

async function create(data) {
  const {
    farmerId,
    cropName,
    variety,
    quantityKg,
    pricePerKg,
    state,
    district,
    market,
    harvestDate,
    storageAvailable,
    description,
    imageUrl,
  } = data;

  const { rows } = await query(
    `INSERT INTO crops
       (farmer_id, crop_name, variety, quantity_kg, price_per_kg, state, district,
        market, harvest_date, storage_available, description, image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      farmerId,
      cropName,
      variety || null,
      quantityKg,
      pricePerKg || null,
      state || null,
      district || null,
      market || null,
      harvestDate || null,
      storageAvailable === true,
      description || null,
      imageUrl || null,
    ]
  );
  return rows[0];
}

async function list({ crop, state, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (crop) {
    params.push(`%${crop.toLowerCase()}%`);
    where.push(`LOWER(c.crop_name) LIKE $${params.length}`);
  }
  if (state) {
    params.push(state);
    where.push(`c.state = $${params.length}`);
  }
  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const sql = `
    SELECT ${SELECT_FIELDS}
    FROM crops c
    JOIN users u ON u.id = c.farmer_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY c.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;
  const { rows } = await query(sql, params);
  return rows;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT ${SELECT_FIELDS}
       FROM crops c JOIN users u ON u.id = c.farmer_id
      WHERE c.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findByFarmer(farmerId) {
  const { rows } = await query(
    `SELECT ${SELECT_FIELDS}
       FROM crops c JOIN users u ON u.id = c.farmer_id
      WHERE c.farmer_id = $1
      ORDER BY c.created_at DESC`,
    [farmerId]
  );
  return rows;
}

async function update(id, data) {
  // Build a dynamic SET clause from the provided fields only.
  const map = {
    cropName: 'crop_name',
    variety: 'variety',
    quantityKg: 'quantity_kg',
    pricePerKg: 'price_per_kg',
    state: 'state',
    district: 'district',
    market: 'market',
    harvestDate: 'harvest_date',
    storageAvailable: 'storage_available',
    description: 'description',
    imageUrl: 'image_url',
    status: 'status',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (data[k] !== undefined) {
      params.push(data[k]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (!sets.length) return findById(id);
  sets.push(`updated_at = NOW()`);
  params.push(id);
  const sql = `UPDATE crops SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`;
  const { rows } = await query(sql, params);
  return rows[0] || null;
}

async function remove(id) {
  const { rowCount } = await query(`DELETE FROM crops WHERE id = $1`, [id]);
  return rowCount > 0;
}

module.exports = { create, list, findById, findByFarmer, update, remove };
