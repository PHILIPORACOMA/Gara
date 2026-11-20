import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';

const SALT_ROUNDS = 10;
// Compared against when the email is unknown, so login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync('gara-dummy-password', SALT_ROUNDS);

const userInclude = { professionalProfile: { select: { id: true, verificationStatus: true } } };

export function signToken(user) {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

// The only user shape the API ever returns (never the password hash).
export function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    professional: user.professionalProfile
      ? { id: user.professionalProfile.id, verificationStatus: user.professionalProfile.verificationStatus }
      : null,
  };
}

export async function register({ name, email, password, phone, role }) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      phone: phone ?? null,
      role,
      // A professional starts with an empty, UNSUBMITTED profile (completed in onboarding).
      ...(role === 'PROFESSIONAL' && { professionalProfile: { create: { displayName: name } } }),
    },
    include: userInclude,
  });

  return { token: signToken(user), user: serializeUser(user) };
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email }, include: userInclude });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  }
  return { token: signToken(user), user: serializeUser(user) };
}

export async function getMe(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  if (!user) throw ApiError.unauthorized();
  return serializeUser(user);
}
