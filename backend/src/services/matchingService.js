'use strict';

/**
 * MatchingService
 * Orchestrates matching flow: given a buyer request, fetch candidate listings,
 * score them using MatchingEngine, persist top matches and audit logs.
 */

const db = require('../config/db');
const MatchingEngine = require('./matchingEngine');

class MatchingService {
  /**
   * Find candidate listings for a crop (exact match by lowercased crop_name)
   */
  static async fetchCandidateListings(cropName) {
    const sql = `SELECT c.*, u.state AS farmer_state, u.district AS farmer_district, u.name as farmer_name
                 FROM crops c
                 JOIN users u ON u.id = c.farmer_id
                 WHERE LOWER(c.crop_name) = LOWER($1)
                 AND c.status = 'available'`;
    const { rows } = await db.query(sql, [cropName]);
    return rows.map((r) => ({
      id: r.id,
      farmerId: r.farmer_id,
      cropName: r.crop_name,
      quantityKg: r.quantity_kg ? parseFloat(r.quantity_kg) : null,
      pricePerKg: r.price_per_kg ? parseFloat(r.price_per_kg) : null,
      latitude: r.latitude,
      longitude: r.longitude,
      harvestDate: r.harvest_date,
      farmerName: r.farmer_name,
    }));
  }

  /**
   * Persist matches (array from MatchingEngine.scoreAllListings)
   */
  static async persistMatches(buyerRequestId, scoredListings) {
    if (!scoredListings || scoredListings.length === 0) return 0;

    const insertMatchSql = `INSERT INTO matches (listing_id, buyer_request_id, farmer_id, crop_match_score, distance_score, price_score, quantity_score, urgency_score, total_score, distance_km, match_reason, status, created_at, updated_at)
                            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',NOW(),NOW()) RETURNING *`;

    let count = 0;
    for (const m of scoredListings) {
      const distanceKm = typeof m.distance === 'number' ? m.distance : 0;
      const values = [m.listing.id, buyerRequestId, m.listing.farmerId, m.crop, m.distance, m.price, m.quantity, m.urgency, m.totalScore, distanceKm, m.reason];
      await db.query(insertMatchSql, values);
      count += 1;
    }

    return count;
  }

  /**
   * Orchestrate end-to-end matching for a buyerRequest object
   * buyerRequest: { id, cropName, quantityNeeded, maxPrice, deliveryDate, buyerLat, buyerLon }
   */
  static async runMatchingForRequest(buyerRequest, options = {}) {
    const candidates = await this.fetchCandidateListings(buyerRequest.crop_name || buyerRequest.cropName);

    // attach buyer coords
    const br = {
      id: buyerRequest.id,
      cropName: buyerRequest.crop_name || buyerRequest.cropName,
      quantityNeeded: parseFloat(buyerRequest.quantity_needed || buyerRequest.quantityNeeded || 0),
      maxPrice: parseFloat(buyerRequest.max_price || buyerRequest.maxPrice || 0),
      deliveryDate: buyerRequest.delivery_date || buyerRequest.deliveryDate,
      buyerLat: buyerRequest.buyerLat || buyerRequest.buyer_lat,
      buyerLon: buyerRequest.buyerLon || buyerRequest.buyer_lon,
    };

    const scored = await MatchingEngine.scoreAllListings(br, candidates, { minScore: options.minScore || 30, maxResults: options.maxResults || 20 });

    const inserted = await this.persistMatches(br.id, scored);

    // write audit logs
    const logSql = `INSERT INTO matching_logs (buyer_request_id, listing_id, algorithm, scores, decision_reason, created_at) VALUES ($1,$2,$3,$4,$5,NOW())`;
    for (const m of scored) {
      await db.query(logSql, [br.id, m.listing.id, 'rule_based_weighted', JSON.stringify({ crop: m.crop, distance: m.distance, price: m.price, quantity: m.quantity, urgency: m.urgency, total: m.totalScore }), m.reason]);
    }

    return { scored, inserted };
  }
}

module.exports = MatchingService;
