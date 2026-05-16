import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const user = await login(form);
      const from = location.state?.from?.pathname;
      const dest = from || (user.role === 'farmer' ? '/farmer' : '/buyer');
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 sm:py-16">
      <div className="card">
        <h1 className="text-2xl font-bold text-krishi-800">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-600">Sign in to your Krishi account.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          New to Krishi?{' '}
          <Link to="/register" className="font-medium text-krishi-700 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
