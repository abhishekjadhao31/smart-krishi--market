'use strict';

const { query } = require('../config/db');

async function list({ crop, commodity, state, district, market, limit = 50 } = {}) {
  const where = [];
  const params = [];
  const commodityFilter = commodity || crop;
  if (commodityFilter) {
    params.push(`%${String(commodityFilter).toLowerCase()}%`);
    where.push(`LOWER(commodity) LIKE $${params.length}`);
  }
  if (state) {
    params.push(state);
    where.push(`state = $${params.length}`);
  }
  if (district) {
    params.push(district);
    where.push(`district = $${params.length}`);
  }
  if (market) {
    params.push(market);
    where.push(`market = $${params.length}`);
  }
  params.push(limit);
  const sql = `
    SELECT id, state, district, market, commodity, variety,
           min_price, max_price, modal_price, price_date, arrivals, unit,
           day_of_week, month, lag_1_price, lag_7_price, rolling_avg_7,
           rolling_avg_30, price_trend, arrivals_trend, source, created_at
    FROM market_prices
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY price_date DESC, created_at DESC
    LIMIT $${params.length}
  `;
  const { rows } = await query(sql, params);
  return rows;
}

module.exports = { list };
