'use strict';

const express = require('express');
const router = express.Router();
const negotiationController = require('../controllers/negotiationController');

router.post('/', negotiationController.createNegotiation);
router.get('/user/:userId', negotiationController.listNegotiationsForUser);
router.post('/:id/respond', negotiationController.respondToNegotiation);

module.exports = router;
