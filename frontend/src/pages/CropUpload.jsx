import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCrop } from '../api/crops.js';

const cropOptions = ['Tomato', 'Onion', 'Potato', 'Wheat', 'Rice', 'Soybean', 'Cotton', 'Sugarcane'];

export default function CropUpload() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    crop_name: 'Tomato',
    quantity_kg: '',
    expected_price: '',
    location: '',
    harvest_date: '',
    arrivals: '',
    rainfall_mm: '',
    demand_index: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await createCrop(form);
      navigate(`/farmer/prediction/${data.crop.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save crop. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-krishi-900">List a new crop</h1>
      <p className="text-sm text-gray-600">
        Fill in the details — our AI will predict the best price and recommend an action.
      </p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Crop</label>
            <select className="input" name="crop_name" value={form.crop_name} onChange={handleChange} required>
              {cropOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quantity (kg)</label>
            <input className="input" type="number" name="quantity_kg" value={form.quantity_kg} onChange={handleChange} required min={1} />
          </div>
          <div>
            <label className="label">Expected price (₹/qtl)</label>
            <input className="input" type="number" name="expected_price" value={form.expected_price} onChange={handleChange} />
          </div>
          <div>
            <label className="label">Harvest date</label>
            <input className="input" type="date" name="harvest_date" value={form.harvest_date} onChange={handleChange} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Location (district / mandi)</label>
            <input className="input" name="location" value={form.location} onChange={handleChange} required placeholder="e.g. Pune, Maharashtra" />
          </div>
        </div>

        <div className="border-t border-krishi-100 pt-4">
          <h3 className="text-sm font-semibold text-krishi-800">Market signals (optional, improves AI accuracy)</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Arrivals (qtl)</label>
              <input className="input" type="number" name="arrivals" value={form.arrivals} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Rainfall (mm)</label>
              <input className="input" type="number" name="rainfall_mm" value={form.rainfall_mm} onChange={handleChange} />
            </div>
            <div>
              <label className="label">Demand index (0–100)</label>
              <input className="input" type="number" name="demand_index" value={form.demand_index} onChange={handleChange} min={0} max={100} />
            </div>
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input" name="notes" rows={3} value={form.notes} onChange={handleChange} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/farmer')} className="btn-outline">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Saving & predicting...' : 'Save & predict'}
          </button>
        </div>
      </form>
    </div>
  );
}
