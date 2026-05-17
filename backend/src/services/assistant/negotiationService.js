'use strict';

const LogisticsCostEngine = require('../logisticsCostEngine');
const { getMarketInsight } = require('./marketInsightService');
const { fetchForecastSummary } = require('./forecastSummaryService');
const { analyzeBuyerOffer } = require('./buyerOfferAnalyzer');
const { buildRecommendation } = require('./recommendationEngine');

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function classifyIntent(message = '') {
  const text = String(message).toLowerCase();
  if (/(counter offer|negotiat|fair|offer|price reasonable|buyer offered)/.test(text)) return 'offer_analysis';
  if (/(sell now|sell today|wait|hold|store|when should i sell|should i sell)/.test(text)) return 'hold_vs_sell';
  if (/(mandi|market|district|where should i sell|which mandi|compare)/.test(text)) return 'mandi_comparison';
  if (/(profit|earn|margin|how much profit)/.test(text)) return 'profit_estimate';
  if (/(weather|rain|rainfall|temperature)/.test(text)) return 'weather_impact';
  if (/(demand|arrivals|supply|trend)/.test(text)) return 'demand_trend';
  if (/(buyer|who is best buyer|best deal|transport)/.test(text)) return 'buyer_comparison';
  return 'general_advice';
}

function buildQuickReplies({ intent, cropName, district }) {
  const marketHint = cropName ? `Analyze ${cropName}${district ? ` in ${district}` : ''}` : 'Analyze current market';
  const base = [
    'Should I sell now?',
    'Is buyer offer fair?',
    'What counter offer should I send?',
    'Which mandi is best today?',
  ];
  if (intent === 'offer_analysis') {
    base.unshift('Compare buyer offer with mandi price');
  }
  if (cropName) {
    base.unshift(marketHint);
  }
  return Array.from(new Set(base)).slice(0, 5);
}

function buildFarmerFriendlySummary({ cropName, district, marketInsight, forecastSummary, offerAnalysis, recommendation }) {
  const locationText = [district, marketInsight?.latest?.market].filter(Boolean).join(' / ');
  const currentPrice = marketInsight?.latest?.modalPrice ?? forecastSummary?.currentPrice;
  const forecastPrice = forecastSummary?.predictedPrice ?? forecastSummary?.bestPrice;
  const parts = [];

  if (cropName && currentPrice != null) {
    parts.push(`Current ${cropName.toLowerCase()} prices in ${locationText || 'the selected mandi'} are around ₹${Math.round(currentPrice).toLocaleString()}/qtl.`);
  }
  if (forecastSummary?.outlook) {
    parts.push(`The short-term outlook is ${forecastSummary.outlook.toLowerCase()} with ${forecastSummary.marketSummary.toLowerCase()}`);
  }
  if (marketInsight?.arrivalDirection) {
    parts.push(`Arrivals are ${marketInsight.arrivalDirection.toLowerCase()}, which can affect near-term pricing.`);
  }
  if (offerAnalysis?.buyerOffer != null && offerAnalysis?.fairPrice != null) {
    parts.push(`Buyer offer of ₹${Math.round(offerAnalysis.buyerOffer).toLocaleString()}/qtl compares against a fair range near ₹${Math.round(offerAnalysis.fairPrice).toLocaleString()}/qtl.`);
  }
  if (forecastPrice != null && recommendation) {
    parts.push(`Recommendation: ${recommendation.recommendation.toLowerCase()} (${recommendation.rationale}).`);
  }

  return parts.join(' ');
}

