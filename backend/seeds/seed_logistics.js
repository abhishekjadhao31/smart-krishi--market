require('dotenv').config();
const { pool } = require('../src/config/db');

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('[seed] inserting logistics partners...');
    const partners = [
      {
        name: 'GreenTrans Logistics',
        vehicle_type: 'refrigerated',
        capacity_kg: 8000,
        phone: '9990011111',
        latitude: 19.0760,
        longitude: 72.8777,
        city: 'Mumbai',
        state: 'Maharashtra',
        cold_storage_supported: true,
        available: true,
        rate_per_km: 18.5,
        loading_charges: 600,
      },
      {
        name: 'Kisan Trucks Co',
        vehicle_type: 'medium_truck',
        capacity_kg: 4000,
        phone: '9981122334',
        latitude: 17.3850,
        longitude: 78.4867,
        city: 'Hyderabad',
        state: 'Telangana',
        cold_storage_supported: false,
        available: true,
        rate_per_km: 12.0,
        loading_charges: 450,
      },
      {
        name: 'FarmLink Couriers',
        vehicle_type: 'pickup',
        capacity_kg: 1000,
        phone: '9775566880',
        latitude: 28.7041,
        longitude: 77.1025,
        city: 'Delhi',
        state: 'Delhi',
        cold_storage_supported: false,
        available: true,
        rate_per_km: 9.0,
        loading_charges: 300,
      },
    ];

    for (const p of partners) {
      const res = await client.query(
        `INSERT INTO logistics_partners (name, vehicle_type, capacity_kg, phone, latitude, longitude, city, state, cold_storage_supported, available, rate_per_km, loading_charges)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT DO NOTHING RETURNING *`,
        [p.name, p.vehicle_type, p.capacity_kg, p.phone, p.latitude, p.longitude, p.city, p.state, p.cold_storage_supported, p.available, p.rate_per_km, p.loading_charges]
      );
      console.log('[seed] inserted partner:', res.rows[0] ? res.rows[0].name : p.name);
    }

    // Create a sample transport booking if a crop exists
    const cropRes = await client.query('SELECT id, crop_name, farmer_id, latitude, longitude FROM crops LIMIT 1');
    if (cropRes.rows.length > 0) {
      const crop = cropRes.rows[0];
      const partnerRow = await client.query('SELECT * FROM logistics_partners LIMIT 1');
      if (partnerRow.rows.length > 0) {
        const partner = partnerRow.rows[0];
        const pickupLat = Number(crop.latitude || partner.latitude);
        const pickupLon = Number(crop.longitude || partner.longitude);
        const dropLat = Number(partner.latitude) + 0.05;
        const dropLon = Number(partner.longitude) + 0.05;
        const distanceKm = haversineKm(pickupLat, pickupLon, dropLat, dropLon);
        const estimatedCost = Number((distanceKm * Number(partner.rate_per_km || 10) + Number(partner.loading_charges || 500)).toFixed(2));

        const exists = await client.query('SELECT id FROM transport_bookings WHERE listing_id = $1', [crop.id]);
        if (exists.rows.length === 0) {
          const ins = await client.query(
            `INSERT INTO transport_bookings (listing_id, buyer_id, logistics_id, farmer_id, pickup_latitude, pickup_longitude, drop_latitude, drop_longitude, distance_km, estimated_cost, pickup_date, delivery_date, status, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW() + INTERVAL '1 day', NOW() + INTERVAL '3 day', 'pending', $11) RETURNING *`,
            [crop.id, null, partner.id, crop.farmer_id || 1, pickupLat, pickupLon, dropLat, dropLon, distanceKm, estimatedCost, 'Demo booking from seed']
          );
          console.log('[seed] created sample booking id:', ins.rows[0].id);

          await client.query(
            `INSERT INTO transport_booking_events (transport_booking_id, status, note, created_by) VALUES ($1,$2,$3,$4)`,
            [ins.rows[0].id, 'pending', 'Seed created booking', null]
          );
        } else {
          console.log('[seed] a transport booking for the first listing already exists; skipping booking creation');
        }
      }
    } else {
      console.log('[seed] no crops found in DB — skipped creating sample booking');
    }

    console.log('[seed] done');
  } catch (err) {
    console.error('[seed] error', err.message);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

seed();
