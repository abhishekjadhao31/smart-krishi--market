'use strict';

/**
 * Logistics Cost Engine Service
 * 
 * Calculates transport costs and finds optimal logistics partners
 * based on distance, capacity, vehicle type, and special requirements.
 */

const { getDistance } = require('geolib');

class LogisticsCostEngine {
  /**
   * Calculate haversine distance between two coordinates in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      throw new Error('Invalid coordinates for distance calculation');
    }

    const distanceMeters = getDistance(
      { latitude: lat1, longitude: lon1 },
      { latitude: lat2, longitude: lon2 }
    );

    return distanceMeters / 1000; // Convert to km
  }

  /**
   * Calculate transport cost
   * Formula: (distance_km × rate_per_km) + loading_charges + special_charges
   */
  static calculateTransportCost(distanceKm, partner, options = {}) {
    const {
      coldStorageRequired = false,
      hasInsurance = false,
    } = options;

    const baseCost = distanceKm * partner.ratePerKm;
    const loadingCost = partner.loadingCharges || 500;

    // Cold storage premium: +15% of base cost
    const coldStorageCost = coldStorageRequired && partner.coldStorageSupported
      ? baseCost * 0.15
      : 0;

    // Insurance: ₹100 fixed
    const insuranceCost = hasInsurance ? 100 : 0;

    const totalCost = baseCost + loadingCost + coldStorageCost + insuranceCost;

    return {
      baseCost: Math.round(baseCost * 100) / 100,
      loadingCost,
      coldStorageCost: Math.round(coldStorageCost * 100) / 100,
      insuranceCost,
      totalCost: Math.round(totalCost * 100) / 100,
      breakdown: {
        'Base (distance × rate)': Math.round(baseCost * 100) / 100,
        'Loading charges': loadingCost,
        ...(coldStorageCost > 0 && { 'Cold storage premium': Math.round(coldStorageCost * 100) / 100 }),
        ...(insuranceCost > 0 && { 'Insurance': insuranceCost }),
      },
    };
  }

  /**
   * Score logistics partner based on match criteria
   * Returns 0-100 suitability score
   */
  static scoreLogisticsPartner(
    partner,
    requiredQuantityKg,
    pickupLat,
    pickupLon,
    dropLat,
    dropLon,
    options = {}
  ) {
    const { coldStorageRequired = false } = options;

    let score = 0;
    const details = {};

    // 1. Capacity check (30 points)
    const capacityRatio = partner.capacityKg / requiredQuantityKg;
    if (capacityRatio >= 1) {
      details.capacity = 30; // Perfect fit
      score += 30;
    } else if (capacityRatio >= 0.8) {
      details.capacity = 25; // 80%+ capacity
      score += 25;
    } else if (capacityRatio >= 0.5) {
      details.capacity = 15; // 50%+ capacity (might need multiple trips)
      score += 15;
    } else {
      details.capacity = 0; // Too small
    }

    // 2. Cold storage support (25 points)
    if (coldStorageRequired) {
      if (partner.coldStorageSupported) {
        details.coldStorage = 25;
        score += 25;
      } else {
        details.coldStorage = 0;
        score += 0;
      }
    } else {
      details.coldStorage = 25; // Full points if not required
      score += 25;
    }

    // 3. Availability (20 points)
    if (partner.available) {
      details.availability = 20;
      score += 20;
    }

    // 4. Distance from pickup (15 points)
    try {
      const distanceToPickup = this.calculateDistance(
        partner.latitude,
        partner.longitude,
        pickupLat,
        pickupLon
      );

      if (distanceToPickup <= 10) {
        details.proximity = 15;
        score += 15;
      } else if (distanceToPickup <= 30) {
        details.proximity = 12;
        score += 12;
      } else if (distanceToPickup <= 100) {
        details.proximity = 8;
        score += 8;
      } else {
        details.proximity = 0;
      }
    } catch (err) {
      // If distance calculation fails, neutral score
      details.proximity = 7;
      score += 7;
    }

    // 5. Vehicle suitability (10 points bonus)
    const vehicleScoreMap = {
      refrigerated: 10,    // Best for fresh produce
      large_truck: 8,
      container: 8,
      medium_truck: 6,
      small_truck: 3,
      pickup: 0,           // Not suitable for large quantities
    };

    details.vehicleType = vehicleScoreMap[partner.vehicleType] || 5;
    score += details.vehicleType;

    return {
      totalScore: Math.min(100, score),
      details,
      suitability: score >= 70 ? 'excellent' : score >= 50 ? 'good' : score >= 30 ? 'fair' : 'poor',
    };
  }

