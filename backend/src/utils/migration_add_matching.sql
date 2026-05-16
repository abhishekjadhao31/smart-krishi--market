-- Add new tables for Smart Krishi matching system
-- Migration: Add buyer profiles, buyer requests, matches, logistics

-- Create buyer_profiles table
CREATE TABLE IF NOT EXISTS buyer_profiles (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name    VARCHAR(255) NOT NULL,
  buyer_type      VARCHAR(50) NOT NULL CHECK (buyer_type IN ('retail', 'wholesale', 'restaurant', 'food_processor', 'exporter', 'trader')),
  
  -- Location
  latitude        NUMERIC(10, 8) NOT NULL,
  longitude       NUMERIC(11, 8) NOT NULL,
  city            VARCHAR(100),
  state           VARCHAR(100) NOT NULL,
  district        VARCHAR(100) NOT NULL,
  
  -- Preferences
  preferred_crops TEXT,  -- JSON array
  min_quantity    NUMERIC(12, 2),
  max_price       NUMERIC(12, 2),
  cold_storage_needed BOOLEAN DEFAULT FALSE,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_profiles_user_id ON buyer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_state ON buyer_profiles(state);
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_buyer_type ON buyer_profiles(buyer_type);

-- Create buyer_requests table
CREATE TABLE IF NOT EXISTS buyer_requests (
  id              SERIAL PRIMARY KEY,
  buyer_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop_name       VARCHAR(100) NOT NULL,
  quantity_needed NUMERIC(12, 2) NOT NULL,
  max_price       NUMERIC(12, 2) NOT NULL,
  delivery_date   TIMESTAMPTZ NOT NULL,
  urgency         VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_requests_buyer_id ON buyer_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_buyer_requests_crop_name ON buyer_requests(crop_name);
CREATE INDEX IF NOT EXISTS idx_buyer_requests_created_at ON buyer_requests(created_at DESC);

-- Create matches table (AI-generated farmer-buyer matches)
CREATE TABLE IF NOT EXISTS matches (
  id                    SERIAL PRIMARY KEY,
  listing_id            INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  buyer_request_id      INTEGER NOT NULL REFERENCES buyer_requests(id) ON DELETE CASCADE,
  farmer_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Scoring (40% crop, 25% distance, 20% price, 10% quantity, 5% urgency)
  crop_match_score      NUMERIC(5, 2) NOT NULL,      -- 0-100
  distance_score        NUMERIC(5, 2) NOT NULL,      -- 0-100
  price_score           NUMERIC(5, 2) NOT NULL,      -- 0-100
  quantity_score        NUMERIC(5, 2) NOT NULL,      -- 0-100
  urgency_score         NUMERIC(5, 2) NOT NULL,      -- 0-100
  total_score           NUMERIC(6, 2) NOT NULL,      -- Weighted 0-100
  
  -- Distance
  distance_km           NUMERIC(10, 2) NOT NULL,
  
  -- Metadata
  match_reason          TEXT,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed')),
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_listing_id ON matches(listing_id);
CREATE INDEX IF NOT EXISTS idx_matches_buyer_request_id ON matches(buyer_request_id);
CREATE INDEX IF NOT EXISTS idx_matches_farmer_id ON matches(farmer_id);
CREATE INDEX IF NOT EXISTS idx_matches_total_score ON matches(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);

-- Create logistics_partners table
CREATE TABLE IF NOT EXISTS logistics_partners (
  id                        SERIAL PRIMARY KEY,
  name                      VARCHAR(255) NOT NULL,
  vehicle_type              VARCHAR(50) NOT NULL CHECK (vehicle_type IN ('small_truck', 'medium_truck', 'large_truck', 'container', 'refrigerated', 'pickup')),
  capacity_kg               NUMERIC(12, 2) NOT NULL,
  phone                     VARCHAR(20) NOT NULL,
  
  -- Location
  latitude                  NUMERIC(10, 8) NOT NULL,
  longitude                 NUMERIC(11, 8) NOT NULL,
  city                      VARCHAR(100),
  state                     VARCHAR(100) NOT NULL,
  
  -- Features
  cold_storage_supported    BOOLEAN DEFAULT FALSE,
  available                 BOOLEAN DEFAULT TRUE,
  rate_per_km               NUMERIC(8, 2) NOT NULL,  -- Transport cost per km
  loading_charges           NUMERIC(8, 2) DEFAULT 500,  -- Fixed loading charges
  
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logistics_vehicle_type ON logistics_partners(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_logistics_state ON logistics_partners(state);
CREATE INDEX IF NOT EXISTS idx_logistics_available ON logistics_partners(available);

-- Create transport_bookings table
CREATE TABLE IF NOT EXISTS transport_bookings (
  id                      SERIAL PRIMARY KEY,
  listing_id              INTEGER NOT NULL UNIQUE REFERENCES crops(id) ON DELETE CASCADE,
  buyer_id                INTEGER REFERENCES users(id) ON DELETE SET NULL,
  logistics_id            INTEGER NOT NULL REFERENCES logistics_partners(id) ON DELETE RESTRICT,
  farmer_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Routing
  pickup_latitude         NUMERIC(10, 8) NOT NULL,
  pickup_longitude        NUMERIC(11, 8) NOT NULL,
  drop_latitude           NUMERIC(10, 8) NOT NULL,
  drop_longitude          NUMERIC(11, 8) NOT NULL,
  
  -- Logistics details
  distance_km             NUMERIC(10, 2) NOT NULL,
  estimated_cost          NUMERIC(10, 2) NOT NULL,
  actual_cost             NUMERIC(10, 2),
  
  -- Timeline
  pickup_date             TIMESTAMPTZ NOT NULL,
  delivery_date           TIMESTAMPTZ NOT NULL,
  actual_pickup_date      TIMESTAMPTZ,
  actual_delivery_date    TIMESTAMPTZ,
  
  -- Status
  status                  VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_transit', 'delivered', 'cancelled')),
  notes                   TEXT,
  
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_bookings_listing_id ON transport_bookings(listing_id);
CREATE INDEX IF NOT EXISTS idx_transport_bookings_buyer_id ON transport_bookings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transport_bookings_logistics_id ON transport_bookings(logistics_id);
CREATE INDEX IF NOT EXISTS idx_transport_bookings_farmer_id ON transport_bookings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_transport_bookings_status ON transport_bookings(status);
CREATE INDEX IF NOT EXISTS idx_transport_bookings_pickup_date ON transport_bookings(pickup_date);

-- Create transport booking status history
CREATE TABLE IF NOT EXISTS transport_booking_events (
  id                   SERIAL PRIMARY KEY,
  transport_booking_id  INTEGER NOT NULL REFERENCES transport_bookings(id) ON DELETE CASCADE,
  status                VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'confirmed', 'in_transit', 'delivered', 'cancelled')),
  note                 TEXT,
  created_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_booking_events_booking_id ON transport_booking_events(transport_booking_id);
CREATE INDEX IF NOT EXISTS idx_transport_booking_events_status ON transport_booking_events(status);

-- Create matching_logs table for AI audit
CREATE TABLE IF NOT EXISTS matching_logs (
  id                SERIAL PRIMARY KEY,
  buyer_request_id  INTEGER NOT NULL,
  listing_id        INTEGER,
  algorithm         VARCHAR(100),
  scores            JSONB,
  decision_reason   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matching_logs_buyer_request_id ON matching_logs(buyer_request_id);
CREATE INDEX IF NOT EXISTS idx_matching_logs_created_at ON matching_logs(created_at DESC);

-- Add geolocation columns to crops if not present
ALTER TABLE IF EXISTS crops
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8);

-- Create index for geo-queries
CREATE INDEX IF NOT EXISTS idx_crops_geo ON crops(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
