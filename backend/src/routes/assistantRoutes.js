'use strict';

const router = require('express').Router();
const { body } = require('express-validator');

const { chat } = require('../controllers/assistantController');
const validate = require('../middleware/validate');

router.post(
  '/chat',
  [
    body('message').optional({ values: 'falsy' }).isString().trim().isLength({ min: 1, max: 2000 }),
    body('cropName').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }),
    body('district').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }),
    body('market').optional({ values: 'falsy' }).isString().trim().isLength({ max: 150 }),
    body('buyerOffer').optional({ values: 'falsy' }).isNumeric(),
    body('quantityKg').optional({ values: 'falsy' }).isNumeric(),
    body('pickupLat').optional({ values: 'falsy' }).isNumeric(),
    body('pickupLon').optional({ values: 'falsy' }).isNumeric(),
    body('dropLat').optional({ values: 'falsy' }).isNumeric(),
    body('dropLon').optional({ values: 'falsy' }).isNumeric(),
    body('horizonDays').optional({ values: 'falsy' }).isInt({ min: 1, max: 5 }),
  ],
  validate,
  chat
);

module.exports = router;