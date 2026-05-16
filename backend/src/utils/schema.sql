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

CREATE INDEX IF NOT EXISTS idx_prices_commodity ON market_prices(LOWER(commodity));
CREATE INDEX IF NOT EXISTS idx_prices_state     ON market_prices(state);
CREATE INDEX IF NOT EXISTS idx_prices_date      ON market_prices(price_date DESC);
