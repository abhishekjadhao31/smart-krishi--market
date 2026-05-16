'use strict';

const buyerModel = require('../models/buyerModel');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/buyers
 * Public directory of registered buyers. Returns `{ buyers: [...] }`
 * to match the shape the frontend expects.
 */
const listBuyers = asyncHandler(async (req, res) => {
  const { state, district, limit, offset } = req.query;
  const buyers = await buyerModel.listBuyers({
    state,
    district,
    limit: Math.min(parseInt(limit, 10) || 50, 100),
    offset: parseInt(offset, 10) || 0,
  });
  res.json({ buyers, count: buyers.length });
});

/**
 * POST /api/buyer/search
 * Body: { crop?, location?, maxPrice? }
 * Returns matching crop listings as `{ crops: [...] }` — the BuyerDashboard
 * reads `data.crops`, so the key name matters.
 */
const searchListings = asyncHandler(async (req, res) => {
  const { crop, location, maxPrice } = req.body || {};
  const crops = await buyerModel.searchListings({ crop, location, maxPrice });
  res.json({ crops, count: crops.length });
});

module.exports = { listBuyers, searchListings };
