'use strict';

/**
 * Matching Engine Service
 * 
 * AI-powered farmer-buyer matching algorithm using weighted scoring.
 * 
 * Scoring weights:
 * - Crop match: 40% (exact name match or similarity)
 * - Distance: 25% (haversine distance, closer = better)
 * - Price compatibility: 20% (buyer budget vs farmer price)
 * - Quantity compatibility: 10% (buyer qty vs farmer available qty)
 * - Delivery urgency: 5% (match farmer's harvest timing with buyer's deadline)
 */

const { getDistance } = require('geolib');

class MatchingEngine {
  /**
   * Calculate similarity between two strings (0-100)
   * Uses simple substring matching + levenshtein-like distance
   */
  static calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // Exact match
    if (s1 === s2) return 100;
    
    // One contains the other
    if (s1.includes(s2) || s2.includes(s1)) return 80;
    
    // Levenshtein distance (simplified)
    const maxLen = Math.max(s1.length, s2.length);
    const differences = this.levenshteinDistance(s1, s2);
    const similarity = ((maxLen - differences) / maxLen) * 100;
    
    return Math.max(0, Math.min(100, similarity));
  }

  /**
   * Levenshtein distance calculation (edit distance)
   */
  static levenshteinDistance(s1, s2) {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let i = 0; i <= len2; i++) matrix[i][0] = i;

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        const cost = s1[j - 1] === s2[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i][j - 1] + 1,      // deletion
          matrix[i - 1][j] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[len2][len1];
  }

  /**
   * Calculate crop match score (0-100)
   * Compares listing crop name with requested crop
   */
  static scoreCropMatch(listingCropName, requestedCropName) {
    return this.calculateStringSimilarity(listingCropName, requestedCropName);
  }

  /**
   * Calculate distance score (0-100)
   * Closer = higher score, using haversine distance
   */
  static scoreDistance(farmerLat, farmerLon, buyerLat, buyerLon, maxDistanceKm = 500) {
    if (!farmerLat || !farmerLon || !buyerLat || !buyerLon) {
      return 50; // Default neutral score if coordinates missing
    }

    const distanceKm = getDistance(
      { latitude: farmerLat, longitude: farmerLon },
      { latitude: buyerLat, longitude: buyerLon }
    ) / 1000; // geolib returns meters

    if (distanceKm > maxDistanceKm) return 0;

    // Inverse score: closer = higher
    // At 0km = 100, at maxDistance = 0, linear interpolation
    const score = Math.max(0, 100 - (distanceKm / maxDistanceKm) * 100);
    return Math.min(100, score);
  }

  /**
   * Calculate price score (0-100)
   * Checks if farmer's price is within buyer's budget
   */
  static scorePrice(farmerPricePerUnit, buyerMaxPrice, tolerance = 0.1) {
    if (!farmerPricePerUnit || !buyerMaxPrice) {
      return 50; // Neutral if price info missing
    }

    // If farmer price equals buyer max price
    if (farmerPricePerUnit <= buyerMaxPrice) {
      // Give higher score if farmer price is lower
      const discountPct = ((buyerMaxPrice - farmerPricePerUnit) / buyerMaxPrice) * 100;
      return Math.min(100, 70 + discountPct); // 70-100 range if under budget
    }

    // If farmer price exceeds budget
    const exceedPct = ((farmerPricePerUnit - buyerMaxPrice) / buyerMaxPrice) * 100;
    
    // If within tolerance (e.g., 10%), still give decent score
    if (exceedPct <= tolerance * 100) {
      return Math.max(30, 70 - exceedPct);
    }

    // Beyond tolerance = low score
    return Math.max(0, 30 - (exceedPct * 0.5));
  }

  /**
   * Calculate quantity score (0-100)
   * Checks if farmer has enough quantity for buyer
   */
  static scoreQuantity(farmerQuantity, buyerQuantityNeeded, tolerance = 0.9) {
    if (!farmerQuantity || !buyerQuantityNeeded) {
      return 50; // Neutral if qty info missing
    }

    const ratio = farmerQuantity / buyerQuantityNeeded;

    // Perfect or excess quantity = 100
    if (ratio >= 1) {
      // Even better if farmer has excess
      return Math.min(100, 80 + (ratio - 1) * 10);
    }

    // If farmer has at least tolerance% (e.g., 90%) of needed
    if (ratio >= tolerance) {
      return 60 + (ratio - tolerance) * 400; // 60-100 scale
    }

    // Below tolerance = lower scores
    return ratio * 50; // 0-50 range
  }

  /**
   * Calculate urgency score (0-100)
   * Match farmer's harvest date with buyer's delivery deadline
   */
  static scoreUrgency(harvestDate, deliveryDate) {
    if (!harvestDate || !deliveryDate) {
      return 50; // Neutral
    }

    const harvest = new Date(harvestDate);
    const delivery = new Date(deliveryDate);
    const daysDifference = (delivery - harvest) / (1000 * 60 * 60 * 24);

    // Perfect: harvest just before delivery (5-10 days buffer)
    if (daysDifference >= 3 && daysDifference <= 14) {
      return 90 + Math.random() * 10; // 90-100
    }

    // Good: some buffer but not too much
    if (daysDifference >= 1 && daysDifference < 30) {
      return 60 + (Math.min(daysDifference, 20) / 20) * 30;
    }

    // Tight: harvest right before or after delivery
    if (daysDifference >= -3 && daysDifference < 3) {
      return 40 + daysDifference * 5;
    }

    // Too late or too early = low score
    if (daysDifference < -3 || daysDifference >= 60) {
      return Math.max(0, Math.min(40, 40 - Math.abs(daysDifference) * 0.5));
    }

    return 50;
  }

  /**
   * Calculate total match score with weighted average
   * 
   * Weights:
   * - Crop match: 40%
   * - Distance: 25%
   * - Price: 20%
   * - Quantity: 10%
   * - Urgency: 5%
   */
  static calculateTotalScore(scores) {
    const weights = {
      crop: 0.40,
      distance: 0.25,
      price: 0.20,
      quantity: 0.10,
      urgency: 0.05,
    };

    const totalScore =
      (scores.crop || 0) * weights.crop +
      (scores.distance || 0) * weights.distance +
      (scores.price || 0) * weights.price +
      (scores.quantity || 0) * weights.quantity +
      (scores.urgency || 0) * weights.urgency;

    return Math.round(totalScore * 100) / 100; // Round to 2 decimals
  }

  /**
   * Score a single listing against a buyer request
   * Returns detailed scoring breakdown
   */
  static scoreListing(listing, buyerRequest) {
    const scores = {
      crop: this.scoreCropMatch(listing.cropName, buyerRequest.cropName),
      distance: this.scoreDistance(
        listing.latitude,
        listing.longitude,
        buyerRequest.buyerLat,
        buyerRequest.buyerLon
      ),
      price: this.scorePrice(listing.pricePerKg, buyerRequest.maxPrice),
      quantity: this.scoreQuantity(listing.quantityKg, buyerRequest.quantityNeeded),
      urgency: this.scoreUrgency(listing.harvestDate, buyerRequest.deliveryDate),
    };

    const totalScore = this.calculateTotalScore(scores);

    return {
      ...scores,
      totalScore,
      reason: this.generateMatchReason(scores, listing, buyerRequest),
    };
  }

  /**
   * Generate human-readable match reason
   */
  static generateMatchReason(scores, listing, buyerRequest) {
    const reasons = [];

    if (scores.crop >= 80) reasons.push(`✓ Exact crop match (${Math.round(scores.crop)}%)`);
    else if (scores.crop >= 60) reasons.push(`◐ Similar crop (${Math.round(scores.crop)}%)`);

    if (scores.distance >= 80) reasons.push(`✓ Very close location (${Math.round(scores.distance)}%)`);
    else if (scores.distance >= 60) reasons.push(`◐ Reasonable distance (${Math.round(scores.distance)}%)`);

    if (scores.price >= 80) reasons.push(`✓ Good price match (${Math.round(scores.price)}%)`);
    else if (scores.price >= 60) reasons.push(`◐ Acceptable price (${Math.round(scores.price)}%)`);

    if (scores.quantity >= 80) reasons.push(`✓ Sufficient quantity (${Math.round(scores.quantity)}%)`);
    else if (scores.quantity >= 60) reasons.push(`◐ Partial quantity (${Math.round(scores.quantity)}%)`);

    return reasons.join(' | ');
  }

  /**
   * Find and score all matching listings for a buyer request
   */
  static async scoreAllListings(buyerRequest, listings, options = {}) {
    const {
      minScore = 30,  // Only return matches scoring 30+
      maxResults = 10, // Top 10 matches
    } = options;

    const scoredListings = listings
      .map((listing) => ({
        listing,
        ...this.scoreListing(listing, buyerRequest),
      }))
      .filter((match) => match.totalScore >= minScore)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, maxResults);

    return scoredListings;
  }
}

module.exports = MatchingEngine;
