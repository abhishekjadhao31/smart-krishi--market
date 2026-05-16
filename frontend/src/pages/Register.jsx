import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'farmer',
    location: '',
  });
  const [error, setError] = useState(null);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const user = await register(form);
      navigate(user.role === 'farmer' ? '/farmer' : '/buyer', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col px-4 py-10 sm:py-16">
      <div className="card">
        <h1 className="text-2xl font-bold text-krishi-800">Create your account</h1>
        <p className="mt-1 text-sm text-gray-600">Join farmers and buyers across India.</p>

        {/* Role toggle */}
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg bg-krishi-50 p-1">
          {['farmer', 'buyer'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setForm((f) => ({ ...f, role: r }))}
              className={`rounded-md py-2 text-sm font-medium capitalize transition ${
                form.role === r ? 'bg-white text-krishi-800 shadow' : 'text-gray-600'
              }`}
            >
              I am a {r}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" name="email" value={form.email} onChange={handleChange} required />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" name="phone" value={form.phone} onChange={handleChange} />
            </div>
          </div>
          <div>
            <label className="label">Location (district / mandi)</label>
            <input className="input" name="location" value={form.location} onChange={handleChange} placeholder="e.g. Pune, Maharashtra" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" name="password" value={form.password} onChange={handleChange} required minLength={6} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-krishi-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
