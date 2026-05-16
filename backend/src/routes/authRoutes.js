'use strict';

const router = require('express').Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const { register, login, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/register',
  authLimiter,
  [
    body('name').isString().trim().isLength({ min: 2, max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 6, max: 128 }),
    body('role').isIn(['farmer', 'buyer']),
    body('phone').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
    body('state').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
    body('district').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
  ],
  validate,
  register
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 6, max: 128 }),
  ],
  validate,
  login
);

router.get('/me', requireAuth, me);

module.exports = router;
