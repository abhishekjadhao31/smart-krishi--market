import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import { getMatchesForBuyer } from '../api/buyerRequests.js';

function normalizeMatch(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    listing_id: raw.listing_id ?? raw.listingId ?? null,
    crop_name: raw.crop_name ?? raw.cropName ?? '',
    farmer_name: raw.farmer_name ?? raw.farmerName ?? '',
    total_score: raw.total_score != null ? Number(raw.total_score) : null,
    quantity_kg: raw.quantity_kg != null ? Number(raw.quantity_kg) : null,
    price_per_kg: raw.price_per_kg != null ? Number(raw.price_per_kg) : null,
    distance_km: raw.distance_km != null ? Number(raw.distance_km) : null,
  };
}

function extractMatchList(payload) {
  const list = (Array.isArray(payload) && payload) || payload?.data || payload?.matches || payload?.rows || [];
  return list.map(normalizeMatch);
}

export default function MatchResults() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const buyerId = user?.id;
        if (!buyerId) {
          setMatches([]);
          return;
        }
        const { data } = await getMatchesForBuyer(buyerId);
        if (!mounted) return;
        setMatches(extractMatchList(data));
      } catch (err) {
        setError(err?.response?.data || { message: err.message });
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  if (loading) return <Loader label="Fetching matches…" />;
  if (error) return <div className="mx-auto max-w-3xl px-4 py-8"><div className="card text-red-600">Error: {error.message}</div></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-krishi-900">Your Matches</h1>
      <p className="text-sm text-gray-600">Top matches for your buyer requests, ranked by score.</p>

      {matches.length === 0 ? (
        <div className="card mt-4 text-center text-gray-600">No matches yet. Create a buyer request to see matches.</div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((m) => (
            <div key={m.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-krishi-800">{m.crop_name}</h3>
                  <p className="text-sm text-gray-600">Farmer: {m.farmer_name}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-krishi-700">
                    {m.total_score != null ? m.total_score.toFixed(1) : '—'}
                  </div>
                  <div className="text-xs text-gray-500">score</div>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-700">
                <div>Quantity: {m.quantity_kg != null ? `${m.quantity_kg} kg` : '—'}</div>
                <div>Price: {m.price_per_kg != null ? `₹${m.price_per_kg}/kg` : '—'}</div>
                <div>Distance: {m.distance_km != null ? `${m.distance_km} km` : '—'}</div>
              </div>
              <div className="mt-3 flex gap-2">
                <a href={`/crops/${m.listing_id}`} className="btn-outline flex-1">View listing</a>
                <button className="btn-primary flex-1">Request contact</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
