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

// Use after authenticate: requireRole('ADMIN'), requireRole('PROFESSIONAL', 'ADMIN'), ...
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
