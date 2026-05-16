import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCrop } from '../api/crops.js';

// Hackathon MVP: model is trained on a Maharashtra Potato dataset only.
// Adding other crops would require retraining — restrict the UI so the demo
// is honest about what the model actually supports.
const cropOptions = ['Potato'];
const districtOptions = ['Mumbai', 'Pune', 'Nashik', 'Solapur', 'Kolhapur'];
const marketOptions = [
  'Mumbai-Onion & Potato Market APMC',
  'Pune-Market Yard',
  'Nashik APMC',
];

// Drop blanks, coerce numerics, leave strings as-is. The form already uses
// the backend's camelCase field names so no key renaming is needed.
function buildPayload(form) {
  const numeric = new Set(['quantityKg', 'pricePerKg']);
  const out = {};
  for (const [k, v] of Object.entries(form)) {
    if (v === '' || v == null) continue;
    if (k === 'storageAvailable') {
      out[k] = Boolean(v);
      continue;
    }
    if (numeric.has(k)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function extractError(err) {
  if (!err) return { summary: 'Could not save crop.', fields: [] };
  if (err.response) {
    const { status, data } = err.response;
    if (typeof data === 'string') return { summary: `Backend ${status}: ${data}`, fields: [] };
    const summary = data?.error || data?.message || `Backend ${status}`;
    const list = data?.details || data?.errors || [];
    const fields = Array.isArray(list)
      ? list.map((e) => ({
          field: e.field || e.path || e.param || '',
          message: e.message || e.msg || '',
        }))
      : [];
    return { summary, fields };
  }
  if (err.request) return { summary: 'No response from backend. Is it running on :5000?', fields: [] };
  return { summary: err.message || 'Could not save crop.', fields: [] };
}

export default function CropUpload() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    cropName: 'Potato',
    variety: 'Local',
    quantityKg: '',
    pricePerKg: '',
    state: 'Maharashtra',
    district: 'Mumbai',
    market: 'Mumbai-Onion & Potato Market APMC',
    harvestDate: '',
    storageAvailable: false,
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildPayload(form);
      const { data } = await createCrop(payload);
      const created = data?.data ?? data?.crop ?? data;
      const cropId = created?.id ?? created?.cropId;
      if (cropId) {
        navigate(`/farmer/prediction/${cropId}`);
      } else {
        navigate('/farmer');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('createCrop failed:', err.response || err);
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-krishi-900">List a new crop</h1>
      <p className="text-sm text-gray-600">
        Fill in the details — our AI will predict the price for the next 7 days
        and tell you how much profit you can expect.
      </p>
      <p className="mt-1 text-xs text-krishi-700">
        🧪 MVP scope: model trained on 6 months of Maharashtra Potato APMC data.
      </p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Crop *</label>
            <select className="input" name="cropName" value={form.cropName} onChange={handleChange} required>
              {cropOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Variety</label>
            <input className="input" name="variety" value={form.variety} onChange={handleChange} placeholder="e.g. Hybrid, Local" />
          </div>
          <div>
            <label className="label">Quantity (kg) *</label>
            <input className="input" type="number" name="quantityKg" value={form.quantityKg} onChange={handleChange} required min={1} step="any" />
          </div>
          <div>
            <label className="label">Price per kg (₹)</label>
            <input className="input" type="number" name="pricePerKg" value={form.pricePerKg} onChange={handleChange} min={0} step="any" />
          </div>
        </div>

        <div className="border-t border-krishi-100 pt-4">
          <h3 className="text-sm font-semibold text-krishi-800">Location</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">State</label>
              <input className="input" name="state" value={form.state} onChange={handleChange} />
            </div>
            <div>
              <label className="label">District</label>
              <select className="input" name="district" value={form.district} onChange={handleChange}>
                {districtOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Market (APMC)</label>
              <select className="input" name="market" value={form.market} onChange={handleChange}>
                {marketOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Harvest date</label>
            <input className="input" type="date" name="harvestDate" value={form.harvestDate} onChange={handleChange} />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="storageAvailable"
                checked={form.storageAvailable}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-krishi-600 focus:ring-krishi-500"
              />
              Storage available (can hold)
            </label>
          </div>
        </div>

        <div>
          <label className="label">Description / notes</label>
          <textarea className="input" name="description" rows={3} value={form.description} onChange={handleChange} />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p className="font-medium">Save failed</p>
            <p className="mt-1 break-words">{error.summary}</p>
            {error.fields?.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                {error.fields.map((f, i) => (
                  <li key={i}>
                    {f.field ? <strong>{f.field}: </strong> : null}
                    {f.message}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-red-500">See browser console for full response.</p>
          </div>
        )}

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
