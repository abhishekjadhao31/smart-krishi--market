'use strict';

const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const { signToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const BCRYPT_ROUNDS = 10;

function publicUser(u) {
  if (!u) return null;
  // never leak password_hash
  // eslint-disable-next-line no-unused-vars
  const { password_hash, ...rest } = u;
  return rest;
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, state, district } = req.body;
  const existing = await userModel.findByEmail(email);

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = existing
    ? await userModel.updateByEmail(email, {
        name,
        phone,
        passwordHash,
        role,
        state,
        district,
      })
    : await userModel.create({
        name,
        email,
        phone,
        passwordHash,
        role,
        state,
        district,
      });

  if (!user) throw ApiError.badRequest('Could not save account');

  const token = signToken({ sub: user.id, role: user.role, email: user.email });
  res.status(201).json({ user: publicUser(user), token });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) throw ApiError.unauthorized('Invalid email or password');
  if (!user.password_hash || typeof user.password_hash !== 'string') {
    throw ApiError.unauthorized('Invalid email or password');
  }

  let ok = false;
  try {
    ok = await bcrypt.compare(password, user.password_hash);
  } catch (_err) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!ok) throw ApiError.unauthorized('Invalid email or password');

  const token = signToken({ sub: user.id, role: user.role, email: user.email });
  res.json({ user: publicUser(user), token });
});

const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ user });
});

module.exports = { register, login, me };
