'use strict';

function hasDevanagari(text = '') {
  return /[\u0900-\u097F]/.test(text);
}

function detectLanguage(text = '', preferred = '') {
  const value = String(text || '').trim();
  const hint = String(preferred || '').toLowerCase();

  if (hasDevanagari(value)) {
    if (/(\bका\b|\bकी\b|\bके\b|\bहै\b|\bहोगा\b|\bक्या\b|\bबिकेगा\b|\bबेचना\b)/.test(value)) return 'hi-IN';
    if (/(\bचा\b|\bची\b|\bचे\b|\bआहे\b|\bहोईल\b|\bकधी\b|\bविकावा\b)/.test(value)) return 'mr-IN';
    return 'hi-IN';
  }

  if (hint.includes('mr')) return 'mr-IN';
  if (hint.includes('hi') || hint.includes('en-in') || hint.includes('en')) return 'en-IN';
  if (/[a-z]/i.test(value)) {
    if (/(kya|kab|bech|yaar|kaam|bhav|daam|sahi|sasta|mehnga)/i.test(value)) return 'hi-IN';
    if (/(kadhi|kasa|bhav|dar|vikava|vichar|changla|nahi)/i.test(value)) return 'mr-IN';
    return 'en-IN';
  }

  return 'en-IN';
}

function buildSystemPrompt(language, context = {}) {
  const languageName = language === 'hi-IN' ? 'Hindi' : language === 'mr-IN' ? 'Marathi' : 'English';
  return [
    'You are Smart Krishi Market Voice Assistant.',
    'You are a farmer-friendly mandi advisor, negotiation helper, and buyer-farmer communication assistant.',
    `Reply in ${languageName}. Keep the tone supportive, simple, practical, and trustworthy.`,
    'Do not use technical jargon. Do not mention being an AI model. Avoid fake certainty.',
    'Use the provided market, forecast, weather, arrivals, logistics, and negotiation context.',
    'If the user mixes Hindi and English, respond in the same mixed style.',
    'Keep the answer concise but useful, with a clear recommendation and one counter-offer or next step when relevant.',
    context.cropName ? `Crop: ${context.cropName}` : '',
    context.district ? `District: ${context.district}` : '',
    context.market ? `Mandi: ${context.market}` : '',
  ].filter(Boolean).join('\n');
}

function buildUserPrompt(payload = {}) {
  const sections = [
    `User message: ${payload.message || payload.query || ''}`,
    payload.currentPrice != null ? `Current mandi price: ${payload.currentPrice}` : '',
    payload.predictedPrice != null ? `Forecast price: ${payload.predictedPrice}` : '',
    payload.outlook ? `Outlook: ${payload.outlook}` : '',
    payload.recommendation ? `Recommendation: ${payload.recommendation}` : '',
    payload.offerAnalysis ? `Offer analysis: ${JSON.stringify(payload.offerAnalysis)}` : '',
    payload.marketInsight ? `Market insight: ${JSON.stringify(payload.marketInsight)}` : '',
    payload.forecastSummary ? `Forecast summary: ${JSON.stringify(payload.forecastSummary)}` : '',
    payload.logisticsCost != null ? `Logistics cost impact: ${payload.logisticsCost}` : '',
    payload.quantityKg != null ? `Quantity: ${payload.quantityKg} kg` : '',
    'Return a JSON object with keys: language, assistantText, voiceText, headline, quickReplies, negotiationTip, nextAction.',
    'The assistantText should be suitable for chat, and voiceText should be short and easy to speak aloud.',
  ].filter(Boolean);

  return sections.join('\n');
}

module.exports = {
  detectLanguage,
  buildSystemPrompt,
  buildUserPrompt,
};