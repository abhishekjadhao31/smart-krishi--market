'use strict';

const cropModel = require('../models/cropModel');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

function buildImageUrl(req, file) {
  if (!file) return null;
  // Served by express.static at /uploads
  const host = `${req.protocol}://${req.get('host')}`;
  return `${host}/uploads/${file.filename}`;
}

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true', '1', 'yes', 'on'].includes(v.toLowerCase());
  return false;
}

const listCrops = asyncHandler(async (req, res) => {
  const { crop, state, limit, offset } = req.query;
  const rows = await cropModel.list({
    crop,
    state,
    limit: Math.min(parseInt(limit, 10) || 50, 100),
    offset: parseInt(offset, 10) || 0,
  });
  res.json({ data: rows, count: rows.length });
});

const getCrop = asyncHandler(async (req, res) => {
  const row = await cropModel.findById(req.params.id);
  if (!row) throw ApiError.notFound('Crop listing not found');
  res.json({ data: row });
});

const createCrop = asyncHandler(async (req, res) => {
  const {
    cropName,
    variety,
    quantityKg,
    pricePerKg,
    state,
    district,
    market,
    harvestDate,
    storageAvailable,
    description,
  } = req.body;

  const created = await cropModel.create({
    farmerId: req.user.id,
    cropName,
    variety,
    quantityKg: Number(quantityKg),
    pricePerKg: pricePerKg !== undefined ? Number(pricePerKg) : null,
    state,
    district,
    market,
    harvestDate: harvestDate || null,
    storageAvailable: parseBool(storageAvailable),
    description,
    imageUrl: buildImageUrl(req, req.file),
  });
  res.status(201).json({ data: created });
});

const updateCrop = asyncHandler(async (req, res) => {
  const existing = await cropModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Crop listing not found');
  if (existing.farmer_id !== req.user.id && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only modify your own listings');
  }

  const updates = { ...req.body };
  if (updates.quantityKg !== undefined) updates.quantityKg = Number(updates.quantityKg);
  if (updates.pricePerKg !== undefined) updates.pricePerKg = Number(updates.pricePerKg);
  if (updates.storageAvailable !== undefined) {
    updates.storageAvailable = parseBool(updates.storageAvailable);
  }
  if (req.file) {
    updates.imageUrl = buildImageUrl(req, req.file);
  }

  const updated = await cropModel.update(req.params.id, updates);
  res.json({ data: updated });
});

const deleteCrop = asyncHandler(async (req, res) => {
  const existing = await cropModel.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Crop listing not found');
  if (existing.farmer_id !== req.user.id && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only delete your own listings');
  }
  await cropModel.remove(req.params.id);
  res.status(204).end();
});

const myCrops = asyncHandler(async (req, res) => {
  const rows = await cropModel.findByFarmer(req.user.id);
  res.json({ data: rows, count: rows.length });
});

module.exports = {
  listCrops,
  getCrop,
  createCrop,
  updateCrop,
  deleteCrop,
  myCrops,
};
