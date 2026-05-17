'use strict';

function buildRecommendation({ intent, forecastSummary, marketInsight, offerAnalysis, context = {} }) {
  const currentPrice = marketInsight?.latest?.modalPrice ?? forecastSummary?.currentPrice ?? null;
  const forecastPrice = forecastSummary?.predictedPrice ?? forecastSummary?.bestPrice ?? null;
  const outlook = forecastSummary?.outlook || 'Stable';
  const buyerOffer = offerAnalysis?.offer ?? context.buyerOffer ?? null;

  let recommendation = 'Stable market';
  let rationale = 'Market signals are mixed; keep negotiating with a clear target price.';

  if (intent === 'sell_advice' || intent === 'hold_vs_sell') {
    if (outlook === 'Rising' && forecastSummary?.bestGainPct != null && forecastSummary.bestGainPct >= 2) {
      recommendation = 'Wait';
      rationale = 'Forecast and trend suggest a small upside over the next few days.';
    } else if (outlook === 'Falling') {
      recommendation = 'Sell now';
      rationale = 'Arrivals or trend pressure may soften prices soon.';
    } else {
      recommendation = 'Stable market';
      rationale = 'Expected movement is limited, so a quick sale is reasonable if you need cash flow.';
    }
  }

  if (intent === 'offer_analysis' && buyerOffer != null && offerAnalysis?.fairPrice != null) {
    if (buyerOffer >= offerAnalysis.fairPrice) {
      recommendation = 'Accept or negotiate lightly';
      rationale = 'The buyer offer is close to the fair range.';
    } else if (buyerOffer >= offerAnalysis.counterOffer * 0.95) {
      recommendation = 'Negotiate a little higher';
      rationale = 'You can likely improve the offer without losing the buyer.';
    } else {
      recommendation = 'Counter offer';
      rationale = 'The current offer is below the expected fair price.';
    }
  }

  if (intent === 'mandi_comparison' && marketInsight?.priceDirection) {
    recommendation = marketInsight.priceDirection === 'Rising' ? 'Use the stronger mandi' : 'Consider the lower-cost mandi';
    rationale = marketInsight.priceDirection === 'Rising'
      ? 'This mandi is showing better momentum compared with recent history.'
      : 'Transport-adjusted value matters more than chasing a slightly higher nominal price.';
  }

  return {
    recommendation,
    rationale,
    outlook,
    confidence: forecastSummary?.confidence ?? offerAnalysis?.negotiationConfidence ?? 0.5,
    currentPrice,
    forecastPrice,
    buyerOffer,
  };
}

module.exports = {
  buildRecommendation,
};