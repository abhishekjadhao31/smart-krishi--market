'use strict';

const marketPriceModel = require('../models/marketPriceModel');
const asyncHandler = require('../utils/asyncHandler');

const listPrices = asyncHandler(async (req, res) => {
  const { crop, state, market, limit } = req.query;
  const rows = await marketPriceModel.list({
    crop,
    state,
    market,
    limit: Math.min(parseInt(limit, 10) || 50, 200),
  });
  res.json({ data: rows, count: rows.length });
});

module.exports = { listPrices };
