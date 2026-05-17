'use strict';

const router = require('express').Router();
const { body, param } = require('express-validator');

const conversationController = require('../controllers/conversationController');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.post(
  '/',
  requireAuth,
  [
    body('farmerId').optional({ values: 'falsy' }).isInt({ min: 1 }),
    body('listingId').optional({ values: 'falsy' }).isInt({ min: 1 }),
    body('text').optional({ values: 'falsy' }).isString().trim().isLength({ max: 5000 }),
    body('initialMessage').optional({ values: 'falsy' }).isString().trim().isLength({ max: 5000 }),
  ],
  validate,
  conversationController.createConversation
);

router.get(
  '/:id/messages',
  requireAuth,
  [param('id').isInt({ min: 1 })],
  validate,
  conversationController.getMessages
);

router.post(
  '/:id/messages',
  requireAuth,
  [
    param('id').isInt({ min: 1 }),
    body('text').isString().trim().isLength({ min: 1, max: 5000 }),
  ],
  validate,
  conversationController.sendMessage
);

module.exports = router;
