// Live mandi price feed via data.gov.in (Agmarknet).
// Endpoint: GET https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24
//
// We hit data.gov.in directly from the browser — they respond with
// `Access-Control-Allow-Origin: <origin>` so CORS works. The API key is read
// from VITE_AGMARKNET_API_KEY so we don't bake it into source. A fallback key
// is provided so the demo runs out-of-the-box for the hackathon judge.
import axios from 'axios';

const BASE_URL =
  'https://api.data.gov.in/resource/35985678-0d79-46b4-9ed6-6f13308a1d24';

// Public demo key. Override in .env via VITE_AGMARKNET_API_KEY for production.
const FALLBACK_KEY =
  '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';

const API_KEY = import.meta.env.VITE_AGMARKNET_API_KEY || FALLBACK_KEY;

// Lightweight axios instance — no auth header, just JSON.
const agmark = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Parse "15/05/2026" -> "2026-05-15"
function isoFromDmy(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return s; // already ISO or unknown — pass through
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function toNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

// Map a raw record from data.gov.in into something the UI can consume.
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

/**
 * Fetch the most recent mandi rows for a commodity.
 *
 * @param {object} opts
 * @param {string} opts.state       e.g. "Maharashtra"
 * @param {string} [opts.district]  e.g. "Mumbai"
 * @param {string} [opts.commodity] e.g. "Potato"
 * @param {number} [opts.limit=100]
 */
export async function fetchMandiPrices({
  state = 'Maharashtra',
  district,
  commodity = 'Potato',
  limit = 100,
} = {}) {
  const params = {
    'api-key': API_KEY,
    format: 'json',
    offset: 0,
    limit,
    'filters[State]': state,
    'filters[Commodity]': commodity,
    // sort=desc returns newest Arrival_Date first.
    'sort[Arrival_Date]': 'desc',
  };
  if (district) params['filters[District]'] = district;

  const { data } = await agmark.get('', { params });
  const records = Array.isArray(data?.records) ? data.records : [];
  return {
    total: data?.total ?? records.length,
    updatedAt: data?.updated_date ?? null,
    records: records.map(normalizeRecord),
  };
}

/**
 * Convenience: latest single row + a small trend window for charts/cards.
 * Returns null when the API returns no data (silent for the demo).
 */
export async function fetchLatestPotatoMumbai({ trendWindow = 14 } = {}) {
  const res = await fetchMandiPrices({
    state: 'Maharashtra',
    district: 'Mumbai',
    commodity: 'Potato',
    limit: Math.max(trendWindow * 4, 60), // grab enough rows; multiple markets/day
  });
  if (!res.records.length) return null;

  // Group by date, average modal/min/max across markets reporting that day.
  const byDate = new Map();
  for (const r of res.records) {
    if (!r.date || r.modal_price == null) continue;
    const cur = byDate.get(r.date) || {
      date: r.date,
      modalSum: 0,
      minSum: 0,
      maxSum: 0,
      n: 0,
      markets: new Set(),
    };
    cur.modalSum += r.modal_price;
    if (r.min_price != null) cur.minSum += r.min_price;
    if (r.max_price != null) cur.maxSum += r.max_price;
    cur.n += 1;
    if (r.market) cur.markets.add(r.market);
    byDate.set(r.date, cur);
  }

  const series = Array.from(byDate.values())
    .map((v) => ({
      date: v.date,
      modal_price: Math.round(v.modalSum / v.n),
      min_price: v.n ? Math.round(v.minSum / v.n) : null,
      max_price: v.n ? Math.round(v.maxSum / v.n) : null,
      market_count: v.markets.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const trend = series.slice(-trendWindow);
  const latest = series[series.length - 1] || null;

  return {
    latest,
    trend,
    totalRows: res.total,
    updatedAt: res.updatedAt,
  };
}
