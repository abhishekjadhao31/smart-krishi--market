'use strict';

const axios = require('axios');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Thin proxy to the FastAPI ML service. Backend stays the only entrypoint for the frontend.
const predict = asyncHandler(async (req, res) => {
  const url = `${env.ML_SERVICE_URL.replace(/\/$/, '')}/predict`;
  try {
    const { data } = await axios.post(url, req.body, { timeout: 15000 });
    res.json({ data });
  } catch (err) {
    if (err.response) {
      throw new ApiError(
        err.response.status || 502,
        `ML service error: ${err.response.statusText || 'failed'}`,
        err.response.data
      );
    }
    throw new ApiError(503, `ML service unreachable at ${url}`);
  }
});

module.exports = { predict };
