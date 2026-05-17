'use strict';

const { buildAssistantResponse } = require('./negotiationService');
const { generateVoiceAssistantReply } = require('./geminiService');
const { detectLanguage } = require('./multilingualPromptEngine');

function buildVoicePayload(baseResponse, geminiResponse, payload, user) {
  const detectedLanguage = geminiResponse?.language || detectLanguage(payload.message || payload.query || '', payload.language || user?.language || '');
  const assistantText = geminiResponse?.assistantText || baseResponse.answer;
  const voiceText = geminiResponse?.voiceText || assistantText;

  return {
    ...baseResponse,
    detectedLanguage,
    language: detectedLanguage,
    assistantText,
    voiceText,
    headline: geminiResponse?.headline || baseResponse.headline,
    suggestedReplies: geminiResponse?.quickReplies?.length ? geminiResponse.quickReplies : baseResponse.suggestedReplies,
    quickReplies: geminiResponse?.quickReplies?.length ? geminiResponse.quickReplies : baseResponse.quickReplies,
    voiceSupported: true,
    multilingualSupported: true,
    speechReady: true,
    responseTone: baseResponse.tone,
    voiceHint: 'Tap the mic, speak naturally, and hear a short spoken reply.',
    conversationMemory: {
      cropName: payload.cropName || payload.crop || payload.commodity || '',
      district: payload.district || '',
      market: payload.market || '',
      buyerOffer: payload.buyerOffer ?? payload.offer ?? null,
    },
  };
}

async function buildVoiceAssistantResponse(payload = {}, user = null) {
  const baseResponse = await buildAssistantResponse(payload, user);
  const geminiResponse = await generateVoiceAssistantReply(baseResponse, payload, user).catch(() => null);
  return buildVoicePayload(baseResponse, geminiResponse, payload, user);
}

module.exports = {
  buildVoiceAssistantResponse,
};