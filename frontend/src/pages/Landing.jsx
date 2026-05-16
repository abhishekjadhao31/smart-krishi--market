import { Link } from 'react-router-dom';

const features = [
  {
    icon: '📈',
    title: 'AI Price Prediction',
    desc: 'XGBoost-powered forecasts based on mandi prices, arrivals, rainfall and demand.',
  },
  {
    icon: '🧠',
    title: 'Sell or Hold Advice',
    desc: 'Decision support: sell now, hold stock, or target a better market.',
  },
  {
    icon: '🤝',
    title: 'Direct Buyer Match',
    desc: 'Skip middlemen — connect with verified buyers directly.',
  },
  {
    icon: '🚚',
    title: 'Smarter Logistics',
    desc: 'Recommendations factor in location and demand hotspots.',
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
              🌱 Hackathon MVP
            </span>
            <h1 className="text-4xl font-bold leading-tight text-krishi-900 sm:text-5xl">
              Turn farm data into <span className="text-krishi-600">smarter profits</span>.
            </h1>
            <p className="mt-4 text-lg text-gray-700">
              Smart Krishi Market uses AI to predict crop prices, recommend the right
              moment to sell, and connect farmers directly with buyers.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary">Get Started Free</Link>
              <Link to="/market-trends" className="btn-outline">View Market Trends</Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-krishi-700">+18%</p>
                <p className="text-xs text-gray-500">avg. profit lift</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-krishi-700">1.2k</p>
                <p className="text-xs text-gray-500">crops listed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-krishi-700">320+</p>
                <p className="text-xs text-gray-500">buyers connected</p>
              </div>
            </div>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="card w-full max-w-md">
              <p className="text-sm text-gray-500">Today's recommendation</p>
              <h3 className="mt-1 text-xl font-bold text-krishi-800">Tomato — Pune Mandi</h3>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Current price</p>
                  <p className="font-semibold">₹ 1,820 / qtl</p>
                </div>
                <div>
                  <p className="text-gray-500">Forecast (7d)</p>
                  <p className="font-semibold text-krishi-700">₹ 2,150 / qtl</p>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-krishi-100 p-3">
                <p className="text-sm font-semibold text-krishi-800">📌 Recommendation: HOLD</p>
                <p className="text-xs text-krishi-700">Demand rising; expect ~18% upside.</p>
              </div>
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
