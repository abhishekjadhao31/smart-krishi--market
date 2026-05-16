'use strict';

const router = require('express').Router();
const { body, param } = require('express-validator');

const { sendMessage, getInbox, getSent, markAsRead, getUnreadCount } = require('../controllers/messageController');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Get inbox (messages sent to me)
router.get('/inbox', requireAuth, getInbox);

// Get sent messages (messages I sent)
router.get('/sent', requireAuth, getSent);

// Get unread message count
router.get('/unread-count', requireAuth, getUnreadCount);

// Send a message
router.post(
  '/',
  requireAuth,
  [
    body('toUserId').isInt({ min: 1 }),
    body('body').isString().trim().isLength({ min: 1, max: 5000 }),
    body('subject').optional({ values: 'falsy' }).isString().isLength({ max: 255 }),
    body('cropId').optional({ values: 'falsy' }).isInt({ min: 1 }),
  ],
  validate,
  sendMessage
);

// Mark message as read
router.put(
  '/:id/read',
  requireAuth,
  [param('id').isInt({ min: 1 })],
  validate,
  markAsRead
);

module.exports = router;
