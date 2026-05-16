'use strict';

const router = require('express').Router();

const authRoutes = require('./authRoutes');
const cropRoutes = require('./cropRoutes');
const marketPriceRoutes = require('./marketPriceRoutes');
const predictionRoutes = require('./predictionRoutes');
const buyerRoutes = require('./buyerRoutes');
const messageRoutes = require('./messageRoutes');
const buyerRequestsRoutes = require('./buyerRequestsRoutes');
const logisticsRoutes = require('./logisticsRoutes');

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/crops', cropRoutes);
router.use('/market-prices', marketPriceRoutes);
router.use('/predict', predictionRoutes);
router.use('/messages', messageRoutes);
// Buyer routes intentionally mount at the API root so they can register
// both /buyers (plural list) and /buyer/search (singular action).
router.use('/', buyerRoutes);
// Buyer requests and matching
router.use('/buyer-requests', buyerRequestsRoutes);
// Logistics and transport
router.use('/logistics', logisticsRoutes);

module.exports = router;
