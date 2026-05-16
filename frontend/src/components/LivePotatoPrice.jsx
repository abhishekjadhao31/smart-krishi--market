import { useEffect, useState } from 'react';
import { fetchLatestPotatoMumbai } from '../api/agmarknet.js';

// Refresh interval — 10 minutes is more than enough for daily Agmarknet data.
const REFRESH_MS = 10 * 60 * 1000;

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

/**
 * Live Potato (Mumbai APMC) price card.
 *
 * Hits data.gov.in's Agmarknet "Variety-wise Daily Market Prices" feed
 * directly from the browser (the endpoint sets CORS headers). Re-fetches
 * every 10 minutes and on mount. Degrades gracefully — error → muted notice,
 * loading → skeleton.
 *
 * Props:
 *   variant: 'card' (default) | 'compact'  — controls layout density.
 */
export default function LivePotatoPrice({ variant = 'card' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let timer = null;

    const load = async () => {
      try {
        const res = await fetchLatestPotatoMumbai({ trendWindow: 14 });
        if (!active) return;
        if (!res) {
          setError('No live data available right now.');
          setData(null);
        } else {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!active) return;
        // eslint-disable-next-line no-console
        console.error('Agmarknet fetch failed:', err);
        setError('Could not reach data.gov.in. Showing cached data instead.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    timer = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  const latest = data?.latest;
  const trend = data?.trend || [];
  const prev = trend.length >= 2 ? trend[trend.length - 2] : null;
  const delta =
    latest && prev ? latest.modal_price - prev.modal_price : null;
  const deltaPct =
    delta != null && prev?.modal_price
      ? (delta / prev.modal_price) * 100
      : null;

  // Tiny sparkline using inline SVG — keeps this self-contained.
  const Sparkline = () => {
    if (trend.length < 2) return null;
    const w = 140;
    const h = 36;
    const xs = trend.map((_, i) => (i / (trend.length - 1)) * w);
    const ys = trend.map((t) => t.modal_price);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const range = max - min || 1;
    const pts = trend.map(
      (t, i) =>
        `${xs[i].toFixed(1)},${(h - ((t.modal_price - min) / range) * h).toFixed(1)}`,
    );
    return (
      <svg width={w} height={h} className="overflow-visible">
        <polyline
          fill="none"
          stroke="#2b7e2b"
          strokeWidth="2"
          points={pts.join(' ')}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="card animate-pulse">
        <p className="text-sm text-gray-400">Loading live mandi price…</p>
        <div className="mt-2 h-8 w-32 rounded bg-gray-100" />
        <div className="mt-3 h-9 w-full rounded bg-gray-50" />
      </div>
    );
  }

  if (error && !latest) {
    return (
      <div className="card">
        <p className="text-xs font-medium text-amber-700">
          Live mandi feed unavailable
        </p>
        <p className="mt-1 text-xs text-gray-500">{error}</p>
      </div>
    );
  }

  if (!latest) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">
              Live · Potato · Mumbai APMC
            </p>
            <p className="mt-0.5 text-xl font-bold text-krishi-800">
              ₹ {latest.modal_price.toLocaleString()} <span className="text-xs font-normal text-gray-500">/ qtl</span>
            </p>
          </div>
          <Sparkline />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>as of {fmtDate(latest.date)}</span>
          {delta != null && (
            <span
              className={
                delta > 0
                  ? 'text-krishi-700'
                  : delta < 0
                    ? 'text-red-600'
                    : 'text-gray-500'
              }
            >
              {delta >= 0 ? '▲' : '▼'} ₹{Math.abs(delta)}
              {deltaPct != null && (
                <span className="ml-1">({deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%)</span>
              )}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-krishi-600">
            🟢 Live · data.gov.in
          </p>
          <h3 className="mt-1 text-lg font-bold text-krishi-900">
            Potato — Mumbai APMC
          </h3>
          <p className="text-xs text-gray-500">
            as of {fmtDate(latest.date)}
            {latest.market_count > 1 && (
              <span> · avg across {latest.market_count} markets</span>
            )}
          </p>
        </div>
        <Sparkline />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-gray-500">Modal</p>
          <p className="font-semibold text-krishi-800">
            ₹ {latest.modal_price.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Min</p>
          <p className="font-semibold">
            {latest.min_price != null
              ? `₹ ${latest.min_price.toLocaleString()}`
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Max</p>
          <p className="font-semibold">
            {latest.max_price != null
              ? `₹ ${latest.max_price.toLocaleString()}`
              : '—'}
          </p>
        </div>
      </div>

      {delta != null && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            delta > 0
              ? 'bg-krishi-50 text-krishi-700'
              : delta < 0
                ? 'bg-red-50 text-red-700'
                : 'bg-gray-50 text-gray-600'
          }`}
        >
          {delta === 0
            ? 'Flat vs previous reporting day.'
            : `${delta > 0 ? 'Up' : 'Down'} ₹${Math.abs(delta)}/qtl vs previous reporting day` +
              (deltaPct != null
                ? ` (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%).`
                : '.')}
        </div>
      )}

      {error && (
        <p className="mt-2 text-[11px] text-amber-600">{error}</p>
      )}
    </div>
  );
}
