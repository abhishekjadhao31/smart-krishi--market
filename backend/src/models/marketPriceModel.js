'use strict';

const { query } = require('../config/db');

async function list({ crop, state, market, limit = 50 } = {}) {
  const where = [];
  const params = [];
  if (crop) {
    params.push(`%${crop.toLowerCase()}%`);
    where.push(`LOWER(commodity) LIKE $${params.length}`);
  }
  if (state) {
    params.push(state);
    where.push(`state = $${params.length}`);
  }
  if (market) {
    params.push(market);
    where.push(`market = $${params.length}`);
  }
  params.push(limit);
  const sql = `
    SELECT id, state, district, market, commodity, variety,
           min_price, max_price, modal_price, price_date, source, created_at
    FROM market_prices
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY price_date DESC, created_at DESC
    LIMIT $${params.length}
  `;
  const { rows } = await query(sql, params);
  return rows;
}

module.exports = { list };
