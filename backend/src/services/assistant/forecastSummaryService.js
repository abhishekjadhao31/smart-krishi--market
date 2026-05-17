'use strict';

const axios = require('axios');
const env = require('../../config/env');

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function summarizeForecast(forecast = []) {
  if (!Array.isArray(forecast) || forecast.length === 0) {
    return {
      outlook: 'Stable',
      summary: 'No live forecast available yet.',
      trend: [],
      confidence: null,
      bestDay: null,
      bestPrice: null,
      bestGainPct: null,
    };
  }

  const first = forecast[0];
  const last = forecast[forecast.length - 1];
  const prices = forecast.map((item) => safeNumber(item.price)).filter((n) => n != null);
  const deltas = [];
  for (let index = 1; index < prices.length; index += 1) {
    const prev = prices[index - 1];
    const cur = prices[index];
    if (prev) deltas.push((cur - prev) / prev);
  }
  const meanDelta = deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0;
  const outlook = meanDelta > 0.01 ? 'Rising' : meanDelta < -0.01 ? 'Falling' : 'Stable';
  const best = forecast.reduce((acc, item) => (acc == null || item.price > acc.price ? item : acc), null);
  const confidence = safeNumber(last.confidence ?? first.confidence ?? null);

  return {
    outlook,
    summary: outlook === 'Rising'
      ? 'Market momentum is improving over the next few days.'
      : outlook === 'Falling'
        ? 'Prices may soften over the forecast window.'
        : 'Prices look steady with limited short-term movement.',
    trend: forecast.map((item) => ({
      day: item.day,
      date: item.date,
      price: safeNumber(item.price),
      confidence: safeNumber(item.confidence),
      lower: safeNumber(item.lowerPrice ?? item.lower_price),
      upper: safeNumber(item.upperPrice ?? item.upper_price),
    })),
    confidence,
    bestDay: best?.day ?? null,
    bestPrice: safeNumber(best?.price),
    bestGainPct: null,
  };
}

async function fetchForecastSummary(context = {}) {
  const url = `${env.ML_SERVICE_URL.replace(/\/$/, '')}/predict`;
  const payload = {
    cropName: context.cropName,
    district: context.district || undefined,
    market: context.market || undefined,
    horizonDays: context.horizonDays || 5,
  };

  const { data } = await axios.post(url, payload, { timeout: 15000 });
  const prediction = data?.data || data;
  const summary = summarizeForecast(prediction?.forecast || []);
  const currentPrice = safeNumber(prediction?.currentPrice);
  const bestPrice = safeNumber(prediction?.bestPrice ?? summary.bestPrice);
  const bestGainPct = safeNumber(prediction?.bestGainPct);

  return {
    currentPrice,
    predictedPrice: safeNumber(prediction?.predictedPrice),
    confidence: safeNumber(prediction?.confidence),
    method: prediction?.method || 'xgboost',
    horizonDays: prediction?.horizonDays || payload.horizonDays,
    trend: summary.trend,
    outlook: prediction?.outlook || summary.outlook,
    marketSummary: summary.summary,
    bestDay: prediction?.bestDay ?? summary.bestDay,
    bestDate: prediction?.bestDate ?? null,
    bestPrice,
    bestGainPct,
    raw: prediction,
  };
}

module.exports = {
  fetchForecastSummary,
  summarizeForecast,
};