'use strict';

const messageModel = require('../models/messageModel');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Send a message to another user
const sendMessage = asyncHandler(async (req, res) => {
  const { toUserId, cropId, subject, body } = req.body;
  if (!toUserId || !body) {
    throw ApiError.badRequest('toUserId and body are required');
  }

  const msg = await messageModel.create({
    fromUserId: req.user.id,
    toUserId: parseInt(toUserId, 10),
    cropId: cropId ? parseInt(cropId, 10) : null,
    subject: subject || null,
    body,
  });
  res.status(201).json({ data: msg });
});

// Get inbox (messages sent TO me)
const getInbox = asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const messages = await messageModel.getInbox(
    req.user.id,
    Math.min(parseInt(limit, 10), 100),
    parseInt(offset, 10)
  );
  res.json({ data: messages, count: messages.length });
});

// Get sent messages (messages I sent)
const getSent = asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const messages = await messageModel.getSent(
    req.user.id,
    Math.min(parseInt(limit, 10), 100),
    parseInt(offset, 10)
  );
  res.json({ data: messages, count: messages.length });
});

// Mark message as read
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const msg = await messageModel.findById(parseInt(id, 10));
  if (!msg) throw ApiError.notFound('Message not found');

  // Only the recipient can mark as read
  if (msg.to_user_id !== req.user.id) {
    throw ApiError.forbidden('Can only mark your own messages as read');
  }

  const updated = await messageModel.markAsRead(parseInt(id, 10));
  res.json({ data: updated });
});

// Get unread count
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await messageModel.getUnreadCount(req.user.id);
  res.json({ unreadCount: count });
});

module.exports = { sendMessage, getInbox, getSent, markAsRead, getUnreadCount };
