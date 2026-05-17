import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AnalyticsCard from '../components/AnalyticsCard.jsx';
import TrendChart from '../components/TrendChart.jsx';
import Loader from '../components/Loader.jsx';
import { getCrop, predictForCrop } from '../api/crops.js';
import { extractCrop, normalizePrediction } from '../utils/normalize.js';

const recoStyles = {
  SELL_TODAY: 'bg-red-100 text-red-800',
  WAIT_N_DAYS: 'bg-krishi-100 text-krishi-800',
  TARGET_BETTER_MARKET: 'bg-amber-100 text-amber-800',
  HOLD: 'bg-amber-100 text-amber-800',
  // Legacy keys, kept so older responses still render:
  SELL: 'bg-red-100 text-red-800',
};

const recoLabel = {
  SELL_TODAY: 'SELL TODAY',
  WAIT_N_DAYS: 'WAIT TO SELL',
  TARGET_BETTER_MARKET: 'TARGET BETTER MARKET',
  HOLD: 'HOLD',
  SELL: 'SELL',
};

// Format the chart x-axis nicely.
const fmt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

const fmtLongDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      });
};

export default function Prediction() {
  const { cropId } = useParams();
  const [crop, setCrop] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [predictError, setPredictError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setPredictError(null);
      try {
        // 1) Hydrate the crop so we have cropName + location to send to /predict.
        const cropRes = await getCrop(cropId).catch(() => null);
        const c = cropRes ? extractCrop(cropRes.data) : null;
        if (!active) return;
        setCrop(c);

        if (!c?.crop_name) {
          setPredictError('Crop not found.');
          return;
        }

        // 2) Ask the backend for a prediction (it proxies to ml-service).
        const predBody = {
          cropName: c.crop_name,
          state: c.state || undefined,
          district: c.district || undefined,
          market: c.market || undefined,
          quantityKg: c.quantity_kg || undefined,
          harvestDate: c.harvest_date || undefined,
          // 14-day window so the model has enough room to recommend
          // "wait N days" with a meaningful peak.
          horizonDays: 14,
        };
        const predRes = await predictForCrop(predBody);
        if (!active) return;
        setPrediction(normalizePrediction(predRes?.data));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('prediction failed:', err.response || err);
        if (active) {
          setPredictError(
            err.response?.data?.message ||
              err.response?.data?.error ||
              'Prediction service is unavailable. Is ml-service running on :8000?'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cropId]);

  if (loading) return <Loader label="Running AI prediction..." />;

  const currentPrice =
    prediction?.current_price ??
    (crop?.price_per_kg != null ? Number(crop.price_per_kg) * 100 : null); // ₹/kg -> ₹/qtl ish
  const forecast = prediction?.forecast || [];
  const predicted = prediction?.predicted_price ?? null;
  const confidence = prediction?.confidence ?? null;
  const recommendation = prediction?.recommendation || 'HOLD';
  const method = prediction?.method || 'stat';
  const factors = prediction?.factors || [];

  // Best-day-to-sell fields from the ML service.
  const bestDay = prediction?.best_day ?? null;       // 0 = today
  const bestDate = prediction?.best_date ?? null;
  const bestPrice = prediction?.best_price ?? predicted;
  const bestGainPct = prediction?.best_gain_pct ?? null;
  const bestConfidence =
    bestDay && forecast.length
      ? forecast.find((f) => f.day === bestDay)?.confidence ?? confidence
      : confidence;

  // Build chart data — historical trend then per-day forecast as a dashed line.
  // We carry `price` for actuals and `predicted` for forecast points.
  const trendNodes = (prediction?.trend || []).map((t) => ({
    date: fmt(t.date),
    rawDate: t.date,
    price: t.price,
    predicted: t.predicted ?? null,
  }));
  const forecastNodes = forecast.map((f) => ({
    date: fmt(f.date),
    rawDate: f.date,
    price: null,
    predicted: f.price,
  }));
  const trend = [...trendNodes, ...forecastNodes];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-krishi-900">AI Prediction</h1>
          <p className="text-sm text-gray-600">
            {crop?.crop_name || 'Crop'} @ {crop?.location || 'Local market'}
            {method && (
              <span className="ml-2 badge bg-krishi-100 text-krishi-700">
                {method === 'xgboost' ? 'XGBoost' : 'Statistical'}
              </span>
            )}
          </p>
        </div>
        <Link to="/farmer" className="btn-outline">← Dashboard</Link>
      </div>

      {predictError && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {predictError}
        </div>
      )}

      {/* Best-day-to-sell hero — the headline answer. */}
      {bestPrice != null && (
        <div
          className={`mt-6 card border-l-4 ${
            bestDay === 0 ? 'border-red-500' : 'border-krishi-500'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                AI says
              </p>
              <h2
                className={`mt-1 text-3xl font-bold ${
                  bestDay === 0 ? 'text-red-700' : 'text-krishi-800'
                }`}
              >
                {bestDay === 0
                  ? 'Sell today'
                  : bestDay === 1
                    ? 'Sell tomorrow'
                    : `Wait ${bestDay} days — sell on ${fmtLongDate(bestDate)}`}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {bestDay === 0
                  ? 'Today’s price is the peak across the forecast window. Selling now likely maximizes profit.'
                  : `Modal price is projected to peak at ₹${Math.round(bestPrice).toLocaleString()}/qtl on ${fmtLongDate(bestDate)}` +
                    (bestGainPct != null
                      ? ` (${bestGainPct >= 0 ? '+' : ''}${bestGainPct}% vs today).`
                      : '.')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge bg-krishi-100 text-krishi-700">
                {method === 'xgboost' ? 'XGBoost' : 'Statistical'}
              </span>
              {bestConfidence != null && (
                <span className="badge bg-amber-100 text-amber-700">
                  {Math.round(bestConfidence * 100)}% confidence
                </span>
              )}
              <span className="badge bg-soil-100 text-soil-700">
                {prediction?.horizon_days || 7}-day window
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsCard
          label="Current modal price"
          value={currentPrice != null ? `₹ ${Math.round(currentPrice).toLocaleString()} / qtl` : '—'}
          hint="today"
        />
        <AnalyticsCard
          label={bestDay === 0 ? 'Peak (today)' : `Peak in ${bestDay ?? '—'} day${bestDay === 1 ? '' : 's'}`}
          value={bestPrice != null ? `₹ ${Math.round(bestPrice).toLocaleString()} / qtl` : '—'}
          hint={bestDate ? fmtLongDate(bestDate) : ''}
          accent="soil"
        />
        <AnalyticsCard
          label="Forecast confidence"
          value={bestConfidence != null ? `${Math.round(bestConfidence * 100)}%` : '—'}
          hint={`day ${bestDay ?? 0} of ${prediction?.horizon_days || 7}`}
          accent="amber"
        />
        <AnalyticsCard
          label="Listed quantity"
          value={`${Number(crop?.quantity_kg || 0).toLocaleString()} kg`}
        />
      </div>

      {/* Profit projection — based on the BEST sell day, not just horizon day. */}
      {bestPrice != null && crop?.quantity_kg ? (
        (() => {
          const qty = Number(crop.quantity_kg) || 0; // kg
          const predPerKg = bestPrice / 100; // ML returns ₹/qtl, convert to ₹/kg
          const askPerKg = crop?.price_per_kg != null ? Number(crop.price_per_kg) : null;
          const mandiPerKg = currentPrice != null ? currentPrice / 100 : null;

          const revenueAtPredicted = predPerKg * qty;
          const revenueAtAsking = askPerKg != null ? askPerKg * qty : null;
          const revenueAtMandi = mandiPerKg != null ? mandiPerKg * qty : null;

          const gainVsAsking = revenueAtAsking != null ? revenueAtPredicted - revenueAtAsking : null;
          const gainVsMandi = revenueAtMandi != null ? revenueAtPredicted - revenueAtMandi : null;

          const fmtMoney = (n) =>
            n == null
              ? '—'
              : `${n >= 0 ? '+' : '−'}₹ ${Math.abs(Math.round(n)).toLocaleString()}`;
          const pct = (gain, base) =>
            gain == null || !base ? null : Math.round((gain / base) * 100);

          const peakLabel =
            bestDay === 0
              ? 'today'
              : bestDate
                ? `on ${fmtLongDate(bestDate)}`
                : `in ${bestDay ?? '—'} day${bestDay === 1 ? '' : 's'}`;

          return (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-krishi-900">
                Profit projection for {qty.toLocaleString()} kg — selling {peakLabel}
              </h2>
              <p className="text-xs text-gray-500">
                Compares the revenue at the forecast peak (₹{Math.round(bestPrice).toLocaleString()}/qtl) against two baselines.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {/* vs farmer's asking price */}
                <div className="card border-l-4 border-krishi-500">
                  <p className="text-sm text-gray-500">vs your asking price</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Asking: {askPerKg != null ? `₹${askPerKg}/kg` : '—'}
                    {' → '}
                    Predicted: ₹{predPerKg.toFixed(2)}/kg
                  </p>
                  <p
                    className={`mt-3 text-3xl font-bold ${
                      gainVsAsking == null
                        ? 'text-gray-400'
                        : gainVsAsking >= 0
                          ? 'text-krishi-700'
                          : 'text-red-600'
                    }`}
                  >
                    {fmtMoney(gainVsAsking)}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {revenueAtAsking != null && revenueAtPredicted != null ? (
                      <>
                        Revenue: ₹{Math.round(revenueAtAsking).toLocaleString()} →{' '}
                        <strong>₹{Math.round(revenueAtPredicted).toLocaleString()}</strong>
                        {pct(gainVsAsking, revenueAtAsking) != null && (
                          <span className="ml-1 text-krishi-600">
                            ({pct(gainVsAsking, revenueAtAsking) >= 0 ? '+' : ''}
                            {pct(gainVsAsking, revenueAtAsking)}%)
                          </span>
                        )}
                      </>
                    ) : (
                      'Set a price per kg when listing to see this comparison.'
                    )}
                  </p>
                </div>

                {/* vs current mandi price */}
                <div className="card border-l-4 border-soil-500">
                  <p className="text-sm text-gray-500">vs current mandi modal</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Mandi: {mandiPerKg != null ? `₹${mandiPerKg.toFixed(2)}/kg` : '—'}
                    {' → '}
                    Predicted: ₹{predPerKg.toFixed(2)}/kg
                  </p>
                  <p
                    className={`mt-3 text-3xl font-bold ${
                      gainVsMandi == null
                        ? 'text-gray-400'
                        : gainVsMandi >= 0
                          ? 'text-krishi-700'
                          : 'text-red-600'
                    }`}
                  >
                    {fmtMoney(gainVsMandi)}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {revenueAtMandi != null && revenueAtPredicted != null ? (
                      <>
                        Revenue: ₹{Math.round(revenueAtMandi).toLocaleString()} →{' '}
                        <strong>₹{Math.round(revenueAtPredicted).toLocaleString()}</strong>
                        {pct(gainVsMandi, revenueAtMandi) != null && (
                          <span className="ml-1 text-soil-600">
                            ({pct(gainVsMandi, revenueAtMandi) >= 0 ? '+' : ''}
                            {pct(gainVsMandi, revenueAtMandi)}%)
                          </span>
                        )}
                      </>
                    ) : (
                      'Mandi reference unavailable for this commodity.'
                    )}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-gray-400">
                Projection = (peak ₹/qtl ÷ 100) × {qty.toLocaleString()} kg. Forecast is a
                day-by-day XGBoost estimate on Maharashtra APMC data — treat as guidance, not
                guarantee.
              </p>
            </div>
          );
        })()
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {trend.length > 0 ? (
            <TrendChart data={trend} title="Historical & predicted" outlook={prediction?.outlook} />
          ) : (
            <div className="card text-center text-sm text-gray-500">
              No history available for {crop?.crop_name} in {crop?.district || 'this district'} yet.
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700">Recommendation</h3>
          <span className={`badge mt-2 ${recoStyles[recommendation] || recoStyles.HOLD}`}>
            {recoLabel[recommendation] || recommendation.replaceAll('_', ' ')}
          </span>

          {/* Plain-language explanation that pivots on the chosen sell day. */}
          <p className="mt-3 text-sm text-gray-600">
            {recommendation === 'SELL_TODAY' &&
              'Forecast shows no upside in the coming days. Selling today likely maximizes your profit.'}
            {recommendation === 'WAIT_N_DAYS' && bestDay != null && (
              <>
                Modal price is projected to rise. Hold stock for{' '}
                <strong>{bestDay} day{bestDay === 1 ? '' : 's'}</strong> — peak is{' '}
                <strong>{bestDate ? fmtLongDate(bestDate) : 'soon'}</strong>
                {bestGainPct != null && (
                  <> at <strong>+{bestGainPct}%</strong></>
                )}.
              </>
            )}
            {recommendation === 'TARGET_BETTER_MARKET' &&
              'Prices nearby are roughly flat across the forecast window. Consider transporting to a different mandi for a better rate.'}
            {recommendation === 'HOLD' &&
              'Prices are expected to rise. Holding stock for a few more days is likely profitable.'}
            {recommendation === 'SELL' &&
              'Prices are near peak. Selling now likely maximizes profit.'}
          </p>

          {/* Compact per-day list so the farmer can read the curve themselves. */}
          {forecast.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Day-by-day forecast (₹/qtl)
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {forecast.map((f) => {
                  const isPeak = f.day === bestDay;
                  return (
                    <li
                      key={f.day}
                      className={`flex items-center justify-between rounded px-2 py-1 ${
                        isPeak ? 'bg-krishi-50 font-semibold text-krishi-800' : 'text-gray-600'
                      }`}
                    >
                      <span>
                        {isPeak && '⭐ '}
                        Day {f.day} · {fmt(f.date)}
                      </span>
                      <span>
                        ₹{Math.round(f.price).toLocaleString()}
                        <span className="ml-2 text-[10px] text-gray-400">
                          {Math.round(f.confidence * 100)}%
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {prediction?.metrics?.train_rmse != null && (
            <div className="mt-4 space-y-1 text-xs text-gray-500">
              <p>• Model train RMSE: ₹{prediction.metrics.train_rmse}</p>
              <p>• MAPE: {prediction.metrics.train_mape_pct}%</p>
            </div>
          )}
        </div>
      </div>

      {factors.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-krishi-900">Price, arrival & weather factors</h2>
          <p className="text-xs text-gray-500">
            Recent mandi history and forecast-day weather inputs used by the model.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-krishi-100 bg-white shadow-soft">
            <table className="min-w-full divide-y divide-krishi-100 text-sm">
              <thead className="bg-krishi-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Arrivals</th>
                  <th className="px-3 py-2">Weather</th>
                  <th className="px-3 py-2">Temp</th>
                  <th className="px-3 py-2">Rain</th>
                  <th className="px-3 py-2">Humidity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-krishi-50">
                {factors.slice(-21).map((f, idx) => (
                  <tr key={`${f.kind}-${f.date}-${idx}`} className={f.kind === 'forecast' ? 'bg-amber-50/40' : ''}>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-700">{fmt(f.date)}</td>
                    <td className="px-3 py-2">
                      <span className={`badge ${f.kind === 'forecast' ? 'bg-amber-100 text-amber-700' : 'bg-krishi-100 text-krishi-700'}`}>
                        {f.kind}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                      {f.price != null ? `Rs ${Math.round(f.price).toLocaleString()}/qtl` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {f.arrivals != null ? `${Number(f.arrivals).toLocaleString()} MT` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 capitalize text-gray-700">
                      {f.weather_label || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {f.temp_avg_c != null ? `${Number(f.temp_avg_c).toFixed(1)} C` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {f.rainfall_mm != null ? `${Number(f.rainfall_mm).toFixed(1)} mm` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {f.humidity_pct != null ? `${Number(f.humidity_pct).toFixed(0)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
