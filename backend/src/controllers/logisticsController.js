'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const db = require('../config/db');
const LogisticsCostEngine = require('../services/logisticsCostEngine');
const LocationService = require('../services/locationService');
const { createLogisticsPartnerSchema, createTransportBookingSchema, updateTransportBookingStatusSchema } = require('../validators/logisticsValidator');

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function serializeBooking(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    logisticsId: row.logistics_id,
    farmerId: row.farmer_id,
    listingName: row.crop_name,
    farmerName: row.farmer_name,
    buyerName: row.buyer_name,
    logisticsName: row.logistics_name,
    vehicleType: row.vehicle_type,
    pickupLatitude: Number(row.pickup_latitude),
    pickupLongitude: Number(row.pickup_longitude),
    dropLatitude: Number(row.drop_latitude),
    dropLongitude: Number(row.drop_longitude),
    distanceKm: Number(row.distance_km),
    estimatedCost: Number(row.estimated_cost),
    actualCost: row.actual_cost == null ? null : Number(row.actual_cost),
    pickupDate: row.pickup_date,
    deliveryDate: row.delivery_date,
    actualPickupDate: row.actual_pickup_date,
    actualDeliveryDate: row.actual_delivery_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastEventAt: row.last_event_at,
    lastEventNote: row.last_event_note,
    lastEventStatus: row.last_event_status,
  };
}

