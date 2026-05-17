'use strict';

const db = require('../../config/db');
const marketPriceModel = require('../../models/marketPriceModel');

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function trendDirection(values = []) {
  const filtered = values.map(safeNumber).filter((n) => n != null);
  if (filtered.length < 2) return 'Stable';
  const first = filtered[0];
  const last = filtered[filtered.length - 1];
  const change = (last - first) / Math.max(first, 1);
  if (change > 0.05) return 'Rising';
  if (change < -0.05) return 'Falling';
  return 'Stable';
}

async function getMarketInsight({ cropName, district, market, state = 'Maharashtra', limit = 60 }) {
  const rows = await marketPriceModel.list({
    commodity: cropName,
    district,
    market,
    state,
    limit,
  });

  const ordered = rows
    .map((row) => ({
      priceDate: row.price_date,
      modalPrice: safeNumber(row.modal_price),
      arrivals: safeNumber(row.arrivals),
      district: row.district,
      market: row.market,
      variety: row.variety,
      minPrice: safeNumber(row.min_price),
      maxPrice: safeNumber(row.max_price),
    }))
    .filter((row) => row.priceDate && row.modalPrice != null)
    .sort((a, b) => String(a.priceDate).localeCompare(String(b.priceDate)));

  const latest = ordered[ordered.length - 1] || null;
  const recent = ordered.slice(-14);
  const prices = recent.map((row) => row.modalPrice);
  const arrivals = recent.map((row) => row.arrivals).filter((n) => n != null);

  const avgPrice = prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : null;
  const avgArrivals = arrivals.length ? arrivals.reduce((sum, value) => sum + value, 0) / arrivals.length : null;

  let weather = null;
  if (district) {
    const weatherRes = await db.query(
      `SELECT weather_date, district, temp_avg_c, temp_min_c, temp_max_c, rainfall_mm, humidity_pct, wind_kmph
         FROM weather_daily
        WHERE district = $1
        ORDER BY weather_date DESC
        LIMIT 7`,
      [district]
    );
    weather = weatherRes.rows.map((row) => ({
      date: row.weather_date,
      tempAvgC: safeNumber(row.temp_avg_c),
      tempMinC: safeNumber(row.temp_min_c),
      tempMaxC: safeNumber(row.temp_max_c),
      rainfallMm: safeNumber(row.rainfall_mm),
      humidityPct: safeNumber(row.humidity_pct),
      windKmph: safeNumber(row.wind_kmph),
    }));
  }

  return {
    latest,
    recent,
    avgPrice: avgPrice == null ? null : Math.round(avgPrice),
    avgArrivals: avgArrivals == null ? null : Math.round(avgArrivals * 100) / 100,
    priceDirection: trendDirection(prices),
    arrivalDirection: trendDirection(arrivals),
    weather,
    dataPoints: ordered.length,
  };
}

module.exports = {
  getMarketInsight,
};