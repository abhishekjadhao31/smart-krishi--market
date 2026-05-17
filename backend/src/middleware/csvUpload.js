'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const RAW_DATA_ROOT = path.resolve(ROOT_DIR, env.RAW_DATA_DIR);
const ALLOWED_DATASETS = new Set(['mandi', 'weather']);
const ALLOWED_MIME = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
]);

function resolveDatasetDir(dataset) {
  const key = String(dataset || '').trim().toLowerCase();
  if (!ALLOWED_DATASETS.has(key)) {
    throw ApiError.badRequest(`Unsupported dataset: ${dataset}`);
  }
  const target = path.resolve(RAW_DATA_ROOT, 'uploads', key);
  if (!target.startsWith(RAW_DATA_ROOT)) {
    throw ApiError.badRequest('Invalid upload path');
  }
  fs.mkdirSync(target, { recursive: true });
  return target;
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    try {
      const dataset = req.params.dataset || req.query.dataset || req.body.dataset;
      cb(null, resolveDatasetDir(dataset));
    } catch (err) {
      cb(err);
    }
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.csv';
    const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safe);
  },
});

function fileFilter(_req, file, cb) {
  const original = String(file.originalname || '').toLowerCase();
  if (!ALLOWED_MIME.has(file.mimetype) && !original.endsWith('.csv')) {
    return cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype || 'unknown'}`));
  }
  cb(null, true);
}

const uploadCsv = multer({
  storage,
  fileFilter,
  limits: { fileSize: Math.max(env.MAX_UPLOAD_SIZE_MB, 25) * 1024 * 1024 },
});

module.exports = { uploadCsv, resolveDatasetDir, RAW_DATA_ROOT };