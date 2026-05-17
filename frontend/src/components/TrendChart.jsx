import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Area,
} from 'recharts';

// Generic price-trend line chart. `data` is an array of { date, price, predicted? } objects.
export default function TrendChart({ data = [], title = 'Price Trend', outlook = null }) {
  // Prepare data with a 'band' value for stacked area rendering when lower/upper exist
  const processed = data.map((d) => {
    const lower = d.lower != null ? Number(d.lower) : null;
    const upper = d.upper != null ? Number(d.upper) : null;
    return {
      ...d,
      lower: lower,
      upper: upper,
      band: lower != null && upper != null ? Number((upper - lower).toFixed(2)) : null,
    };
  });
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          {outlook && <div className="text-xs text-gray-500">Outlook: {outlook}</div>}
        </div>
        <span className="text-xs text-gray-400">₹ / quintal</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={processed} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {processed.some((d) => d.lower != null && d.upper != null) && (
              <>
                <Area dataKey="lower" stackId="band" stroke="none" fill="transparent" activeDot={false} />
                <Area dataKey="band" stackId="band" stroke="none" fill="#b8f0c2" fillOpacity={0.22} activeDot={false} />
              </>
            )}
            <Line type="monotone" dataKey="price" stroke="#2b7e2b" strokeWidth={2} dot={false} />
            {data.some((d) => d.predicted != null) && (
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#a07c4a"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
