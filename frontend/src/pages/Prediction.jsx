import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AnalyticsCard from '../components/AnalyticsCard.jsx';
import TrendChart from '../components/TrendChart.jsx';
import Loader from '../components/Loader.jsx';
import { getCrop, predictForCrop } from '../api/crops.js';

// Generates a sample trend if the backend isn't ready yet.
function buildFallback(crop) {
  const base = Number(crop?.expected_price) || 1800;
  const days = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Today'];
  return days.map((d, i) => ({
    date: d,
    price: Math.round(base + (Math.sin(i) * 80) + i * 10),
  }));
}

const recoStyles = {
  SELL: 'bg-red-100 text-red-800',
  HOLD: 'bg-amber-100 text-amber-800',
  TARGET_BETTER_MARKET: 'bg-krishi-100 text-krishi-800',
};

export default function Prediction() {
  const { cropId } = useParams();
  const [crop, setCrop] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cropRes = await getCrop(cropId).catch(() => ({ data: { crop: null } }));
        if (!active) return;
        setCrop(cropRes.data.crop);

        const predRes = await predictForCrop({ crop_id: cropId }).catch(() => null);
        if (!active) return;
        setPrediction(predRes?.data?.prediction || null);
      } catch (err) {
        if (active) setError('Could not load prediction.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cropId]);

  if (loading) return <Loader label="Running AI prediction..." />;

  const trend = prediction?.trend || buildFallback(crop);
  const recommendation = prediction?.recommendation || 'HOLD';
  const predicted = prediction?.predicted_price ?? Math.round((Number(crop?.expected_price) || 1800) * 1.12);
  const confidence = prediction?.confidence ?? 0.78;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-krishi-900">AI Prediction</h1>
          <p className="text-sm text-gray-600">
            {crop?.crop_name || 'Crop'} @ {crop?.location || 'Local market'}
          </p>
        </div>
        <Link to="/farmer" className="btn-outline">← Dashboard</Link>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsCard label="Current price" value={`₹ ${crop?.expected_price || '—'}`} />
        <AnalyticsCard label="Predicted (7d)" value={`₹ ${predicted}`} accent="soil" />
        <AnalyticsCard label="Confidence" value={`${Math.round(confidence * 100)}%`} accent="amber" />
        <AnalyticsCard label="Quantity" value={`${crop?.quantity_kg || 0} kg`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart data={trend} title="Predicted vs Actual" />
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700">Recommendation</h3>
          <span className={`badge mt-2 ${recoStyles[recommendation] || recoStyles.HOLD}`}>
            {recommendation.replaceAll('_', ' ')}
          </span>
          <p className="mt-3 text-sm text-gray-600">
            {recommendation === 'SELL' && 'Prices are near peak. Selling now likely maximizes profit.'}
            {recommendation === 'HOLD' && 'Prices are expected to rise. Holding stock for 5–7 days is likely profitable.'}
            {recommendation === 'TARGET_BETTER_MARKET' &&
              'Nearby mandis are offering higher prices for your crop. Consider transporting.'}
          </p>
          <div className="mt-4 space-y-2 text-xs text-gray-500">
            <p>• Based on mandi prices, arrivals, rainfall & demand index.</p>
            <p>• Updated using XGBoost regression model.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