  /**
   * Filter and rank logistics partners by suitability
   */
  static rankLogisticsPartners(
    partners,
    requiredQuantityKg,
    pickupLat,
    pickupLon,
    dropLat,
    dropLon,
    options = {}
  ) {
    const { minScore = 40, maxResults = 5 } = options;

    const rankedPartners = partners
      .map((partner) => {
        const scoring = this.scoreLogisticsPartner(
          partner,
          requiredQuantityKg,
          pickupLat,
          pickupLon,
          dropLat,
          dropLon,
          options
        );

        const distance = this.calculateDistance(
          partner.latitude,
          partner.longitude,
          pickupLat,
          pickupLon
        );

        const cost = this.calculateTransportCost(
          this.calculateDistance(pickupLat, pickupLon, dropLat, dropLon),
          partner,
          options
        );

        return {
          partnerId: partner.id,
          partnerName: partner.name,
          vehicleType: partner.vehicleType,
          capacity: partner.capacityKg,
          score: scoring.totalScore,
          suitability: scoring.suitability,
          distanceFromPickup: Math.round(distance * 100) / 100,
          routeDistanceKm: Math.round(this.calculateDistance(pickupLat, pickupLon, dropLat, dropLon) * 100) / 100,
          estimatedCost: cost.totalCost,
          costBreakdown: cost.breakdown,
          coldStorageSupported: partner.coldStorageSupported,
          available: partner.available,
          phone: partner.phone,
          rating: scoring.details,
        };
      })
      .filter((p) => p.score >= minScore && p.available)
      .sort((a, b) => {
        // Sort by score descending, then by cost ascending
        if (b.score !== a.score) return b.score - a.score;
        return a.estimatedCost - b.estimatedCost;
      })
      .slice(0, maxResults);

    return rankedPartners;
  }

  /**
   * Find optimal logistics partner considering cost and score
   */
  static findOptimalPartner(rankedPartners, options = {}) {
    const { balanceScoreCost = 0.6 } = options; // 60% weight on score, 40% on cost

    if (rankedPartners.length === 0) {
      return null;
    }

    // Normalize scores to 0-100
    const maxCost = Math.max(...rankedPartners.map((p) => p.estimatedCost));
    const minCost = Math.min(...rankedPartners.map((p) => p.estimatedCost));

    const normalizedPartners = rankedPartners.map((partner) => {
      const scoreNorm = partner.score / 100;
      const costNorm = (partner.estimatedCost - minCost) / (maxCost - minCost || 1);

      const combinedScore =
        scoreNorm * balanceScoreCost + (1 - costNorm) * (1 - balanceScoreCost);

      return {
        ...partner,
        combinedScore: Math.round(combinedScore * 10000) / 100,
      };
    });

    // Return highest combined score
    return normalizedPartners.sort((a, b) => b.combinedScore - a.combinedScore)[0];
  }

  /**
   * Get cost estimate for a specific route
   */
  static getRouteEstimate(partner, pickupLat, pickupLon, dropLat, dropLon, options = {}) {
    const distanceKm = this.calculateDistance(pickupLat, pickupLon, dropLat, dropLon);

    const costInfo = this.calculateTransportCost(distanceKm, partner, options);

    return {
      pickupCoordinates: { lat: pickupLat, lon: pickupLon },
      dropCoordinates: { lat: dropLat, lon: dropLon },
      distanceKm: Math.round(distanceKm * 100) / 100,
      partnerName: partner.name,
      vehicleType: partner.vehicleType,
      ...costInfo,
      estimatedDeliveryDays: Math.max(1, Math.ceil(distanceKm / 300)), // ~300km per day average
    };
  }
}

module.exports = LogisticsCostEngine;
