import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AnalyticsCard from '../components/AnalyticsCard.jsx';
import CropCard from '../components/CropCard.jsx';
import TrendChart from '../components/TrendChart.jsx';
import Loader from '../components/Loader.jsx';
import { listCrops } from '../api/crops.js';
import { useAuth } from '../context/AuthContext.jsx';

// Sample fallback trend used until backend is wired up.
const sampleTrend = [
  { date: 'Mon', price: 1800 },
  { date: 'Tue', price: 1850 },
  { date: 'Wed', price: 1810 },
  { date: 'Thu', price: 1920 },
  { date: 'Fri', price: 1980 },
  { date: 'Sat', price: 2040 },
  { date: 'Sun', price: 2110 },
];

export default function FarmerDashboard() {
  const { user } = useAuth();
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await listCrops({ mine: true });
        setCrops(data.crops || []);
      } catch {
        // Backend may not be ready yet — silently show empty state.
        setCrops([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-krishi-900">
            Namaste, {user?.name?.split(' ')[0] || 'Farmer'} 👋
          </h1>
          <p className="text-sm text-gray-600">Here's how your crops are performing today.</p>
        </div>
        <Link to="/farmer/upload" className="btn-primary">+ List a new crop</Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsCard label="Active listings" value={crops.length} hint="across all crops" />
        <AnalyticsCard label="Avg. predicted price" value="₹ 2,050" hint="next 7 days" accent="soil" />
        <AnalyticsCard label="Recommendation" value="HOLD" hint="prices trending up" accent="amber" />
        <AnalyticsCard label="Buyer matches" value="12" hint="in your district" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart data={sampleTrend} title="Local Mandi Trend (Tomato)" />
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700">AI Insight</h3>
          <p className="mt-2 text-sm text-gray-600">
            Demand for tomato is rising in nearby mandis. Holding stock for 5–7 more days
            could yield ~15% higher returns. Consider staggered selling.
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
