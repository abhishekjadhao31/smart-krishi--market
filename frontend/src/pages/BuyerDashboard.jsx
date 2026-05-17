import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AnalyticsCard from '../components/AnalyticsCard.jsx';
import Loader from '../components/Loader.jsx';
import { listCrops } from '../api/crops.js';
import { searchForBuyer } from '../api/buyers.js';
import { createConversation } from '../api/conversations.js';
import { extractCropList } from '../utils/normalize.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function BuyerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ crop: '', location: '', maxPrice: '' });
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactingId, setContactingId] = useState(null);
  const [contactError, setContactError] = useState('');

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

  const openConversation = async (crop) => {
    setContactingId(crop.id);
    setContactError('');
    try {
      const { data } = await createConversation({
        farmerId: crop.farmer_id,
        listingId: crop.id,
      });
      navigate(`/messages?conversationId=${data.data.id}`);
    } catch (err) {
      setContactError(err.response?.data?.message || 'Could not start conversation.');
    } finally {
      setContactingId(null);
    }
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

      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/buyer/matches" className="btn-outline">View matches</Link>
        <Link to="/logistics" className="btn-primary">Plan transport</Link>
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
        {contactError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {contactError}
          </div>
        )}
        {loading ? (
          <Loader label="Finding the best matches..." />
        ) : crops.length === 0 ? (
          <div className="card mt-3 text-center text-gray-600">No matching crops yet.</div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {crops.map((c) => (
              <div key={c.id} className="card flex flex-col">
                {c.image_url && (
                  <img src={c.image_url} alt={c.crop_name} className="h-32 w-full object-cover rounded-md" />
                )}
                <div className="flex-1 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-krishi-800">{c.crop_name}</h3>
                    <Link to={`/crops/${c.id}`} className="text-xs font-medium text-krishi-700 hover:text-krishi-800">Details</Link>
                  </div>
                  {c.variety && <p className="text-xs text-gray-500">{c.variety}</p>}
                  <p className="text-sm text-gray-600">
                    {c.farmer_name || 'Unknown farmer'}
                    {c.district && ` • ${c.district}`}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-lg font-semibold text-krishi-700">
                      ₹{c.price_per_kg ? c.price_per_kg.toFixed(0) : '—'}/kg
                    </span>
                    <span className="text-xs text-gray-500">{c.quantity_kg} kg</span>
                  </div>
                </div>
                <button
                  onClick={() => openConversation(c)}
                  className="btn-primary mt-3 w-full text-sm"
                  disabled={contactingId === c.id}
                >
                  {contactingId === c.id ? 'Opening...' : 'Contact Farmer'}
                </button>
                <Link to={`/logistics?cropId=${c.id}`} className="btn-outline mt-2 w-full text-sm">🚚 Transport</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
