'use strict';

const router = require('express').Router();
const { body, query } = require('express-validator');

const { listBuyers, searchListings } = require('../controllers/buyerController');
const validate = require('../middleware/validate');

// GET /api/buyers — directory of registered buyers
router.get(
  '/buyers',
  [
    query('state').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
    query('district').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  validate,
  listBuyers
);

// POST /api/buyer/search — buyer-side search over crop listings
router.post(
  '/buyer/search',
  [
    body('crop').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
    body('location').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
    body('maxPrice')
      .optional({ values: 'falsy' })
      .isFloat({ gt: 0 })
      .withMessage('maxPrice must be a positive number'),
  ],
  validate,
  searchListings
);

module.exports = router;
