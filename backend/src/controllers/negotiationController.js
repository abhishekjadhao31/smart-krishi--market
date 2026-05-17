'use strict';

const asyncHandler = require('../utils/asyncHandler');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');

/**
 * POST /api/negotiations
 * Create a negotiation offer (buyer -> farmer or farmer -> buyer)
 */
exports.createNegotiation = asyncHandler(async (req, res) => {
  const { matchId, fromUserId, toUserId, offerPricePerKg, offerQuantityKg, message } = req.body;
  if (!matchId || !fromUserId || !toUserId || !offerPricePerKg || !offerQuantityKg) {
    throw new ApiError(400, 'Missing required negotiation fields');
  }

  const sql = `INSERT INTO negotiations (match_id, from_user_id, to_user_id, offer_price_per_kg, offer_quantity_kg, message, status, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,'open',NOW(),NOW()) RETURNING *`;
  const values = [matchId, fromUserId, toUserId, offerPricePerKg, offerQuantityKg, message || null];
  const { rows } = await db.query(sql, values);
  res.status(201).json({ negotiation: rows[0] });
});

/**
 * GET /api/negotiations/user/:userId
 * List negotiations for a user (inbox/outbox)
 */
exports.listNegotiationsForUser = asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) throw new ApiError(400, 'Invalid userId');

  const sql = `SELECT n.*, u_from.name AS from_name, u_to.name AS to_name, m.total_score
               FROM negotiations n
               LEFT JOIN users u_from ON u_from.id = n.from_user_id
               LEFT JOIN users u_to ON u_to.id = n.to_user_id
               LEFT JOIN matches m ON m.id = n.match_id
               WHERE n.from_user_id = $1 OR n.to_user_id = $1
               ORDER BY n.created_at DESC LIMIT 200`;
  const { rows } = await db.query(sql, [userId]);
  res.json({ data: rows });
});

/**
 * POST /api/negotiations/:id/respond
 * Respond to an offer: accept/reject/counter
 */
exports.respondToNegotiation = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { action, counterPricePerKg, counterQuantityKg, responderId } = req.body;
  if (Number.isNaN(id)) throw new ApiError(400, 'Invalid negotiation id');
  if (!action || !['accept', 'reject', 'counter'].includes(action)) throw new ApiError(400, 'Invalid action');

  if (action === 'counter') {
    if (!counterPricePerKg || !counterQuantityKg) throw new ApiError(400, 'Counter requires price and quantity');
    // Insert a new negotiation row as counter-offer
    const getMatchSql = 'SELECT * FROM negotiations WHERE id = $1';
    const { rows: existing } = await db.query(getMatchSql, [id]);
    if (!existing[0]) throw new ApiError(404, 'Negotiation not found');
    const base = existing[0];

    const insertSql = `INSERT INTO negotiations (match_id, from_user_id, to_user_id, offer_price_per_kg, offer_quantity_kg, message, status, created_at, updated_at)
                       VALUES ($1,$2,$3,$4,$5,$6,'open',NOW(),NOW()) RETURNING *`;
    const values = [base.match_id, responderId, base.from_user_id, counterPricePerKg, counterQuantityKg, req.body.message || null];
    const { rows } = await db.query(insertSql, values);
    return res.status(201).json({ negotiation: rows[0] });
  }

  // accept or reject: update the existing negotiation status
  const updateSql = 'UPDATE negotiations SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *';
  const { rows: updated } = await db.query(updateSql, [action === 'accept' ? 'accepted' : 'rejected', id]);
  if (!updated[0]) throw new ApiError(404, 'Negotiation not found');

  // If accepted, optionally update match status to accepted
  if (action === 'accept') {
    try {
      await db.query('UPDATE matches SET status=$1, updated_at=NOW() WHERE id=(SELECT match_id FROM negotiations WHERE id=$1)', ['accepted', id]);
    } catch (err) {
      // ignore non-critical
    }
  }

  res.json({ negotiation: updated[0] });
});
