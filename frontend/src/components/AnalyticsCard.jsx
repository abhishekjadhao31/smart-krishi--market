// Small stat card used across dashboards.
export default function AnalyticsCard({ label, value, hint, accent = 'krishi' }) {
  const accentMap = {
    krishi: 'text-krishi-700 bg-krishi-100',
    soil: 'text-soil-700 bg-soil-100',
    amber: 'text-amber-700 bg-amber-100',
    red: 'text-red-700 bg-red-100',
  };
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <span className={`badge ${accentMap[accent] || accentMap.krishi}`}>●</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
