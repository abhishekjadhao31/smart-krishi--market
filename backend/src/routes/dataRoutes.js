'use strict';

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { uploadCsv } = require('../middleware/csvUpload');
const { uploadRawCsv } = require('../controllers/dataIngestController');

router.post('/raw/:dataset', requireAuth, uploadCsv.single('file'), uploadRawCsv);

module.exports = router;