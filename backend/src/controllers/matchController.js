'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const db = require('../config/db');
const MatchingEngine = require('../services/matchingEngine');
const LogisticsCostEngine = require('../services/logisticsCostEngine');

/**
 * POST /api/match/search
 * Body: { cropName, maxPrice, quantityNeeded, buyerLat, buyerLon, preferredDistrict }
 */
exports.searchMatches = asyncHandler(async (req, res) => {
  const { cropName, maxPrice, quantityNeeded, buyerLat, buyerLon, preferredDistrict } = req.body;
  if (!cropName || !maxPrice || !quantityNeeded) throw new ApiError(400, 'Missing required fields');

  // Fetch candidate listings
  const sql = `SELECT c.*, u.state AS farmer_state, u.district AS farmer_district, u.name as farmer_name
               FROM crops c JOIN users u ON u.id = c.farmer_id
               WHERE LOWER(c.crop_name) = LOWER($1) AND c.status = 'available'`;
  const { rows } = await db.query(sql, [cropName]);

  const listings = rows.map((r) => ({
    id: r.id,
    farmerId: r.farmer_id,
    farmerName: r.farmer_name,
    cropName: r.crop_name,
    quantityKg: parseFloat(r.quantity_kg),
    pricePerKg: r.price_per_kg ? parseFloat(r.price_per_kg) : null,
    latitude: r.latitude,
    longitude: r.longitude,
    harvestDate: r.harvest_date,
    district: r.district,
    market: r.market,
  }));

  const buyerRequest = {
    cropName,
    maxPrice: parseFloat(maxPrice),
    quantityNeeded: parseFloat(quantityNeeded),
    buyerLat: buyerLat || null,
    buyerLon: buyerLon || null,
    preferredDistrict: preferredDistrict || null,
    deliveryDate: req.body.deliveryDate || null,
  };

  // Score listings
  const scored = await MatchingEngine.scoreAllListings(buyerRequest, listings, { minScore: 10, maxResults: 50 });

  // For each scored listing, compute transport estimate and badges
  const logisticsRes = [];
  for (const s of scored) {
    // find logistics partners nearby (simple query)
    const partnersSql = 'SELECT * FROM logistics_partners WHERE available = TRUE LIMIT 50';
    const { rows: partners } = await db.query(partnersSql);

    const rankedPartners = LogisticsCostEngine.rankLogisticsPartners(partners, s.listing.quantityKg, s.listing.latitude || 0, s.listing.longitude || 0, buyerRequest.buyerLat || 0, buyerRequest.buyerLon || 0, { minScore: 30, maxResults: 5 });

    const bestPartner = LogisticsCostEngine.findOptimalPartner(rankedPartners || [], { balanceScoreCost: 0.65 });

    // badges logic
    const badges = [];
    if (s.price <= buyerRequest.maxPrice && s.price <= Math.min(...scored.map((x) => x.price))) badges.push('Best Price');
    if (bestPartner && bestPartner.estimatedCost <= Math.min(...(rankedPartners.map((p) => p.estimatedCost) || [Infinity]))) badges.push('Lowest Logistics Cost');
    if (s.totalScore >= 85) badges.push('Best Match');

    // estimate profit per kg (simple)
    const estimatedProfit = buyerRequest.maxPrice - (s.price || buyerRequest.maxPrice);
    if (estimatedProfit >= 2) badges.push('Best Profit');

    logisticsRes.push({
      listing: s.listing,
      scores: {
        crop: s.crop,
        distance: s.distance,
        price: s.price,
        quantity: s.quantity,
        urgency: s.urgency,
        totalScore: s.totalScore,
      },
      badges,
      transport: bestPartner ? {
        partner: bestPartner.partnerName,
        vehicleType: bestPartner.vehicleType,
        estimatedCost: bestPartner.estimatedCost,
        estimatedDeliveryDays: bestPartner.estimatedDeliveryDays || Math.max(1, Math.ceil((bestPartner.routeDistanceKm || 100) / 300)),
      } : null,
    });
  }

  // Sort by totalScore desc then by transport cost
  logisticsRes.sort((a, b) => {
    if (b.scores.totalScore !== a.scores.totalScore) return b.scores.totalScore - a.scores.totalScore;
    const aCost = a.transport ? a.transport.estimatedCost : Infinity;
    const bCost = b.transport ? b.transport.estimatedCost : Infinity;
    return aCost - bCost;
  });

  res.json({ data: logisticsRes });
});
