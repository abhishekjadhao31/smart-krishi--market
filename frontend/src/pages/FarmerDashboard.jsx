import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AnalyticsCard from '../components/AnalyticsCard.jsx';
import CropCard from '../components/CropCard.jsx';
import TrendChart from '../components/TrendChart.jsx';
import Loader from '../components/Loader.jsx';
import LiveMandiPrice from '../components/LiveMandiPrice.jsx';
import { listCrops } from '../api/crops.js';
import { getMarketPrices } from '../api/market.js';
import { extractCropList, extractMarketPriceList } from '../utils/normalize.js';
import { useAuth } from '../context/AuthContext.jsx';
import { LIVE_CARD_COMMODITIES, SUPPORTED_COMMODITIES } from '../config/commodities.js';

// Convert ISO date to short label for the chart x-axis.
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

export default function FarmerDashboard() {
  const { user } = useAuth();
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marketRows, setMarketRows] = useState([]);
  const [trendCommodity, setTrendCommodity] = useState('Potato');

  useEffect(() => {
    (async () => {
      try {
        const [cropsRes, mktRes] = await Promise.allSettled([
          listCrops({ mine: true }),
          getMarketPrices({ limit: 1000 }),
        ]);
        if (cropsRes.status === 'fulfilled') {
          setCrops(extractCropList(cropsRes.value.data));
        }
        if (mktRes.status === 'fulfilled') {
          setMarketRows(extractMarketPriceList(mktRes.value.data));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Honest aggregates derived from the farmer's own listings.
  const stats = useMemo(() => {
    const active = crops.length;
    const totalKg = crops.reduce((s, c) => s + (Number(c.quantity_kg) || 0), 0);
    const priced = crops.filter((c) => Number(c.price_per_kg) > 0);
    const askingValue = priced.reduce(
      (s, c) => s + Number(c.price_per_kg) * (Number(c.quantity_kg) || 0),
      0,
    );
    const avgAsking =
      priced.length > 0
        ? priced.reduce((s, c) => s + Number(c.price_per_kg), 0) / priced.length
        : null;
    return { active, totalKg, askingValue, avgAsking };
  }, [crops]);

  // Real Potato trend series — averaged per date across all reporting mandis.
  // Backend's /market-prices doesn't filter by commodity, so we filter here.
  const mandiTrend = useMemo(() => {
    if (marketRows.length === 0) return [];
    const byDate = new Map();
    for (const r of marketRows) {
      if (!r.price_date || !r.modal_price) continue;
      if (r.commodity && String(r.commodity).toLowerCase() !== trendCommodity.toLowerCase()) continue;
      const key = String(r.price_date).slice(0, 10);
      const cur = byDate.get(key) || { sum: 0, n: 0 };
      cur.sum += r.modal_price;
      cur.n += 1;
      byDate.set(key, cur);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, v]) => ({ date: fmtDate(date), price: Math.round(v.sum / v.n) }));
  }, [marketRows, trendCommodity]);

  const latestMandi = mandiTrend[mandiTrend.length - 1]?.price ?? null;
  const prevMandi = mandiTrend[mandiTrend.length - 2]?.price ?? null;
  const mandiTrendLabel =
    latestMandi == null
      ? '—'
      : prevMandi == null
        ? '—'
        : latestMandi >= prevMandi
          ? '⬆ Rising'
          : '⬇ Falling';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-krishi-900">
            Namaste, {user?.name?.split(' ')[0] || 'Farmer'} 👋
          </h1>
          <p className="text-sm text-gray-600">Your listings, market signals, and next actions are in one place.</p>
        </div>
        <Link to="/farmer/upload" className="btn-primary">+ List a new crop</Link>
      </div>

      {/* Live mandi feed (data.gov.in) — refreshes every 10 min. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {LIVE_CARD_COMMODITIES.map((commodity) => (
          <LiveMandiPrice key={commodity} commodity={commodity} district="Mumbai" />
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsCard
          label="Active listings"
          value={stats.active}
          hint={stats.active === 1 ? 'crop' : 'crops'}
        />
        <AnalyticsCard
          label="Total quantity listed"
          value={`${stats.totalKg.toLocaleString()} kg`}
          hint="across all your crops"
          accent="soil"
        />
        <AnalyticsCard
          label="Asking-price value"
          value={stats.askingValue > 0 ? `₹ ${Math.round(stats.askingValue).toLocaleString()}` : '—'}
          hint={
            stats.avgAsking != null
              ? `avg ₹${stats.avgAsking.toFixed(2)}/kg`
              : 'set price/kg when listing'
          }
          accent="amber"
        />
        <AnalyticsCard
          label={`Mandi trend (${trendCommodity})`}
          value={mandiTrendLabel}
          hint={latestMandi != null ? `latest ₹${latestMandi.toLocaleString()}/qtl` : 'no data'}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUPPORTED_COMMODITIES.map((commodity) => (
              <button
                key={commodity}
                type="button"
                onClick={() => setTrendCommodity(commodity)}
                className={`badge cursor-pointer px-3 py-1 ${
                  trendCommodity === commodity ? 'bg-krishi-600 text-white' : 'bg-krishi-100 text-krishi-700'
                }`}
              >
                {commodity}
              </button>
            ))}
          </div>
          {mandiTrend.length > 0 ? (
            <TrendChart data={mandiTrend} title={`Maharashtra ${trendCommodity} - recent mandi modal`} />
          ) : (
            <div className="card text-center text-sm text-gray-500">
              No market data loaded yet. Run the mandi fetch, clean, and seed pipeline.
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700">Forecast insight</h3>
          <p className="mt-2 text-sm text-gray-600">
            Price forecasts are built from cleaned Maharashtra mandi data plus weather
            history, so you can compare the current market with the next few days.
          </p>
          <Link to="/market-trends" className="btn-outline mt-4 w-full">Explore trends</Link>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-krishi-800">My crop listings</h2>
        {loading ? (
          <Loader label="Fetching your crops..." />
        ) : crops.length === 0 ? (
          <div className="card mt-3 text-center text-gray-600">
            <p>No crops listed yet.</p>
            <Link to="/farmer/upload" className="btn-primary mt-3 inline-flex">
              List your first crop
            </Link>
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {crops.map((c) => (
              <CropCard
                key={c.id}
                crop={c}
                actionLabel="View prediction"
                actionTo={`/farmer/prediction/${c.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
