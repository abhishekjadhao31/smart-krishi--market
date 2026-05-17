import { Link } from 'react-router-dom';
import LiveMandiPrice from '../components/LiveMandiPrice.jsx';

const features = [
  {
    icon: '📈',
    title: 'Price outlook',
    desc: 'Forecasts built from mandi prices, arrivals, rainfall, and historical trends.',
  },
  {
    icon: '💬',
    title: 'AI assistant',
    desc: 'Ask for sell-or-wait guidance, fair price checks, and negotiation tips.',
  },
  {
    icon: '🧠',
    title: 'Sell or hold guidance',
    desc: 'Simple recommendations for when to sell, wait, or check a better market.',
  },
  {
    icon: '🤝',
    title: 'Buyer matching',
    desc: 'Connect with buyers who are actively looking for your crop.',
  },
  {
    icon: '🚚',
    title: 'Logistics support',
    desc: 'Route and carrier suggestions that factor in location and demand.',
  },
];

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-krishi-100 via-krishi-50 to-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24 lg:px-8">
          <div className="flex flex-col justify-center">
            <span className="badge mb-4 w-fit bg-krishi-200 text-krishi-800">
              🌱 Maharashtra market intelligence
            </span>
            <h1 className="text-4xl font-bold leading-tight text-krishi-900 sm:text-5xl">
              Turn farm data into <span className="text-krishi-600">better selling decisions</span>.
            </h1>
            <p className="mt-4 text-lg text-gray-700">
              Smart Krishi Market helps farmers read prices, compare nearby markets,
              and choose the best time to sell with confidence.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary">Get Started Free</Link>
              <Link to="/assistant" className="btn-ghost">Open AI Assistant</Link>
              <Link to="/market-trends" className="btn-outline">View Market Trends</Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-krishi-700">Live</p>
                <p className="text-xs text-gray-500">market prices</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-krishi-700">6 mo</p>
                <p className="text-xs text-gray-500">historic trend data</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-krishi-700">6</p>
                <p className="text-xs text-gray-500">Maharashtra districts</p>
              </div>
            </div>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="w-full max-w-md">
              <LiveMandiPrice commodity="Potato" district="Mumbai" />
              <p className="mt-2 text-center text-[11px] text-gray-500">
                Live price feed refreshed from Agmarknet-backed data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-krishi-900 sm:text-3xl">
          Built for every step of the supply chain
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">
          From listing your crop to closing the deal, our AI works alongside you.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 text-lg font-semibold text-krishi-800">{f.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="card flex flex-col items-center gap-4 bg-krishi-600 text-white sm:flex-row sm:justify-between">
          <div>
            <h3 className="text-xl font-bold">Ready to maximize your harvest?</h3>
            <p className="text-sm text-krishi-100">Sign up as a farmer or buyer in under a minute.</p>
          </div>
          <Link to="/register" className="btn bg-white text-krishi-700 hover:bg-krishi-100">
            Create Account →
          </Link>
        </div>
      </section>
    </div>
  );
}
