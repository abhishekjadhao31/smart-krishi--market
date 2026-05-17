'use strict';

const router = require('express').Router();

const authRoutes = require('./authRoutes');
const cropRoutes = require('./cropRoutes');
const marketPriceRoutes = require('./marketPriceRoutes');
const predictionRoutes = require('./predictionRoutes');
const buyerRoutes = require('./buyerRoutes');
const messageRoutes = require('./messageRoutes');
const buyerRequestsRoutes = require('./buyerRequestsRoutes');
const conversationRoutes = require('./conversationRoutes');
const conversationController = require('../controllers/conversationController');
const logisticsRoutes = require('./logisticsRoutes');
const dataRoutes = require('./dataRoutes');
const assistantRoutes = require('./assistantRoutes');
const negotiationRoutes = require('./negotiationRoutes');
const matchRoutes = require('./matchRoutes');
const { requireAuth } = require('../middleware/auth');

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/crops', cropRoutes);
router.use('/market-prices', marketPriceRoutes);
router.use('/predict', predictionRoutes);
router.use('/messages', messageRoutes);
router.use('/conversations', conversationRoutes);
router.get('/my-conversations', requireAuth, conversationController.listMyConversations);
// Buyer routes intentionally mount at the API root so they can register
// both /buyers (plural list) and /buyer/search (singular action).
router.use('/', buyerRoutes);
// Buyer requests and matching
router.use('/buyer-requests', buyerRequestsRoutes);
// Logistics and transport
router.use('/logistics', logisticsRoutes);
router.use('/data', dataRoutes);
router.use('/assistant', assistantRoutes);
router.use('/negotiations', negotiationRoutes);
// Matching search API
router.use('/match', matchRoutes);

module.exports = router;
