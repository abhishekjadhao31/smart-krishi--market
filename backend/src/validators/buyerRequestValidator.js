'use strict';

const { z } = require('zod');

const createBuyerRequestSchema = z.object({
  buyerId: z.number().int().positive(),
  cropName: z.string().min(1).max(100),
  quantityNeeded: z.number().positive(),
  maxPrice: z.number().positive(),
  deliveryDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' }),
  urgency: z.enum(['low','medium','high']).optional(),
  buyerLat: z.number().optional(),
  buyerLon: z.number().optional(),
});

module.exports = {
  createBuyerRequestSchema,
};