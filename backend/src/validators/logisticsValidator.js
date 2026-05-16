'use strict';

const { z } = require('zod');

const createLogisticsPartnerSchema = z.object({
  name: z.string().min(1).max(255),
  vehicleType: z.enum(['small_truck','medium_truck','large_truck','container','refrigerated','pickup']),
  capacityKg: z.number().positive(),
  phone: z.string().min(6).max(20),
  latitude: z.number(),
  longitude: z.number(),
  city: z.string().optional(),
  state: z.string().min(2).max(100),
  coldStorageSupported: z.boolean().optional(),
  available: z.boolean().optional(),
  ratePerKm: z.number().positive(),
  loadingCharges: z.number().positive().optional(),
});

const createTransportBookingSchema = z.object({
  listingId: z.number().int().positive(),
  logisticsId: z.number().int().positive(),
  farmerId: z.number().int().positive().optional(),
  buyerId: z.number().int().positive().optional(),
  pickupLocation: z.string().min(1).max(255),
  dropLocation: z.string().min(1).max(255),
  pickupLatitude: z.number().optional(),
  pickupLongitude: z.number().optional(),
  dropLatitude: z.number().optional(),
  dropLongitude: z.number().optional(),
  pickupDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' }),
  deliveryDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' }),
  estimatedCost: z.number().positive().optional(),
  coldStorageRequired: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

const updateTransportBookingStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'in_transit', 'delivered', 'cancelled']),
  note: z.string().max(2000).optional(),
});

module.exports = {
  createLogisticsPartnerSchema,
  createTransportBookingSchema,
  updateTransportBookingStatusSchema,
};