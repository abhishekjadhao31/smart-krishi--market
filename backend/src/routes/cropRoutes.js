'use strict';

const router = require('express').Router();
const { body, param } = require('express-validator');

const {
  listCrops,
  getCrop,
  createCrop,
  updateCrop,
  deleteCrop,
  myCrops,
} = require('../controllers/cropController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const validate = require('../middleware/validate');

// Public
router.get('/', listCrops);

// Authenticated farmer-only list of their own crops (must be defined before /:id)
router.get('/mine/list', requireAuth, requireRole('farmer'), myCrops);

router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  getCrop
);

// Farmer creates a listing with optional image upload
router.post(
  '/',
  requireAuth,
  requireRole('farmer'),
  upload.single('image'),
  [
    body('cropName').isString().trim().isLength({ min: 1, max: 100 }),
    body('quantityKg').isFloat({ gt: 0 }),
    body('pricePerKg').optional({ values: 'falsy' }).isFloat({ gt: 0 }),
    body('state').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
    body('district').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
    body('market').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
    body('harvestDate').optional({ values: 'falsy' }).isISO8601(),
    body('description').optional({ values: 'falsy' }).isString().isLength({ max: 2000 }),
  ],
  validate,
  createCrop
);

router.put(
  '/:id',
  requireAuth,
  requireRole('farmer', 'admin'),
  upload.single('image'),
  [
    param('id').isInt({ min: 1 }),
    body('cropName').optional().isString().trim().isLength({ min: 1, max: 100 }),
    body('quantityKg').optional().isFloat({ gt: 0 }),
    body('pricePerKg').optional().isFloat({ gt: 0 }),
    body('status').optional().isIn(['available', 'sold', 'hold']),
  ],
  validate,
  updateCrop
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('farmer', 'admin'),
  [param('id').isInt({ min: 1 })],
  validate,
  deleteCrop
);

module.exports = router;
