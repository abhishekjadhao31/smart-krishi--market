'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const db = require('../config/db');
const MatchingEngine = require('../services/matchingEngine');
const { createBuyerRequestSchema } = require('../validators/buyerRequestValidator');

/**
 * POST /api/buyer-requests
 * Creates a buyer request and triggers matching orchestration
 */
exports.createBuyerRequest = asyncHandler(async (req, res) => {
  // Validate input
  const parseResult = createBuyerRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new ApiError(400, 'Validation failed', parseResult.error.errors);
  }

  const payload = parseResult.data;

  // Insert buyer request
  const insertSql = `INSERT INTO buyer_requests (buyer_id, crop_name, quantity_needed, max_price, delivery_date, urgency, created_at, updated_at)
                     VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *`;
  const values = [payload.buyerId, payload.cropName, payload.quantityNeeded, payload.maxPrice, payload.deliveryDate, payload.urgency || 'medium'];
  const { rows } = await db.query(insertSql, values);
  const buyerRequest = rows[0];

  // Fetch candidate listings for this crop
  const listingsSql = `SELECT c.*, u.state AS farmer_state, u.district AS farmer_district, u.name as farmer_name
                       FROM crops c
                       JOIN users u ON u.id = c.farmer_id
                       WHERE LOWER(c.crop_name) = LOWER($1)
                       AND c.status = 'available'`;
  const listingsRes = await db.query(listingsSql, [payload.cropName]);
  const listings = listingsRes.rows.map((r) => ({
    id: r.id,
    farmerId: r.farmer_id,
    cropName: r.crop_name,
    quantityKg: parseFloat(r.quantity_kg),
    pricePerKg: r.price_per_kg ? parseFloat(r.price_per_kg) : null,
    latitude: r.latitude,
    longitude: r.longitude,
    harvestDate: r.harvest_date,
    farmerName: r.farmer_name,
  }));

  // Enrich buyerRequest with coordinates if provided
  buyerRequest.buyerLat = payload.buyerLat || null;
  buyerRequest.buyerLon = payload.buyerLon || null;

  // Score listings
  const scored = await MatchingEngine.scoreAllListings(buyerRequest, listings, { minScore: 30, maxResults: 20 });

  // Persist top matches into matches table
  const insertMatchSql = `INSERT INTO matches (listing_id, buyer_request_id, farmer_id, crop_match_score, distance_score, price_score, quantity_score, urgency_score, total_score, distance_km, match_reason, status, created_at, updated_at)
                          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',NOW(),NOW()) RETURNING *`;

  for (const m of scored) {
    const distanceKm = parseFloat(m.distance || 0);
    const matchValues = [m.listing.id, buyerRequest.id, m.listing.farmerId, m.crop, m.distance, m.price, m.quantity, m.urgency, m.totalScore, distanceKm, m.reason];
    await db.query(insertMatchSql, matchValues);
  }

  // Log the matching decision
  const logSql = `INSERT INTO matching_logs (buyer_request_id, listing_id, algorithm, scores, decision_reason, created_at) VALUES ($1,$2,$3,$4,$5,NOW())`;
  for (const m of scored) {
    await db.query(logSql, [buyerRequest.id, m.listing.id, 'rule_based_weighted', JSON.stringify({
      crop: m.crop,
      distance: m.distance,
      price: m.price,
      quantity: m.quantity,
      urgency: m.urgency,
      total: m.totalScore,
    }), m.reason]);
  }

  res.status(201).json({ buyerRequest, matchesInserted: scored.length });
});

/**
 * GET /api/buyer-requests
 * List buyer requests (paginated)
 */
exports.listBuyerRequests = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = parseInt(req.query.offset, 10) || 0;

  const sql = `SELECT br.*, u.name as buyer_name FROM buyer_requests br JOIN users u ON u.id = br.buyer_id ORDER BY br.created_at DESC LIMIT $1 OFFSET $2`;
  const { rows } = await db.query(sql, [limit, offset]);
  res.json({ data: rows });
});

/**
 * GET /api/matches/:buyerId
 * Get matches for buyer (paginated)
 */
exports.getMatchesForBuyer = asyncHandler(async (req, res) => {
  const buyerId = parseInt(req.params.buyerId, 10);
  if (Number.isNaN(buyerId)) throw new ApiError(400, 'Invalid buyerId');

  const sql = `SELECT m.*, c.crop_name, c.quantity_kg, c.price_per_kg, u.name AS farmer_name FROM matches m JOIN buyer_requests br ON br.id = m.buyer_request_id JOIN crops c ON c.id = m.listing_id JOIN users u ON u.id = m.farmer_id WHERE br.buyer_id = $1 ORDER BY m.total_score DESC LIMIT 100`;
  const { rows } = await db.query(sql, [buyerId]);
  res.json({ data: rows });
});
