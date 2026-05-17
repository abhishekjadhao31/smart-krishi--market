'use strict';

const conversationModel = require('../models/conversationModel');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

function cleanText(value) {
  return String(value || '').trim();
}

const createConversation = asyncHandler(async (req, res) => {
  const listingId = req.body.listingId ? parseInt(req.body.listingId, 10) : null;
  let farmerId = req.body.farmerId ? parseInt(req.body.farmerId, 10) : null;
  const initialText = cleanText(req.body.text || req.body.initialMessage);

  if (!listingId && !farmerId) {
    throw ApiError.badRequest('listingId or farmerId is required');
  }

  if (listingId) {
    const crop = await conversationModel.findCrop(listingId);
    if (!crop) throw ApiError.notFound('Listing not found');
    farmerId = crop.farmer_id;
  }

  if (req.user.role !== 'buyer') {
    throw ApiError.forbidden('Only buyers can start a farmer conversation');
  }
  if (farmerId === req.user.id) {
    throw ApiError.badRequest('Cannot start a conversation with yourself');
  }

  const conversation = await conversationModel.createConversation({
    buyerId: req.user.id,
    farmerId,
    listingId,
    initialText,
  });

  res.status(201).json({ data: conversation });
});

const listMyConversations = asyncHandler(async (req, res) => {
  const conversations = await conversationModel.listForUser(req.user.id);
  res.json({ data: conversations, count: conversations.length });
});

const getMessages = asyncHandler(async (req, res) => {
  const conversationId = parseInt(req.params.id, 10);
  const conversation = await conversationModel.getConversationForUser(conversationId, req.user.id);
  if (!conversation) throw ApiError.notFound('Conversation not found');

  const messages = await conversationModel.getMessages(conversationId, req.user.id);
  res.json({ data: messages, conversation });
});

const sendMessage = asyncHandler(async (req, res) => {
  const conversationId = parseInt(req.params.id, 10);
  const text = cleanText(req.body.text);
  if (!text) throw ApiError.badRequest('text is required');

  const conversation = await conversationModel.getConversationForUser(conversationId, req.user.id);
  if (!conversation) throw ApiError.notFound('Conversation not found');

  const message = await conversationModel.createMessage({
    conversation,
    senderId: req.user.id,
    text,
  });

  res.status(201).json({ data: message });
});

module.exports = {
  createConversation,
  listMyConversations,
  getMessages,
  sendMessage,
};
