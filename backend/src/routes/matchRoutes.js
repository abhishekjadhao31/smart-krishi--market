'use strict';

const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');

router.post('/search', matchController.searchMatches);

module.exports = router;
