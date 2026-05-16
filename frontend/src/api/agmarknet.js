// Live mandi price feed is proxied through the backend to avoid browser CORS.
import api from './client.js';

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
  const { data } = await api.get('/market-prices/live', {
    params: { state, district, commodity, trendWindow: Math.max(limit, 14) },
  });
  const latest = data?.latest || null;
  const trend = Array.isArray(data?.trend) ? data.trend : [];
  return { total: data?.totalRows ?? trend.length, updatedAt: data?.updatedAt ?? null, records: latest ? [latest, ...trend] : trend };
}

/**
 * Convenience: latest single row + a small trend window for charts/cards.
 * Returns null when the API returns no data (silent for the demo).
 */
export async function fetchLatestMandiPrice({
  state = 'Maharashtra',
  district = 'Mumbai',
  commodity = 'Potato',
  trendWindow = 14,
} = {}) {
  const { data } = await api.get('/market-prices/live', {
    params: { state, district, commodity, trendWindow },
  });
  const latest = data?.latest || null;
  const trend = Array.isArray(data?.trend) ? data.trend : [];

  return {
    latest,
    trend,
    totalRows: data?.totalRows ?? trend.length,
    updatedAt: data?.updatedAt ?? null,
  };
}

export async function fetchLatestPotatoMumbai({ trendWindow = 14 } = {}) {
  return fetchLatestMandiPrice({ commodity: 'Potato', district: 'Mumbai', trendWindow });
}
