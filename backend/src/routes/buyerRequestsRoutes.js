'use strict';

const express = require('express');
const router = express.Router();
const buyerRequestController = require('../controllers/buyerRequestController');

router.post('/', buyerRequestController.createBuyerRequest);
router.get('/', buyerRequestController.listBuyerRequests);
router.get('/matches/:buyerId', buyerRequestController.getMatchesForBuyer);

module.exports = router;
