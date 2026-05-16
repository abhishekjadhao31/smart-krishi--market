'use strict';

/**
 * Seed market_prices table from the Maharashtra Agmarknet CSV.
 *
 * Source file: database/seed/maharashtra_prices.csv
 * (Copy of the file shipped under ml-service/data/ so both layers
 * stay in sync without one depending on the other's folder.)
 *
 * Run:  npm run seed:prices
 *
 * Behavior: TRUNCATE market_prices, then bulk-INSERT every CSV row.
 * Idempotent — running it twice leaves the table in the same state.
 */

const path = require('path');
const fs = require('fs');

const { pool, query } = require('../src/config/db');

const CSV_PATH = path.resolve(__dirname, '..', '..', 'database', 'seed', 'maharashtra_prices.csv');

/**
 * Minimal RFC-4180-ish CSV row splitter. Handles values wrapped in
 * double quotes that contain commas (e.g. "1,300.00") and escaped
 * double quotes (""). One row of text in -> array of cell strings out.
 */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** "1,300.00" -> 1300, "" -> null, "abc" -> null. */
function toNumber(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "31-12-2025" (dd-mm-yyyy) -> "2025-12-31" ISO date. */
function toIsoDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) {
    // Try ISO already
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function loadRows() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found at ${CSV_PATH}`);
  }
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // Agmarknet CSV has a "report title" row before the real header — locate the header.
  const headerIdx = lines.findIndex((l) => /^State,District,Market/i.test(l));
  if (headerIdx === -1) {
    throw new Error('Could not find header row starting with "State,District,Market"');
  }
  const header = splitCsvLine(lines[headerIdx]).map((h) => h.trim());

  const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const col = {
    state: idx('State'),
    district: idx('District'),
    market: idx('Market'),
    commodity: idx('Commodity'),
    variety: idx('Variety'),
    minPrice: idx('Min Price'),
    maxPrice: idx('Max Price'),
    modalPrice: idx('Modal Price'),
    arrivalDate: idx('Arrival Date'),
  };
  const required = ['state', 'district', 'market', 'commodity', 'modalPrice', 'arrivalDate'];
  for (const k of required) {
    if (col[k] === -1) throw new Error(`CSV header missing required column for ${k}`);
  }

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const priceDate = toIsoDate(cells[col.arrivalDate]);
    const modal = toNumber(cells[col.modalPrice]);
    if (!priceDate || modal == null) continue; // skip incomplete rows
    rows.push({
      state: (cells[col.state] || '').trim(),
      district: (cells[col.district] || '').trim(),
      market: (cells[col.market] || '').trim(),
      commodity: (cells[col.commodity] || '').trim(),
      variety: (cells[col.variety] || '').trim() || null,
      min_price: toNumber(cells[col.minPrice]),
      max_price: toNumber(cells[col.maxPrice]),
      modal_price: modal,
      price_date: priceDate,
      source: 'agmarknet',
    });
  }
  return rows;
}

async function main() {
  const rows = loadRows();
  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('[seed:prices] No rows parsed; nothing to insert.');
    process.exit(0);
  }

  // eslint-disable-next-line no-console
  console.log(`[seed:prices] Loaded ${rows.length} rows from CSV. Truncating market_prices...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE market_prices RESTART IDENTITY');

    // Bulk insert in chunks for speed/safety.
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const values = [];
      const params = [];
      chunk.forEach((r, j) => {
        const base = j * 10;
        values.push(
          `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10})`
        );
        params.push(
          r.state,
          r.district,
          r.market,
          r.commodity,
          r.variety,
          r.min_price,
          r.max_price,
          r.modal_price,
          r.price_date,
          r.source
        );
      });
      const sql = `
        INSERT INTO market_prices
          (state, district, market, commodity, variety, min_price, max_price, modal_price, price_date, source)
        VALUES ${values.join(',')}
      `;
      await client.query(sql, params);
    }

    await client.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log(`[seed:prices] Inserted ${rows.length} rows into market_prices.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed:prices] FAILED:', err.message);
  process.exit(1);
});
