'use strict';

const env = require('../config/env');

function notFound(req, res, _next) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const payload = {
    error: err.message || 'Internal server error',
  };
  if (err.details) payload.details = err.details;
  if (env.NODE_ENV !== 'production' && status >= 500) {
    payload.stack = err.stack;
  }
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }
  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