async function insertBookingEvent(client, bookingId, status, note, createdBy) {
  await client.query(
    `INSERT INTO transport_booking_events (transport_booking_id, status, note, created_by, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [bookingId, status, note || null, createdBy || null]
  );
}

/** POST /api/logistics - create logistics partner */
exports.createPartner = asyncHandler(async (req, res) => {
  const parse = createLogisticsPartnerSchema.safeParse(req.body);
  if (!parse.success) throw new ApiError(400, 'Validation failed', parse.error.errors);
  const payload = parse.data;

  const sql = `INSERT INTO logistics_partners (name, vehicle_type, capacity_kg, phone, latitude, longitude, city, state, cold_storage_supported, available, rate_per_km, loading_charges, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW()) RETURNING *`;
  const values = [payload.name, payload.vehicleType, payload.capacityKg, payload.phone, payload.latitude, payload.longitude, payload.city || null, payload.state, payload.coldStorageSupported || false, payload.available ?? true, payload.ratePerKm, payload.loadingCharges || 500];
  const { rows } = await db.query(sql, values);
  res.status(201).json({ data: rows[0] });
});

/** GET /api/logistics/nearby */
exports.findNearby = asyncHandler(async (req, res) => {
  const pickupLocation = req.query.pickupLocation || req.query.pickup || req.query.location;
  const dropLocation = req.query.dropLocation || req.query.drop || req.query.destination;
  const pickupResolved = await LocationService.resolveLocation(pickupLocation, req.query.pickupLat ?? req.query.lat, req.query.pickupLon ?? req.query.lon);
  const dropResolved = await LocationService.resolveLocation(dropLocation, req.query.dropLat ?? req.query.destLat ?? req.query.lat, req.query.dropLon ?? req.query.destLon ?? req.query.lon);
  const pickupLat = pickupResolved?.latitude ?? toNumber(req.query.pickupLat ?? req.query.lat);
  const pickupLon = pickupResolved?.longitude ?? toNumber(req.query.pickupLon ?? req.query.lon);
  const dropLat = dropResolved?.latitude ?? toNumber(req.query.dropLat ?? req.query.destLat ?? req.query.lat);
  const dropLon = dropResolved?.longitude ?? toNumber(req.query.dropLon ?? req.query.destLon ?? req.query.lon);
  const qty = parseFloat(req.query.qty) || 0;
  const cold = req.query.cold === 'true';
  const radiusKm = parseFloat(req.query.radius) || 100;

  if (pickupLat == null || pickupLon == null) throw new ApiError(400, 'Invalid coordinates');

  const sql = `SELECT * FROM logistics_partners WHERE available = TRUE`;
  const { rows } = await db.query(sql);

  const partners = rows.map((r) => ({
    id: r.id,
    name: r.name,
    vehicleType: r.vehicle_type,
    capacityKg: parseFloat(r.capacity_kg),
    phone: r.phone,
    latitude: r.latitude,
    longitude: r.longitude,
    coldStorageSupported: r.cold_storage_supported,
    available: r.available,
    ratePerKm: parseFloat(r.rate_per_km),
    loadingCharges: parseFloat(r.loading_charges),
  }));

  const ranked = LogisticsCostEngine.rankLogisticsPartners(
    partners,
    qty,
    pickupLat,
    pickupLon,
    dropLat ?? pickupLat,
    dropLon ?? pickupLon,
    { coldStorageRequired: cold, minScore: 30, maxResults: 20, radiusKm }
  );

  res.json({
    data: ranked,
    route: {
      pickupLocation: pickupResolved,
      dropLocation: dropResolved,
    },
  });
});

/** POST /api/transport-bookings */
exports.createTransportBooking = asyncHandler(async (req, res) => {
  const parse = createTransportBookingSchema.safeParse(req.body);
  if (!parse.success) throw new ApiError(400, 'Validation failed', parse.error.errors);
  const p = parse.data;

  const logisticsRes = await db.query('SELECT * FROM logistics_partners WHERE id = $1', [p.logisticsId]);
  if (!logisticsRes.rows.length) throw new ApiError(404, 'Logistics partner not found');
  const partner = logisticsRes.rows[0];

  const listingRes = await db.query('SELECT id, farmer_id, crop_name FROM crops WHERE id = $1', [p.listingId]);
  if (!listingRes.rows.length) throw new ApiError(404, 'Crop listing not found');
  const listing = listingRes.rows[0];
  const farmerId = p.farmerId || listing.farmer_id;

  const pickupResolved = await LocationService.resolveLocation(p.pickupLocation, p.pickupLatitude, p.pickupLongitude);
  const dropResolved = await LocationService.resolveLocation(p.dropLocation, p.dropLatitude, p.dropLongitude);
  if (!pickupResolved || !dropResolved) throw new ApiError(400, 'Please choose pickup and drop locations');

  const distanceKm = LogisticsCostEngine.calculateDistance(pickupResolved.latitude, pickupResolved.longitude, dropResolved.latitude, dropResolved.longitude);
  const costInfo = LogisticsCostEngine.calculateTransportCost(distanceKm, {
    ratePerKm: parseFloat(partner.rate_per_km),
    loadingCharges: parseFloat(partner.loading_charges),
    coldStorageSupported: partner.cold_storage_supported,
  }, { coldStorageRequired: Boolean(p.coldStorageRequired) });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const insertSql = `INSERT INTO transport_bookings (listing_id, buyer_id, logistics_id, farmer_id, pickup_latitude, pickup_longitude, drop_latitude, drop_longitude, distance_km, estimated_cost, pickup_date, delivery_date, status, notes, created_at, updated_at)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending',$13,NOW(),NOW()) RETURNING *`;
    const values = [
      p.listingId,
      p.buyerId || null,
      p.logisticsId,
      farmerId,
      pickupResolved.latitude,
      pickupResolved.longitude,
      dropResolved.latitude,
      dropResolved.longitude,
      distanceKm,
      costInfo.totalCost,
      p.pickupDate,
      p.deliveryDate,
      p.notes || null,
    ];
    const { rows } = await client.query(insertSql, values);
    await insertBookingEvent(client, rows[0].id, 'pending', 'Booking created', req.user?.id || null);
    await client.query('COMMIT');

    res.status(201).json({
      data: rows[0],
      costBreakdown: costInfo.breakdown,
      routeEstimate: {
        distanceKm: Math.round(distanceKm * 100) / 100,
        estimatedDeliveryDays: Math.max(1, Math.ceil(distanceKm / 300)),
        partnerName: partner.name,
        vehicleType: partner.vehicle_type,
        pickupLocation: pickupResolved,
        dropLocation: dropResolved,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/** GET /api/locations/search */
exports.searchLocations = asyncHandler(async (req, res) => {
  const query = String(req.query.q || req.query.query || '').trim();
  const limit = Math.min(parseInt(req.query.limit, 10) || 6, 10);
  const suggestions = await LocationService.searchLocations(query, { limit });
  res.json({ data: suggestions });
});

/** GET /api/locations/reverse */
exports.reverseLocation = asyncHandler(async (req, res) => {
  const latitude = req.query.lat ?? req.query.latitude;
  const longitude = req.query.lon ?? req.query.lng ?? req.query.longitude;
  const location = await LocationService.reverseGeocode(latitude, longitude);
  if (!location) throw new ApiError(400, 'Invalid coordinates');
  res.json({ data: location });
});

/** PATCH /api/transport-bookings/:id/status */
exports.updateTransportBookingStatus = asyncHandler(async (req, res) => {
  const parse = updateTransportBookingStatusSchema.safeParse(req.body);
  if (!parse.success) throw new ApiError(400, 'Validation failed', parse.error.errors);
  const { status, note } = parse.data;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const bookingRes = await client.query('SELECT * FROM transport_bookings WHERE id = $1', [req.params.id]);
    if (!bookingRes.rows.length) throw new ApiError(404, 'Transport booking not found');

    const updatedRes = await client.query(
      `UPDATE transport_bookings
         SET status = $1,
             notes = COALESCE($2, notes),
             actual_pickup_date = CASE WHEN $1 = 'in_transit' AND actual_pickup_date IS NULL THEN NOW() ELSE actual_pickup_date END,
             actual_delivery_date = CASE WHEN $1 = 'delivered' THEN NOW() ELSE actual_delivery_date END,
             updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, note || null, req.params.id]
    );

    await insertBookingEvent(client, req.params.id, status, note, req.user?.id || null);
    await client.query('COMMIT');
    res.json({ data: updatedRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/** GET /api/transport-bookings */
exports.listTransportBookings = asyncHandler(async (req, res) => {
  const status = req.query.status;
  const role = req.user?.role;

  const where = [];
  const params = [];
  if (status) {
    params.push(status);
    where.push(`tb.status = $${params.length}`);
  }
  if (role === 'farmer') {
    params.push(req.user.id);
    where.push(`tb.farmer_id = $${params.length}`);
  } else if (role === 'buyer') {
    params.push(req.user.id);
    where.push(`tb.buyer_id = $${params.length}`);
  }

  const sql = `SELECT tb.*, c.crop_name, lp.name as logistics_name, lp.vehicle_type, f.name as farmer_name, b.name as buyer_name,
                      ev.created_at as last_event_at, ev.note as last_event_note, ev.status as last_event_status
               FROM transport_bookings tb
               JOIN crops c ON c.id = tb.listing_id
               JOIN logistics_partners lp ON lp.id = tb.logistics_id
               JOIN users f ON f.id = tb.farmer_id
               LEFT JOIN users b ON b.id = tb.buyer_id
               LEFT JOIN LATERAL (
                 SELECT e.created_at, e.note, e.status
                   FROM transport_booking_events e
                  WHERE e.transport_booking_id = tb.id
                  ORDER BY e.created_at DESC, e.id DESC
                  LIMIT 1
               ) ev ON TRUE
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY tb.created_at DESC
               LIMIT 100`;
  const { rows } = await db.query(sql, params);
  res.json({ data: rows.map(serializeBooking) });
});

/** GET /api/transport-bookings/:id */
exports.getTransportBooking = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT tb.*, c.crop_name, lp.name as logistics_name, lp.vehicle_type, f.name as farmer_name, b.name as buyer_name
       FROM transport_bookings tb
       JOIN crops c ON c.id = tb.listing_id
       JOIN logistics_partners lp ON lp.id = tb.logistics_id
       JOIN users f ON f.id = tb.farmer_id
       LEFT JOIN users b ON b.id = tb.buyer_id
      WHERE tb.id = $1`,
    [req.params.id]
  );
  if (!rows.length) throw new ApiError(404, 'Transport booking not found');
  res.json({ data: serializeBooking(rows[0]) });
});

/** GET /api/transport-bookings/:id/events */
exports.getTransportBookingEvents = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT e.id, e.transport_booking_id, e.status, e.note, e.created_by, e.created_at, u.name as created_by_name
       FROM transport_booking_events e
       LEFT JOIN users u ON u.id = e.created_by
      WHERE e.transport_booking_id = $1
      ORDER BY e.created_at ASC, e.id ASC`,
    [req.params.id]
  );
  res.json({ data: rows });
});
