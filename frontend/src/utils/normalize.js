// Normalizers that bridge the backend's response shape (mostly snake_case
// from Postgres rows plus a `{ data: ... }` envelope) and the camelCase
// request bodies, into a single consistent snake_case object the React
// components consume.

export function normalizeCrop(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id ?? raw.cropId,
    crop_name: raw.crop_name ?? raw.cropName ?? '',
    variety: raw.variety ?? '',
    quantity_kg: Number(raw.quantity_kg ?? raw.quantityKg ?? 0) || 0,
    // Backend stores price_per_kg; old UI referred to expected_price for ₹/qtl.
    // We expose both for component convenience.
    price_per_kg: raw.price_per_kg != null ? Number(raw.price_per_kg) : raw.pricePerKg != null ? Number(raw.pricePerKg) : null,
    expected_price: raw.price_per_kg != null ? Number(raw.price_per_kg) : raw.pricePerKg != null ? Number(raw.pricePerKg) : null,
    state: raw.state ?? '',
    district: raw.district ?? '',
    market: raw.market ?? '',
    // Composite location for display ("District, State" / "Market, District")
    location:
      raw.location ??
      [raw.market, raw.district, raw.state].filter(Boolean).join(', '),
    latitude: raw.latitude != null ? Number(raw.latitude) : null,
    longitude: raw.longitude != null ? Number(raw.longitude) : null,
    harvest_date: raw.harvest_date ?? raw.harvestDate ?? null,
    storage_available: raw.storage_available ?? raw.storageAvailable ?? false,
    description: raw.description ?? '',
    image_url: raw.image_url ?? raw.imageUrl ?? null,
    status: raw.status ?? 'available',
    farmer_id: raw.farmer_id ?? raw.farmerId ?? null,
    farmer_name: raw.farmer_name ?? raw.farmerName ?? null,
    farmer_phone: raw.farmer_phone ?? raw.farmerPhone ?? null,
    farmer_email: raw.farmer_email ?? raw.farmerEmail ?? null,
    created_at: raw.created_at ?? raw.createdAt ?? null,
  };
}

// Backend envelopes: { data: [...] } | { crops: [...] } | bare array.
export function extractCropList(payload) {
  const list =
    (Array.isArray(payload) && payload) ||
    payload?.data ||
    payload?.crops ||
    payload?.rows ||
    [];
  return list.map(normalizeCrop);
}

export function extractCrop(payload) {
  const raw = payload?.data ?? payload?.crop ?? payload;
  return normalizeCrop(raw);
}

// Normalize a prediction response (ml-service shape, forwarded by backend).
// Backend wraps in { data: <ml response> }.
export function normalizePrediction(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw.data ?? raw.prediction ?? raw;
  if (!p || typeof p !== 'object') return null;
  return {
    crop_name: p.cropName ?? p.crop_name ?? '',
    current_price: p.currentPrice ?? p.current_price ?? null,
    predicted_price: p.predictedPrice ?? p.predicted_price ?? null,
    confidence: p.confidence ?? null,
    recommendation: p.recommendation ?? 'HOLD',
    // Best-day-to-sell pick (added by ML service per-day forecast):
    best_day: p.bestDay ?? p.best_day ?? null,
    best_date: p.bestDate ?? p.best_date ?? null,
    best_price: p.bestPrice ?? p.best_price ?? null,
    best_gain_pct: p.bestGainPct ?? p.best_gain_pct ?? null,
    method: p.method ?? 'stat',
    horizon_days: p.horizonDays ?? p.horizon_days ?? 7,
    // Full per-day forecast curve (1..horizonDays).
    forecast: Array.isArray(p.forecast)
      ? p.forecast.map((f) => ({
          day: Number(f.day ?? 0),
          date: f.date,
          price: Number(f.price ?? 0),
          confidence: Number(f.confidence ?? 0),
          lower: f.lowerPrice != null ? Number(f.lowerPrice) : f.lower_price != null ? Number(f.lower_price) : null,
          upper: f.upperPrice != null ? Number(f.upperPrice) : f.upper_price != null ? Number(f.upper_price) : null,
        }))
      : [],
    factors: Array.isArray(p.factors)
      ? p.factors.map((f) => ({
          date: f.date,
          kind: f.kind ?? 'history',
          price: f.price != null ? Number(f.price) : null,
          arrivals: f.arrivals != null ? Number(f.arrivals) : null,
          temp_avg_c: f.tempAvgC ?? f.temp_avg_c ?? null,
          temp_min_c: f.tempMinC ?? f.temp_min_c ?? null,
          temp_max_c: f.tempMaxC ?? f.temp_max_c ?? null,
          rainfall_mm: f.rainfallMm ?? f.rainfall_mm ?? null,
          humidity_pct: f.humidityPct ?? f.humidity_pct ?? null,
          wind_kmph: f.windKmph ?? f.wind_kmph ?? null,
          weather_label: f.weatherLabel ?? f.weather_label ?? '',
        }))
      : [],
    trend: Array.isArray(p.trend)
      ? p.trend.map((t) => ({
          date: t.date,
          price: Number(t.price ?? t.modal_price ?? 0),
          predicted: t.predicted ?? null,
        }))
      : [],
    outlook: p.outlook ?? null,
    diagnostics: p.diagnostics ?? null,
    metrics: p.metrics ?? {},
  };
}

// Normalize a market_prices row from /api/market-prices.
export function normalizeMarketPrice(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    state: raw.state ?? '',
    district: raw.district ?? '',
    market: raw.market ?? '',
    commodity: raw.commodity ?? '',
    variety: raw.variety ?? '',
    min_price: Number(raw.min_price ?? 0),
    max_price: Number(raw.max_price ?? 0),
    modal_price: Number(raw.modal_price ?? 0),
    price_date: raw.price_date ?? null,
    arrivals: Number(raw.arrivals ?? 0),
    unit: raw.unit ?? '',
    day_of_week: raw.day_of_week ?? null,
    month: raw.month ?? null,
    lag_1_price: raw.lag_1_price ?? null,
    lag_7_price: raw.lag_7_price ?? null,
    rolling_avg_7: raw.rolling_avg_7 ?? null,
    rolling_avg_30: raw.rolling_avg_30 ?? null,
    price_trend: raw.price_trend ?? null,
    arrivals_trend: raw.arrivals_trend ?? null,
    source: raw.source ?? '',
  };
}

export function extractMarketPriceList(payload) {
  const list =
    (Array.isArray(payload) && payload) ||
    payload?.data ||
    payload?.prices ||
    payload?.rows ||
    [];
  return list.map(normalizeMarketPrice);
}
