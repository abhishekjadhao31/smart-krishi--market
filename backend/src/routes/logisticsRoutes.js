'use strict';

const express = require('express');
const router = express.Router();
const logisticsController = require('../controllers/logisticsController');
const { requireAuth } = require('../middleware/auth');

router.post('/', logisticsController.createPartner);
router.get('/nearby', logisticsController.findNearby);
router.get('/locations/search', logisticsController.searchLocations);
router.get('/locations/reverse', logisticsController.reverseLocation);
router.post('/transport-bookings', requireAuth, logisticsController.createTransportBooking);
router.get('/transport-bookings', requireAuth, logisticsController.listTransportBookings);
router.get('/transport-bookings/:id', requireAuth, logisticsController.getTransportBooking);
router.get('/transport-bookings/:id/events', requireAuth, logisticsController.getTransportBookingEvents);
router.patch('/transport-bookings/:id/status', requireAuth, logisticsController.updateTransportBookingStatus);

module.exports = router;