async function buildAssistantResponse(payload = {}, user = null) {
  const query = payload.message || payload.query || '';
  const cropName = payload.cropName || payload.crop || payload.commodity || '';
  const district = payload.district || payload.locationDistrict || '';
  const market = payload.market || payload.mandi || '';
  const buyerOffer = safeNumber(payload.buyerOffer ?? payload.offer ?? payload.offerPrice);
  const quantityKg = safeNumber(payload.quantityKg ?? payload.quantity);
  const pickupDistrict = payload.pickupDistrict || district;
  const dropDistrict = payload.dropDistrict || payload.buyerDistrict || null;
  const pickupLat = safeNumber(payload.pickupLat);
  const pickupLon = safeNumber(payload.pickupLon);
  const dropLat = safeNumber(payload.dropLat);
  const dropLon = safeNumber(payload.dropLon);
  const horizonDays = Math.min(Math.max(parseInt(payload.horizonDays, 10) || 5, 1), 5);
  const intent = classifyIntent(query);

  const marketInsight = cropName || district || market
    ? await getMarketInsight({ cropName, district, market, limit: 60 })
    : { latest: null, recent: [], avgPrice: null, avgArrivals: null, priceDirection: 'Stable', arrivalDirection: 'Stable', weather: [], dataPoints: 0 };

  const forecastSummary = cropName
    ? await fetchForecastSummary({ cropName, district, market, horizonDays })
    : { currentPrice: null, predictedPrice: null, confidence: null, outlook: 'Stable', marketSummary: 'No crop selected yet.', bestDay: null, bestPrice: null, bestGainPct: null, trend: [] };

  let logisticsCost = null;
  if ((pickupLat != null && pickupLon != null && dropLat != null && dropLon != null) || (pickupDistrict && dropDistrict)) {
    try {
      const distanceKm = pickupLat != null && pickupLon != null && dropLat != null && dropLon != null
        ? LogisticsCostEngine.calculateDistance(pickupLat, pickupLon, dropLat, dropLon)
        : null;
      logisticsCost = distanceKm != null ? Math.round((distanceKm * 18 + 500) * 100) / 100 : null;
    } catch (_err) {
      logisticsCost = null;
    }
  }

  const offerAnalysis = analyzeBuyerOffer({
    currentPrice: marketInsight.latest?.modalPrice ?? forecastSummary.currentPrice,
    predictedPrice: forecastSummary.predictedPrice ?? forecastSummary.bestPrice,
    buyerOffer,
    logisticsCost: logisticsCost ?? 0,
    confidence: forecastSummary.confidence ?? 0.5,
    quantityKg,
  });

  const recommendation = buildRecommendation({
    intent,
    forecastSummary,
    marketInsight,
    offerAnalysis: { ...offerAnalysis, offer: buyerOffer },
    context: payload,
  });

  const summary = buildFarmerFriendlySummary({
    cropName,
    district,
    marketInsight,
    forecastSummary,
    offerAnalysis: { ...offerAnalysis, buyerOffer },
    recommendation,
  });

  const confidence = Math.round((recommendation.confidence ?? forecastSummary.confidence ?? 0.5) * 100);
  const responseType = offerAnalysis.status === 'weak' ? 'counter_offer' : recommendation.recommendation === 'Sell now' ? 'sell_now' : recommendation.recommendation === 'Wait' ? 'wait' : 'stable';

  const insightCards = [
    {
      label: 'Current mandi price',
      value: forecastSummary.currentPrice != null || marketInsight.latest?.modalPrice != null
        ? `₹ ${Math.round(forecastSummary.currentPrice ?? marketInsight.latest.modalPrice).toLocaleString()} / qtl`
        : '—',
      hint: marketInsight.latest?.market || district || 'selected market',
    },
    {
      label: 'Forecast outlook',
      value: forecastSummary.outlook || 'Stable',
      hint: forecastSummary.marketSummary,
    },
    {
      label: 'Offer quality',
      value: offerAnalysis.offerScore != null ? `${offerAnalysis.offerScore}/100` : '—',
      hint: offerAnalysis.status,
    },
    {
      label: 'Negotiation confidence',
      value: `${confidence}%`,
      hint: recommendation.rationale,
    },
  ];

  const negotiationCards = [
    {
      label: 'Fair price range',
      value: offerAnalysis.fairPrice != null ? `₹ ${Math.round(offerAnalysis.fairPrice).toLocaleString()} / qtl` : '—',
      hint: buyerOffer != null ? `Buyer offer: ₹${Math.round(buyerOffer).toLocaleString()}/qtl` : 'Add buyer offer to compare',
    },
    {
      label: 'Suggested counter-offer',
      value: offerAnalysis.counterOffer != null ? `₹ ${Math.round(offerAnalysis.counterOffer).toLocaleString()} / qtl` : '—',
      hint: logisticsCost != null ? `Logistics impact ≈ ₹${Math.round(logisticsCost).toLocaleString()}` : 'Transport not included',
    },
    {
      label: 'Best action',
      value: recommendation.recommendation,
      hint: recommendation.rationale,
    },
  ];

  const suggestedReplies = buildQuickReplies({ intent, cropName, district });

  return {
    intent,
    responseType,
    answer: summary,
    headline: recommendation.recommendation,
    tone: recommendation.recommendation === 'Sell now' ? 'urgent' : recommendation.recommendation === 'Wait' ? 'cautious' : 'steady',
    currentPrice: forecastSummary.currentPrice ?? marketInsight.latest?.modalPrice ?? null,
    predictedPrice: forecastSummary.predictedPrice ?? forecastSummary.bestPrice ?? null,
    confidence: recommendation.confidence ?? forecastSummary.confidence ?? 0.5,
    outlook: forecastSummary.outlook,
    recommendation: recommendation.recommendation,
    rationale: recommendation.rationale,
    offerAnalysis,
    marketInsight,
    forecastSummary,
    insightCards,
    negotiationCards,
    suggestedReplies,
    quickReplies: suggestedReplies,
    multilingualReady: true,
    voiceReady: true,
    buyerFriendlyNote: 'The assistant can also answer from the buyer side with market and transport context.',
    diagnostics: {
      userRole: user?.role || null,
      cropName,
      district,
      market,
      buyerOffer,
      quantityKg,
      logisticsCost,
      pickupDistrict,
      dropDistrict,
    },
  };
}

module.exports = {
  buildAssistantResponse,
  classifyIntent,
};