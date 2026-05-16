'use strict';

const axios = require('axios');
const marketPriceModel = require('../models/marketPriceModel');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

const AGMARKNET_URL = 'https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24';
const FALLBACK_KEY = '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';

function isoFromDmy(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}

function toNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeRecord(r) {
  return {
    date: isoFromDmy(r.Arrival_Date),
    commodity: r.Commodity,
    variety: r.Variety,
    grade: r.Grade,
    state: r.State,
    district: r.District,
    market: r.Market,
    min_price: toNumber(r.Min_Price),
    max_price: toNumber(r.Max_Price),
    modal_price: toNumber(r.Modal_Price),
  };
}

function buildSeries(records) {
  const byDate = new Map();
  for (const r of records) {
    if (!r.date || r.modal_price == null) continue;
    const cur = byDate.get(r.date) || { date: r.date, modalSum: 0, minSum: 0, maxSum: 0, n: 0, markets: new Set() };
    cur.modalSum += r.modal_price;
    if (r.min_price != null) cur.minSum += r.min_price;
    if (r.max_price != null) cur.maxSum += r.max_price;
    cur.n += 1;
    if (r.market) cur.markets.add(r.market);
    byDate.set(r.date, cur);
  }

  return Array.from(byDate.values())
    .map((v) => ({
      date: v.date,
      modal_price: Math.round(v.modalSum / v.n),
      min_price: v.n ? Math.round(v.minSum / v.n) : null,
      max_price: v.n ? Math.round(v.maxSum / v.n) : null,
      market_count: v.markets.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function buildFallbackFromDb({ state, district, commodity, trendWindow }) {
  const rows = await marketPriceModel.list({
    state,
    district,
    commodity,
    limit: Math.max(Number(trendWindow) * 4, 60),
  });
  const records = rows.map((row) => ({
    date: row.price_date ? String(row.price_date).slice(0, 10) : null,
    market: row.market,
    min_price: Number(row.min_price),
    max_price: Number(row.max_price),
    modal_price: Number(row.modal_price),
  }));
  const series = buildSeries(records);
  const latest = series[series.length - 1] || null;
  return {
    latest,
    trend: series.slice(-Math.max(Number(trendWindow), 1)),
    totalRows: rows.length,
    updatedAt: new Date().toISOString(),
  };
}

const liveMandi = asyncHandler(async (req, res) => {
  const { state = 'Maharashtra', district = 'Mumbai', commodity = 'Potato', trendWindow = 14 } = req.query;
  const apiKey = env.AGMARKNET_API_KEY || FALLBACK_KEY;

  const params = {
    'api-key': apiKey,
    format: 'json',
    offset: 0,
    limit: Math.max(Number(trendWindow) * 4, 60),
    'filters[State]': state,
    'filters[Commodity]': commodity,
    'sort[Arrival_Date]': 'desc',
  };
  if (district) params['filters[District]'] = district;

  try {
    const { data } = await axios.get(AGMARKNET_URL, { params, timeout: 5000 });
    const records = Array.isArray(data?.records) ? data.records : [];
    if (!records.length) {
      return res.json(await buildFallbackFromDb({ state, district, commodity, trendWindow }));
    }
    const series = buildSeries(records.map(normalizeRecord));

    const window = Math.max(Number(trendWindow), 1);
    const trend = series.slice(-window);
    const latest = series[series.length - 1] || null;

    res.json({ latest, trend, totalRows: records.length, updatedAt: data?.updated_date || null });
  } catch (err) {
    const fallback = await buildFallbackFromDb({ state, district, commodity, trendWindow });
    if (fallback.latest) return res.json(fallback);
    throw ApiError.badRequest(`Could not reach data.gov.in: ${err.response?.statusText || err.message}`);
  }
});

const listPrices = asyncHandler(async (req, res) => {
  const { crop, commodity, state, district, market, limit } = req.query;
  const rows = await marketPriceModel.list({
    crop,
    commodity,
    state,
    district,
    market,
    limit: Math.min(parseInt(limit, 10) || 50, 1000),
  });
  res.json({ data: rows, count: rows.length });
});

module.exports = { listPrices, liveMandi };
