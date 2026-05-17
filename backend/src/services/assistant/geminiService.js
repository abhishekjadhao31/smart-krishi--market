'use strict';

const axios = require('axios');
const env = require('../../config/env');
const { buildSystemPrompt, buildUserPrompt, detectLanguage } = require('./multilingualPromptEngine');

function stripCodeFences(text) {
  return String(text || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function extractTextFromGeminiResponse(payload) {
  const candidates = payload?.candidates || [];
  const parts = candidates[0]?.content?.parts || [];
  return parts.map((part) => part.text || '').join('').trim();
}

function safeJsonParse(text) {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (_err) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch (_err2) {
        return null;
      }
    }
    return null;
  }
}

async function generateVoiceAssistantReply(baseResponse = {}, payload = {}, user = null) {
  if (!env.GEMINI_API_KEY) {
    return null;
  }

  const detectedLanguage = detectLanguage(payload.message || payload.query || '', payload.language || user?.language || user?.preferredLanguage || '');
  const model = env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const requestBody = {
    systemInstruction: {
      parts: [
        {
          text: buildSystemPrompt(detectedLanguage, {
            cropName: payload.cropName || payload.crop || payload.commodity || '',
            district: payload.district || '',
            market: payload.market || payload.mandi || '',
          }),
        },
      ],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: buildUserPrompt({
              ...payload,
              ...baseResponse,
              language: detectedLanguage,
            }),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 500,
      responseMimeType: 'application/json',
    },
  };

  const { data } = await axios.post(url, requestBody, { timeout: 15000 });
  const text = extractTextFromGeminiResponse(data);
  const parsed = safeJsonParse(text);
  if (!parsed) {
    return null;
  }

  return {
    language: parsed.language || detectedLanguage,
    assistantText: parsed.assistantText || parsed.answer || baseResponse.answer,
    voiceText: parsed.voiceText || parsed.assistantText || baseResponse.answer,
    headline: parsed.headline || baseResponse.headline,
    quickReplies: Array.isArray(parsed.quickReplies) && parsed.quickReplies.length ? parsed.quickReplies : baseResponse.suggestedReplies || [],
    negotiationTip: parsed.negotiationTip || baseResponse.rationale || '',
    nextAction: parsed.nextAction || baseResponse.recommendation || '',
  };
}

module.exports = {
  generateVoiceAssistantReply,
};