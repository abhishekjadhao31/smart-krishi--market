'use strict';

const { query } = require('../config/db');

async function create(data) {
  const { fromUserId, toUserId, cropId, subject, body } = data;
  const { rows } = await query(
    `INSERT INTO messages (from_user_id, to_user_id, crop_id, subject, body)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [fromUserId, toUserId, cropId || null, subject || null, body]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await query(
    `SELECT * FROM messages WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Get inbox for a user (messages TO them)
async function getInbox(userId, limit = 50, offset = 0) {
  const { rows } = await query(
    `SELECT m.*, 
            u.name AS from_name, u.email AS from_email,
            c.crop_name
     FROM messages m
     JOIN users u ON u.id = m.from_user_id
     LEFT JOIN crops c ON c.id = m.crop_id
     WHERE m.to_user_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

// Get sent messages by a user
async function getSent(userId, limit = 50, offset = 0) {
  const { rows } = await query(
    `SELECT m.*,
            u.name AS to_name, u.email AS to_email,
            c.crop_name
     FROM messages m
     JOIN users u ON u.id = m.to_user_id
     LEFT JOIN crops c ON c.id = m.crop_id
     WHERE m.from_user_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

// Mark as read
async function markAsRead(messageId) {
  const { rows } = await query(
    `UPDATE messages SET is_read = true, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [messageId]
  );
  return rows[0];
}

// Get unread count for a user
async function getUnreadCount(userId) {
  const { rows } = await query(
    `SELECT COUNT(*) as count FROM messages WHERE to_user_id = $1 AND is_read = false`,
    [userId]
  );
  return parseInt(rows[0]?.count || 0, 10);
}

module.exports = { create, findById, getInbox, getSent, markAsRead, getUnreadCount };
