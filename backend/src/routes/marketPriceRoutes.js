'use strict';

const router = require('express').Router();
const { listPrices, liveMandi } = require('../controllers/marketPriceController');

// Public — judges/buyers can browse latest mandi prices.
router.get('/', listPrices);
router.get('/live', liveMandi);

module.exports = router;
