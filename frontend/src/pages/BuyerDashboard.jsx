import { useEffect, useState } from 'react';
import AnalyticsCard from '../components/AnalyticsCard.jsx';
import CropCard from '../components/CropCard.jsx';
import Loader from '../components/Loader.jsx';
import { listCrops } from '../api/crops.js';
import { searchForBuyer } from '../api/buyers.js';
import { extractCropList } from '../utils/normalize.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function BuyerDashboard() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ crop: '', location: '', maxPrice: '' });
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCrops = async (payload = {}) => {
    setLoading(true);
    try {
      const { data } = payload && Object.values(payload).some(Boolean)
        ? await searchForBuyer(payload)
        : await listCrops();
      setCrops(extractCropList(data));
    } catch {
      setCrops([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrops();
  }, []);

  const handleChange = (e) => setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));
  const handleSearch = (e) => {
    e.preventDefault();
    fetchCrops(filters);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-krishi-900">
          Hello, {user?.name?.split(' ')[0] || 'Buyer'} 👋
        </h1>
        <p className="text-sm text-gray-600">Find the right crop, at the right price.</p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <AnalyticsCard label="Available listings" value={crops.length} />
        <AnalyticsCard label="Active farmers" value="86" accent="soil" />
        <AnalyticsCard label="AI matches today" value="9" accent="amber" />
      </div>

      <form onSubmit={handleSearch} className="card mt-6 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-1">
          <label className="label">Crop</label>
          <input className="input" name="crop" value={filters.crop} onChange={handleChange} placeholder="e.g. Tomato" />
        </div>
        <div className="sm:col-span-1">
          <label className="label">Location</label>
          <input className="input" name="location" value={filters.location} onChange={handleChange} placeholder="District / mandi" />
        </div>
        <div className="sm:col-span-1">
          <label className="label">Max price (₹/qtl)</label>
          <input className="input" type="number" name="maxPrice" value={filters.maxPrice} onChange={handleChange} />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full">Search</button>
        </div>
      </form>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-krishi-800">Recommended listings</h2>
        {loading ? (
          <Loader label="Finding the best matches..." />
        ) : crops.length === 0 ? (
          <div className="card mt-3 text-center text-gray-600">No matching crops yet.</div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {crops.map((c) => (
              <CropCard key={c.id} crop={c} actionLabel="Contact farmer" actionTo={`/buyer`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
