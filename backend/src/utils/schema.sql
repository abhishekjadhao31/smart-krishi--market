-- Smart Krishi Market — backend bootstrap schema.
-- This is the backend's local copy used by `npm run migrate` so a developer
-- can spin up a working DB without depending on the database team's tooling.
-- The canonical schema lives in /database; keep this file in sync with it.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('farmer', 'buyer', 'admin')),
  state         VARCHAR(100),
  district      VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS crops (
  id                 SERIAL PRIMARY KEY,
  farmer_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop_name          VARCHAR(100) NOT NULL,
  variety            VARCHAR(100),
  quantity_kg        NUMERIC(12, 2) NOT NULL CHECK (quantity_kg > 0),
  price_per_kg       NUMERIC(12, 2),
  state              VARCHAR(100),
  district           VARCHAR(100),
  market             VARCHAR(100),
  harvest_date       DATE,
  storage_available  BOOLEAN NOT NULL DEFAULT FALSE,
  description        TEXT,
  image_url          TEXT,
  status             VARCHAR(20) NOT NULL DEFAULT 'available'
                       CHECK (status IN ('available', 'sold', 'hold')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crops_farmer    ON crops(farmer_id);
CREATE INDEX IF NOT EXISTS idx_crops_crop_name ON crops(LOWER(crop_name));
CREATE INDEX IF NOT EXISTS idx_crops_state     ON crops(state);
CREATE INDEX IF NOT EXISTS idx_crops_status    ON crops(status);

CREATE TABLE IF NOT EXISTS market_prices (
  id          SERIAL PRIMARY KEY,
  state       VARCHAR(100),
  district    VARCHAR(100),
  market      VARCHAR(100),
  commodity   VARCHAR(100) NOT NULL,
  variety     VARCHAR(100),
  min_price   NUMERIC(12, 2),
  max_price   NUMERIC(12, 2),
  modal_price NUMERIC(12, 2),
  price_date  DATE NOT NULL,
  source      VARCHAR(100) DEFAULT 'agmarknet',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS market_prices
  ADD COLUMN IF NOT EXISTS arrivals NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS unit VARCHAR(50),
  ADD COLUMN IF NOT EXISTS day_of_week INTEGER,
  ADD COLUMN IF NOT EXISTS month INTEGER,
  ADD COLUMN IF NOT EXISTS lag_1_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS lag_7_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS rolling_avg_7 NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS rolling_avg_30 NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS price_trend NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS arrivals_trend NUMERIC(14, 2);

CREATE INDEX IF NOT EXISTS idx_prices_commodity ON market_prices(LOWER(commodity));
CREATE INDEX IF NOT EXISTS idx_prices_state     ON market_prices(state);
CREATE INDEX IF NOT EXISTS idx_prices_district  ON market_prices(district);
CREATE INDEX IF NOT EXISTS idx_prices_market    ON market_prices(market);
CREATE INDEX IF NOT EXISTS idx_prices_date      ON market_prices(price_date DESC);

-- Daily weather data used as additional ML features for mandi price prediction.
CREATE TABLE IF NOT EXISTS weather_daily (
  id            SERIAL PRIMARY KEY,
  weather_date  DATE NOT NULL,
  district      VARCHAR(100) NOT NULL,
  latitude      NUMERIC(10, 8),
  longitude     NUMERIC(11, 8),
  temp_avg_c    NUMERIC(8, 2),
  temp_min_c    NUMERIC(8, 2),
  temp_max_c    NUMERIC(8, 2),
  rainfall_mm   NUMERIC(10, 2) DEFAULT 0,
  humidity_pct  NUMERIC(8, 2),
  wind_kmph      NUMERIC(8, 2),
  source        VARCHAR(100) DEFAULT 'weather_csv',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (weather_date, district)
);

CREATE INDEX IF NOT EXISTS idx_weather_daily_date ON weather_daily(weather_date DESC);
CREATE INDEX IF NOT EXISTS idx_weather_daily_district ON weather_daily(district);

-- Simple buyer-farmer chat conversations
CREATE TABLE IF NOT EXISTS conversations (
  id              SERIAL PRIMARY KEY,
  buyer_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farmer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id      INTEGER REFERENCES crops(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversations_buyer_farmer_listing_unique UNIQUE (buyer_id, farmer_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_farmer ON conversations(farmer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_listing ON conversations(listing_id);

-- Messages table for farmer-buyer communication
CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  from_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop_id         INTEGER REFERENCES crops(id) ON DELETE SET NULL,
  subject         VARCHAR(255),
  body            TEXT NOT NULL,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  text            TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS messages
  ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS text TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_crop ON messages(crop_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- ============================================================================
-- NEW TABLES FOR MATCHING SYSTEM
-- ============================================================================

-- Add geolocation columns to crops if not present
ALTER TABLE IF EXISTS crops
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8);

CREATE INDEX IF NOT EXISTS idx_crops_geo ON crops(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Buyer profiles table
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
  preferred_crops TEXT,
  min_quantity    NUMERIC(12, 2),
  max_price       NUMERIC(12, 2),
  cold_storage_needed BOOLEAN DEFAULT FALSE,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_profiles_user_id ON buyer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_state ON buyer_profiles(state);
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_buyer_type ON buyer_profiles(buyer_type);

-- Buyer requests table
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

-- Matches table (AI-generated matches)
CREATE TABLE IF NOT EXISTS matches (
  id                    SERIAL PRIMARY KEY,
  listing_id            INTEGER NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  buyer_request_id      INTEGER NOT NULL REFERENCES buyer_requests(id) ON DELETE CASCADE,
  farmer_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Scoring
  crop_match_score      NUMERIC(5, 2) NOT NULL,
  distance_score        NUMERIC(5, 2) NOT NULL,
  price_score           NUMERIC(5, 2) NOT NULL,
  quantity_score        NUMERIC(5, 2) NOT NULL,
  urgency_score         NUMERIC(5, 2) NOT NULL,
  total_score           NUMERIC(6, 2) NOT NULL,
  
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

-- Logistics partners table
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
  rate_per_km               NUMERIC(8, 2) NOT NULL,
  loading_charges           NUMERIC(8, 2) DEFAULT 500,
  
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logistics_vehicle_type ON logistics_partners(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_logistics_state ON logistics_partners(state);
CREATE INDEX IF NOT EXISTS idx_logistics_available ON logistics_partners(available);

-- Transport bookings table
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

-- Transport booking status history
CREATE TABLE IF NOT EXISTS transport_booking_events (
  id                  SERIAL PRIMARY KEY,
  transport_booking_id INTEGER NOT NULL REFERENCES transport_bookings(id) ON DELETE CASCADE,
  status              VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'confirmed', 'in_transit', 'delivered', 'cancelled')),
  note                TEXT,
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transport_booking_events_booking_id ON transport_booking_events(transport_booking_id);
CREATE INDEX IF NOT EXISTS idx_transport_booking_events_status ON transport_booking_events(status);

-- Matching logs for AI audit trail
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

-- Negotiations table to track offers and counter-offers between buyer and farmer
CREATE TABLE IF NOT EXISTS negotiations (
  id                SERIAL PRIMARY KEY,
  match_id          INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  from_user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_price_per_kg NUMERIC(12,2) NOT NULL,
  offer_quantity_kg NUMERIC(12,2) NOT NULL,
  message           TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected','withdrawn')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_negotiations_match_id ON negotiations(match_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_from_user ON negotiations(from_user_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_to_user ON negotiations(to_user_id);
