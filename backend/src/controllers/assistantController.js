'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { buildVoiceAssistantResponse } = require('../services/assistant/voiceAssistantService');

const chat = asyncHandler(async (req, res) => {
  const message = String(req.body.message || req.body.query || '').trim();
  const cropName = String(req.body.cropName || req.body.crop || req.body.commodity || '').trim();
  const district = String(req.body.district || '').trim();
  const market = String(req.body.market || '').trim();

  if (!message && !cropName && !district && !market) {
    throw new ApiError(400, 'Please ask a market question or provide crop context');
  }

  const data = await buildVoiceAssistantResponse(req.body, req.user || null);
  res.json({ data });
});

module.exports = { chat };