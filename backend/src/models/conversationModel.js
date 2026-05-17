'use strict';

const { pool, query } = require('../config/db');

async function findCrop(listingId) {
  const { rows } = await query(
    `SELECT id, farmer_id, crop_name FROM crops WHERE id = $1`,
    [listingId]
  );
  return rows[0] || null;
}

async function createConversation({ buyerId, farmerId, listingId, initialText }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO conversations (buyer_id, farmer_id, listing_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (buyer_id, farmer_id, listing_id)
       DO UPDATE SET updated_at = conversations.updated_at
       RETURNING *`,
      [buyerId, farmerId, listingId]
    );
    const conversation = rows[0];

    if (initialText) {
      await client.query(
        `INSERT INTO messages
          (conversation_id, sender_id, text, from_user_id, to_user_id, crop_id, body)
         VALUES ($1, $2, $3, $4, $5, $6, $3)`,
        [conversation.id, buyerId, initialText, buyerId, farmerId, listingId]
      );

      await client.query(
        `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
        [conversation.id]
      );
    }

    await client.query('COMMIT');
    return conversation;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getConversationForUser(conversationId, userId) {
  const { rows } = await query(
    `SELECT c.*, crop.crop_name,
            buyer.name AS buyer_name,
            farmer.name AS farmer_name
       FROM conversations c
       JOIN users buyer ON buyer.id = c.buyer_id
       JOIN users farmer ON farmer.id = c.farmer_id
       LEFT JOIN crops crop ON crop.id = c.listing_id
      WHERE c.id = $1
        AND (c.buyer_id = $2 OR c.farmer_id = $2)`,
    [conversationId, userId]
  );
  return rows[0] || null;
}

async function listForUser(userId) {
  const { rows } = await query(
    `SELECT c.id,
            c.buyer_id,
            c.farmer_id,
            c.listing_id,
            c.created_at,
            c.updated_at,
            crop.crop_name,
            buyer.name AS buyer_name,
            farmer.name AS farmer_name,
            CASE WHEN c.buyer_id = $1 THEN farmer.id ELSE buyer.id END AS other_user_id,
            CASE WHEN c.buyer_id = $1 THEN farmer.name ELSE buyer.name END AS other_user_name,
            last_msg.text AS last_message,
            last_msg.created_at AS last_message_at,
            COALESCE(unread.count, 0)::int AS unread_count
       FROM conversations c
       JOIN users buyer ON buyer.id = c.buyer_id
       JOIN users farmer ON farmer.id = c.farmer_id
       LEFT JOIN crops crop ON crop.id = c.listing_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(m.text, m.body) AS text, m.created_at
           FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
       ) last_msg ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS count
           FROM messages m
          WHERE m.conversation_id = c.id
            AND m.sender_id <> $1
            AND m.is_read = FALSE
       ) unread ON TRUE
      WHERE c.buyer_id = $1 OR c.farmer_id = $1
      ORDER BY COALESCE(last_msg.created_at, c.updated_at) DESC`,
    [userId]
  );
  return rows;
}

async function getMessages(conversationId, userId) {
  await query(
    `UPDATE messages
        SET is_read = TRUE,
            updated_at = NOW()
      WHERE conversation_id = $1
        AND sender_id <> $2
        AND is_read = FALSE`,
    [conversationId, userId]
  );

  const { rows } = await query(
    `SELECT m.id,
            m.conversation_id,
            m.sender_id,
            sender.name AS sender_name,
            COALESCE(m.text, m.body) AS text,
            m.is_read,
            m.created_at
       FROM messages m
       JOIN users sender ON sender.id = COALESCE(m.sender_id, m.from_user_id)
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC`,
    [conversationId]
  );
  return rows;
}

async function createMessage({ conversation, senderId, text }) {
  const toUserId = senderId === conversation.buyer_id
    ? conversation.farmer_id
    : conversation.buyer_id;

  const { rows } = await query(
    `INSERT INTO messages
      (conversation_id, sender_id, text, from_user_id, to_user_id, crop_id, body)
     VALUES ($1, $2, $3, $2, $4, $5, $3)
     RETURNING id, conversation_id, sender_id, text, is_read, created_at`,
    [conversation.id, senderId, text, toUserId, conversation.listing_id]
  );

  await query(
    `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
    [conversation.id]
  );

  return rows[0];
}

module.exports = {
  findCrop,
  createConversation,
  getConversationForUser,
  listForUser,
  getMessages,
  createMessage,
};
