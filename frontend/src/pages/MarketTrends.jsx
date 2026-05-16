import { useEffect, useMemo, useState } from 'react';
import TrendChart from '../components/TrendChart.jsx';
import AnalyticsCard from '../components/AnalyticsCard.jsx';
import Loader from '../components/Loader.jsx';
import { getMarketPrices } from '../api/market.js';

// Fallback datasets used if the backend is offline or returns nothing.
const fallbackDatasets = {
  Tomato: [
    { date: 'Week 1', price: 1650, predicted: 1700 },
    { date: 'Week 2', price: 1720, predicted: 1750 },
    { date: 'Week 3', price: 1810, predicted: 1840 },
    { date: 'Week 4', price: 1900, predicted: 1980 },
    { date: 'Week 5', price: 1980, predicted: 2080 },
    { date: 'Week 6', price: 2050, predicted: 2150 },
  ],
  Onion: [
    { date: 'Week 1', price: 1200, predicted: 1240 },
    { date: 'Week 2', price: 1280, predicted: 1300 },
    { date: 'Week 3', price: 1320, predicted: 1360 },
    { date: 'Week 4', price: 1390, predicted: 1420 },
    { date: 'Week 5', price: 1410, predicted: 1450 },
    { date: 'Week 6', price: 1460, predicted: 1500 },
  ],
  Wheat: [
    { date: 'Week 1', price: 2200, predicted: 2220 },
    { date: 'Week 2', price: 2240, predicted: 2260 },
    { date: 'Week 3', price: 2260, predicted: 2280 },
    { date: 'Week 4', price: 2300, predicted: 2310 },
    { date: 'Week 5', price: 2320, predicted: 2340 },
    { date: 'Week 6', price: 2350, predicted: 2370 },
  ],
};

// Normalize whatever the backend returns into [{ date, price, predicted? }].
// Accepts shapes like:
//   { prices: [...] }
//   { data: [...] }
//   { rows: [...] }
//   [ ... ]  (bare array)
// Each row may use: date|reported_date|day, price|modal_price|avg_price,
// predicted|predicted_price.
function normalizeRows(payload) {
  const list =
    (Array.isArray(payload) && payload) ||
    payload?.prices ||
    payload?.data ||
    payload?.rows ||
    [];
  return list
    .map((r) => ({
      date: r.date || r.reported_date || r.day || r.label || '',
      price: Number(r.price ?? r.modal_price ?? r.avg_price ?? 0),
      predicted: r.predicted ?? r.predicted_price ?? null,
    }))
    .filter((r) => r.date && Number.isFinite(r.price));
}

// Build the list of available crops from the API response, falling back to
// the hardcoded set.
function extractCropNames(payload) {
  if (Array.isArray(payload?.crops) && payload.crops.length) return payload.crops;
  const list = (Array.isArray(payload) && payload) || payload?.prices || payload?.data || [];
  const set = new Set(list.map((r) => r.crop || r.crop_name).filter(Boolean));
  return set.size ? Array.from(set) : Object.keys(fallbackDatasets);
}

export default function MarketTrends() {
  const [crop, setCrop] = useState('Tomato');
  const [availableCrops, setAvailableCrops] = useState(Object.keys(fallbackDatasets));
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);

  // Initial fetch — let the backend tell us which crops exist.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await getMarketPrices();
        if (!active) return;
        const crops = extractCropNames(data);
        setAvailableCrops(crops);
        if (!crops.includes(crop)) setCrop(crops[0]);
      } catch {
        // Stay on fallback list.
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the per-crop series whenever the selected crop changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setUsingFallback(false);

    (async () => {
      try {
        const { data } = await getMarketPrices({ crop });
        if (!active) return;
        const rows = normalizeRows(data);
        if (rows.length === 0) {
          setSeries(fallbackDatasets[crop] || []);
          setUsingFallback(true);
        } else {
          setSeries(rows);
        }
      } catch (err) {
        if (!active) return;
        setError(
          err.response?.data?.message ||
            'Could not load market prices. Showing sample data.'
        );
        setSeries(fallbackDatasets[crop] || []);
        setUsingFallback(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [crop]);

  const latest = series[series.length - 1];
  const trendLabel = useMemo(() => {
    if (!latest) return '—';
    if (latest.predicted != null) {
      return latest.predicted > latest.price ? '⬆ Rising' : '⬇ Falling';
    }
    if (series.length >= 2) {
      const prev = series[series.length - 2].price;
      return latest.price >= prev ? '⬆ Rising' : '⬇ Falling';
    }
    return '—';
  }, [series, latest]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-krishi-900">Market Trends</h1>
          <p className="text-sm text-gray-600">
            Live mandi prices from{' '}
            <code className="rounded bg-krishi-100 px-1">/api/market-prices</code>.
          </p>
        </div>
        {usingFallback && !loading && (
          <span className="badge bg-amber-100 text-amber-800">Sample data</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {availableCrops.map((c) => (
          <button
            key={c}
            onClick={() => setCrop(c)}
            className={`badge cursor-pointer px-3 py-1 ${
              crop === c ? 'bg-krishi-600 text-white' : 'bg-krishi-100 text-krishi-700'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </div>
      )}

      {loading ? (
        <Loader label={`Loading ${crop} prices...`} />
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <AnalyticsCard
              label="Latest price"
              value={latest ? `₹ ${latest.price}` : '—'}
            />
            <AnalyticsCard
              label="Predicted next"
              value={latest?.predicted != null ? `₹ ${latest.predicted}` : '—'}
              accent="soil"
            />
            <AnalyticsCard label="Trend" value={trendLabel} accent="amber" />
          </div>
          <div className="mt-6">
            <TrendChart data={series} title={`${crop} — price outlook`} />
          </div>
        </>
      )}
    </div>
  );
}
