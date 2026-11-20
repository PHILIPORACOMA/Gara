import { prisma } from '../lib/prisma.js';
import { manilaStartOfDay } from '../utils/time.js';
import { bookingInclude, serializeBooking } from './bookingSerializer.js';

// All bookings, filterable. `from` and `to` are Manila dates (inclusive) on the appointment day.
export async function listAdminBookings({ status, professionalId, from, to, refund, page, pageSize }, { now = new Date() } = {}) {
  const where = {
    ...(status && { status }),
    ...(professionalId && { professionalId }),
    ...((from || to) && {
      startAt: {
        ...(from && { gte: manilaStartOfDay(from).toJSDate() }),
        ...(to && { lt: manilaStartOfDay(to).plus({ days: 1 }).toJSDate() }),
      },
    }),
    ...(refund === 'needed' && { refundNeeded: true, refundResolvedAt: null }),
    ...(refund === 'resolved' && { refundNeeded: true, refundResolvedAt: { not: null } }),
  };

  const [total, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { bookings: rows.map((b) => serializeBooking(b, 'ADMIN', now)), total, page, pageSize };
}

// Refunds the admin still has to make.
export async function countRefundsNeeded() {
  return prisma.booking.count({ where: { refundNeeded: true, refundResolvedAt: null } });
}
