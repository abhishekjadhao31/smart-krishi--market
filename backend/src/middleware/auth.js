'use strict';

const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

/**
 * Require a valid JWT. Attaches `req.user = { id, role, email }`.
 */
function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }
  try {
    const decoded = verifyToken(token);
    req.user = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
    };
    return next();
  } catch (err) {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
}

/**
 * Restrict a route to the given roles.
 * @param  {...('farmer'|'buyer'|'admin')} roles
 */
function requireRole(...roles) {
  return function (req, _res, next) {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
