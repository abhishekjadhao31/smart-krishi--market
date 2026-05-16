'use strict';

const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Run after a chain of express-validator checks; converts failures into 400s.
function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array().map((e) => ({
    field: e.path || e.param,
    message: e.msg,
  }));
  return next(ApiError.badRequest('Validation failed', details));
}

module.exports = validate;
