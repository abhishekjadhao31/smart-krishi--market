'use strict';

// Wraps async route handlers so thrown errors / rejections reach the error middleware.
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
