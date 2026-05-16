'use strict';

const router = require('express').Router();
const { body } = require('express-validator');

const { predict } = require('../controllers/predictionController');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.post(
  '/',
  requireAuth,
  [
    body('cropName').isString().trim().isLength({ min: 1, max: 100 }),
    body('state').optional({ values: 'falsy' }).isString(),
    body('district').optional({ values: 'falsy' }).isString(),
    body('market').optional({ values: 'falsy' }).isString(),
    body('quantityKg').optional().isFloat({ gt: 0 }),
    body('harvestDate').optional({ values: 'falsy' }).isISO8601(),
  ],
  validate,
  predict
);

module.exports = router;
