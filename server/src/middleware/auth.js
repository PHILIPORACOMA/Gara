import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';

// Verifies the Bearer token and loads the user, so a deleted user or a changed role takes
// effect immediately. Sets req.user = { id, role, name, email }.
export async function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(ApiError.unauthorized());

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return next(ApiError.unauthorized('Your session has expired. Please log in again.'));
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!user) return next(ApiError.unauthorized('Your session is no longer valid. Please log in again.'));

  req.user = user;
  next();
}

// For public routes that behave the same for everyone but want to know who is asking when a
// valid token is sent (e.g. to attribute a profile view). Never fails: a missing, expired or
// bad token just means an anonymous visitor.
export async function optionalAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      req.user = await prisma.user.findUnique({
        where: { id: Number(payload.sub) },
        select: { id: true, role: true, name: true, email: true },
      });
    } catch {
      req.user = null;
    }
  }
  next();
}

// Use after authenticate: requireRole('ADMIN'), requireRole('PROFESSIONAL', 'ADMIN'), ...
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
