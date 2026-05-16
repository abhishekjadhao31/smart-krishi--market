'use strict';

const router = require('express').Router();
const { listPrices } = require('../controllers/marketPriceController');

// Public — judges/buyers can browse latest mandi prices.
router.get('/', listPrices);

module.exports = router;
