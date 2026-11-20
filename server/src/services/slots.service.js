import { prisma } from '../lib/prisma.js';
import { ACTIVE_BOOKING_STATUSES } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { isoDateToDbDate, manilaIsoWeekday, manilaStartOfDay, nowManila } from '../utils/time.js';
import { MAX_ADVANCE_DAYS, computeSlots } from './slots.js';

// Everything needed to compute one day's slots, for several pros at once (3 queries total).
// Returns Map(professionalId -> { windows, blocked, bookings }).
export async function loadDayContext(professionalIds, isoDate, client = prisma) {
  const dayStart = manilaStartOfDay(isoDate);
  const dayEnd = dayStart.plus({ days: 1 });

  const [rules, blocked, bookings] = await Promise.all([
    client.availabilityRule.findMany({
      where: { professionalId: { in: professionalIds }, dayOfWeek: manilaIsoWeekday(isoDate) },
      select: { professionalId: true, startMin: true, endMin: true },
    }),
    client.blockedDate.findMany({
      where: { professionalId: { in: professionalIds }, date: isoDateToDbDate(isoDate) },
      select: { professionalId: true },
    }),
    client.booking.findMany({
      where: {
        professionalId: { in: professionalIds },
        status: { in: ACTIVE_BOOKING_STATUSES },
        startAt: { lt: dayEnd.toJSDate() },
        endAt: { gt: dayStart.toJSDate() },
      },
      select: { professionalId: true, startAt: true, endAt: true, status: true, holdExpiresAt: true },
    }),
  ]);

  const context = new Map(professionalIds.map((id) => [id, { windows: [], blocked: false, bookings: [] }]));
  rules.forEach((r) => context.get(r.professionalId).windows.push({ startMin: r.startMin, endMin: r.endMin }));
  blocked.forEach((b) => (context.get(b.professionalId).blocked = true));
  bookings.forEach((b) => context.get(b.professionalId).bookings.push(b));
  return context;
}

// The date must be today or later (Manila) and within the booking horizon.
export function assertBookableDate(isoDate, now = nowManila()) {
  const today = now.startOf('day');
  const day = manilaStartOfDay(isoDate);
  if (day < today) throw ApiError.unprocessable('Choose today or a future date.', 'DATE_IN_PAST');
  if (day > today.plus({ days: MAX_ADVANCE_DAYS })) {
    throw ApiError.unprocessable(`You can book up to ${MAX_ADVANCE_DAYS} days ahead.`, 'DATE_TOO_FAR');
  }
}

export async function getSlots({ professionalId, isoDate, durationMin, now = new Date() }) {
  const context = await loadDayContext([professionalId], isoDate);
  return computeSlots({ isoDate, durationMin, now, ...context.get(professionalId) });
}

// For search: does this pro have at least one open slot that day for a service of this length?
export async function filterByDateAvailability(professionals, isoDate, now = new Date()) {
  if (!professionals.length) return [];
  const context = await loadDayContext(
    professionals.map((p) => p.id),
    isoDate,
  );
  return professionals.filter(
    (p) => computeSlots({ isoDate, durationMin: p.shortestDurationMin, now, ...context.get(p.id) }).length > 0,
  );
}
