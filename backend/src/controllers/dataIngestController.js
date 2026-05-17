'use strict';

const ApiError = require('../utils/ApiError');
const path = require('path');
const asyncHandler = require('../utils/asyncHandler');

const uploadRawCsv = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('CSV file is required');
  }

  const dataset = String(req.params.dataset || '').trim().toLowerCase();
  const relativePath = path.relative(path.resolve(__dirname, '..', '..'), req.file.path).replace(/\\/g, '/');

  res.status(201).json({
    data: {
      dataset,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      storedAt: relativePath,
      sizeBytes: req.file.size,
      nextStep: dataset === 'mandi' ? 'Run npm run mandi:clean' : 'Run npm run weather:clean',
    },
  });
});

module.exports = {
  uploadRawCsv,
};