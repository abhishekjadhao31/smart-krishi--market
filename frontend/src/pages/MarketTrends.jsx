import { useEffect, useMemo, useState } from 'react';
import TrendChart from '../components/TrendChart.jsx';
import AnalyticsCard from '../components/AnalyticsCard.jsx';
import Loader from '../components/Loader.jsx';
import LiveMandiPrice from '../components/LiveMandiPrice.jsx';
import { getMarketPrices } from '../api/market.js';
import { extractMarketPriceList } from '../utils/normalize.js';
import { LIVE_CARD_COMMODITIES } from '../config/commodities.js';

// Convert ISO date "2026-04-12" -> "12 Apr"
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

export default function MarketTrends() {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [commodity, setCommodity] = useState('');
  const [district, setDistrict] = useState('');

  // Initial load: pull a generous page of rows and derive commodities/districts.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await getMarketPrices({ limit: 500 });
        if (!active) return;
        const rows = extractMarketPriceList(data);
        setAllRows(rows);
        const firstCommodity = rows[0]?.commodity || '';
        setCommodity((prev) => prev || firstCommodity);
      } catch (err) {
        if (!active) return;
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            'Could not load market prices. Is the seed loaded?'
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const commodities = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.commodity).filter(Boolean))).sort(),
    [allRows]
  );
  const districts = useMemo(
    () =>
      Array.from(
        new Set(allRows.filter((r) => !commodity || r.commodity === commodity).map((r) => r.district))
      )
        .filter(Boolean)
        .sort(),
    [allRows, commodity]
  );

  // Build the chart series for the selected commodity + optional district.
  // Multiple markets/varieties report on the same day -> average modal price per day.
  const series = useMemo(() => {
    if (!commodity) return [];
    const filtered = allRows.filter(
      (r) =>
        r.commodity === commodity &&
        (!district || r.district === district)
    );
    const byDate = new Map();
    for (const r of filtered) {
      if (!r.price_date) continue;
      const key = String(r.price_date).slice(0, 10);
      const cur = byDate.get(key) || { sum: 0, n: 0 };
      cur.sum += r.modal_price;
      cur.n += 1;
      byDate.set(key, cur);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: fmtDate(date),
        rawDate: date,
        price: Math.round(v.sum / v.n),
      }));
  }, [allRows, commodity, district]);

  const latest = series[series.length - 1];
  const prev = series[series.length - 2];
  const trendLabel = !latest
    ? '—'
    : prev
      ? latest.price >= prev.price
        ? '⬆ Rising'
        : '⬇ Falling'
      : '—';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-krishi-900">Market Trends</h1>
          <p className="text-sm text-gray-600">
            Live mandi prices from <code className="rounded bg-krishi-100 px-1">/api/market-prices</code> ·{' '}
            {allRows.length} rows · Source: Agmarknet (Maharashtra)
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <p className="mt-1 text-xs text-red-500">
            Run the mandi fetch, clean, and seed pipeline in the backend folder.
          </p>
        </div>
      )}

      {/* Live daily feed from data.gov.in — independent of the seeded DB. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {LIVE_CARD_COMMODITIES.map((c) => (
          <LiveMandiPrice key={c} commodity={c} district="Mumbai" />
        ))}
      </div>

      {loading ? (
        <Loader label="Loading market prices..." />
      ) : (
        <>
          {/* Commodity chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {commodities.length === 0 ? (
              <span className="text-sm text-gray-500">No commodities found.</span>
            ) : (
              commodities.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCommodity(c);
                    setDistrict('');
                  }}
                  className={`badge cursor-pointer px-3 py-1 ${
                    commodity === c ? 'bg-krishi-600 text-white' : 'bg-krishi-100 text-krishi-700'
                  }`}
                >
                  {c}
                </button>
              ))
            )}
          </div>

          {/* District filter */}
          {districts.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <label className="text-gray-600">District:</label>
              <select
                className="input max-w-xs"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                <option value="">All districts</option>
                {districts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <AnalyticsCard
              label="Latest modal price"
              value={latest ? `₹ ${latest.price.toLocaleString()} / qtl` : '—'}
              hint={latest ? `as of ${fmtDate(latest.rawDate)}` : ''}
            />
            <AnalyticsCard
              label="Data points"
              value={series.length}
              hint={district ? `for ${district}` : 'across all districts'}
              accent="soil"
            />
            <AnalyticsCard label="Trend" value={trendLabel} accent="amber" />
          </div>

          <div className="mt-6">
            <TrendChart
              data={series}
              title={`${commodity || 'Commodity'}${district ? ` — ${district}` : ''} (modal price)`}
            />
          </div>
        </>
      )}
    </div>
  );
}
