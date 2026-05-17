'use strict';

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function analyzeBuyerOffer({
  currentPrice,
  predictedPrice,
  buyerOffer,
  logisticsCost = 0,
  confidence = 0.5,
  quantityKg = null,
}) {
  const current = safeNumber(currentPrice);
  const predicted = safeNumber(predictedPrice);
  const offer = safeNumber(buyerOffer);
  const transport = Math.max(0, safeNumber(logisticsCost) || 0);

  if (offer == null && current == null && predicted == null) {
    return {
      fairPrice: null,
      counterOffer: null,
      offerScore: null,
      status: 'insufficient_data',
      notes: ['Add a buyer offer or market context to analyze fairness.'],
      negotiationConfidence: clamp(confidence, 0.2, 0.95),
    };
  }

  const marketAnchor = predicted ?? current ?? offer;
  const fairPrice = Math.round((marketAnchor - Math.min(transport * 0.15, marketAnchor * 0.08)) * 100) / 100;
  const targetMargin = marketAnchor * 0.03;
  const counterOffer = Math.round((fairPrice + targetMargin) * 100) / 100;

  const gapPct = offer != null && marketAnchor > 0 ? ((offer - marketAnchor) / marketAnchor) * 100 : 0;
  const buyerShare = offer != null && current > 0 ? ((offer - current) / current) * 100 : 0;

  let status = 'fair';
  if (offer == null) {
    status = 'market_reference_only';
  } else if (gapPct >= 3) {
    status = 'strong';
  } else if (gapPct >= -2) {
    status = 'fair';
  } else {
    status = 'weak';
  }

  const offerScore = clamp(Math.round(65 + gapPct * 2 - transport / 1000), 0, 100);
  const notes = [];
  if (offer != null && current != null) {
    notes.push(`Buyer offer is ${buyerShare >= 0 ? 'above' : 'below'} the current mandi reference by ${Math.abs(Math.round(buyerShare))}%`);
  }
  if (transport > 0) {
    notes.push(`Estimated logistics cost of ₹${Math.round(transport).toLocaleString()} should be covered before accepting.`);
  }
  if (confidence < 0.55) {
    notes.push('Forecast confidence is moderate, so keep a small negotiation buffer.');
  }

  return {
    fairPrice,
    counterOffer,
    offerScore,
    status,
    notes,
    negotiationConfidence: clamp(0.45 + confidence * 0.45, 0.2, 0.95),
    quantityKg,
  };
}

module.exports = {
  analyzeBuyerOffer,
};