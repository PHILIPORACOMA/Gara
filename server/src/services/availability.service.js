import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { dbDateToIsoDate, isoDateToDbDate, nowManila } from '../utils/time.js';
import { requireProfile } from './professional.service.js';

const serializeRule = (r) => ({ id: r.id, dayOfWeek: r.dayOfWeek, startMin: r.startMin, endMin: r.endMin });
const serializeBlocked = (b) => ({ id: b.id, date: dbDateToIsoDate(b.date), reason: b.reason });

export async function getAvailability(userId) {
  const profile = await requireProfile(userId);
  const rules = await prisma.availabilityRule.findMany({
    where: { professionalId: profile.id },
    orderBy: [{ dayOfWeek: 'asc' }, { startMin: 'asc' }],
  });
  return rules.map(serializeRule);
}

// Replaces the whole weekly schedule (the editor always sends the full week).
export async function replaceAvailability(userId, rules) {
  const profile = await requireProfile(userId);
  await prisma.$transaction([
    prisma.availabilityRule.deleteMany({ where: { professionalId: profile.id } }),
    prisma.availabilityRule.createMany({
      data: rules.map((r) => ({ professionalId: profile.id, dayOfWeek: r.dayOfWeek, startMin: r.startMin, endMin: r.endMin })),
    }),
  ]);
  return getAvailability(userId);
}

export async function listBlockedDates(userId) {
  const profile = await requireProfile(userId);
  const today = isoDateToDbDate(nowManila().toISODate());
  const blocked = await prisma.blockedDate.findMany({
    where: { professionalId: profile.id, date: { gte: today } },
    orderBy: { date: 'asc' },
  });
  return blocked.map(serializeBlocked);
}

export async function addBlockedDate(userId, { date, reason }) {
  const profile = await requireProfile(userId);
  const dbDate = isoDateToDbDate(date);
  const existing = await prisma.blockedDate.findUnique({
    where: { professionalId_date: { professionalId: profile.id, date: dbDate } },
  });
  if (existing) throw ApiError.conflict('That date is already blocked', 'ALREADY_BLOCKED');
  const created = await prisma.blockedDate.create({
    data: { professionalId: profile.id, date: dbDate, reason: reason ?? null },
  });
  return serializeBlocked(created);
}

export async function removeBlockedDate(userId, blockedId) {
  const profile = await requireProfile(userId);
  const result = await prisma.blockedDate.deleteMany({ where: { id: blockedId, professionalId: profile.id } });
  if (result.count === 0) throw ApiError.notFound('Blocked date not found');
}
