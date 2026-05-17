import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { searchMatches } from '../api/match.js';
import MatchCard from '../components/MatchCard.jsx';

export default function MatchSearch() {
  const { user } = useAuth();
  const [form, setForm] = useState({ cropName: '', maxPrice: '', quantityNeeded: '' });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const onChange = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const runSearch = async () => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        buyerLat: user?.latitude || null,
        buyerLon: user?.longitude || null,
      };
      const { data } = await searchMatches(payload);
      setResults(data || []);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestContact = (listingId) => {
    // TODO: open contact modal or send message
    alert(`Request contact for listing ${listingId}`);
  };

  const handleNegotiate = (listingId) => {
    // TODO: open negotiation modal
    alert(`Start negotiation for listing ${listingId}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Find Farmers</h1>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input className="input" placeholder="Crop name" value={form.cropName} onChange={onChange('cropName')} />
        <input className="input" placeholder="Max price (₹/kg)" value={form.maxPrice} onChange={onChange('maxPrice')} />
        <input className="input" placeholder="Quantity (kg)" value={form.quantityNeeded} onChange={onChange('quantityNeeded')} />
      </div>
      <div className="mt-3">
        <button className="btn-primary" onClick={runSearch} disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {results.map((r, i) => (
          <MatchCard key={i} item={r} onRequestContact={handleRequestContact} onNegotiate={handleNegotiate} />
        ))}
      </div>
    </div>
  );
}
