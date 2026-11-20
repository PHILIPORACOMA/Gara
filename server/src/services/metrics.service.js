import { DateTime } from 'luxon';
import { prisma } from '../lib/prisma.js';
import { TIMEZONE } from '../config/constants.js';
import { manilaMonthRange } from '../utils/time.js';

// numerator / denominator, or null when there is nothing to measure yet.
export const rate = (numerator, denominator) => (denominator > 0 ? numerator / denominator : null);

const round = (n, places = 1) => (n == null ? null : Math.round(n * 10 ** places) / 10 ** places);
const num = (d) => Number(d ?? 0);

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// The admin dashboard numbers. Definitions (also shown as hints in the UI):
//  - active pro: verified, with a booking in the last 30 days that got past the deposit check
//  - deposit conversion: booking requests whose deposit was verified. Requests still inside
//    their unpaid hold are left out, because they have not had a chance to pay yet.
//  - no-show rate: no-shows / (completed + no-shows)
//  - cancellation rate: bookings cancelled or declined after a deposit was sent / all that sent one
//  - repeat-booking rate: customers with 2+ completed bookings / customers with 1+
export async function getMetrics({ now = new Date() } = {}) {
  const { start: monthStart, end: monthEnd } = manilaMonthRange(DateTime.fromJSDate(now, { zone: TIMEZONE }));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600_000);

  const [
    verifiedPros,
    activeProRows,
    completedThisMonth,
    totalBookings,
    openUnpaid,
    depositVerified,
    byStatus,
    paidDepositBookings,
    cancelledAfterDeposit,
    ratingAgg,
    completedByCustomer,
    commissionAgg,
    completedValueAgg,
    everConfirmed,
    occasionGross,
    totalGross,
    responseRows,
  ] = await Promise.all([
    prisma.professionalProfile.count({ where: { verificationStatus: 'APPROVED' } }),
    prisma.booking.groupBy({
      by: ['professionalId'],
      where: {
        professional: { verificationStatus: 'APPROVED' },
        status: { in: ['DEPOSIT_VERIFIED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
        startAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.booking.count({ where: { status: 'COMPLETED', completedAt: { gte: monthStart, lt: monthEnd } } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: 'PENDING_DEPOSIT', holdExpiresAt: { gt: now } } }),
    prisma.booking.count({ where: { depositVerifiedAt: { not: null } } }),
    prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.booking.count({ where: { depositSubmittedAt: { not: null } } }),
    prisma.booking.count({ where: { status: { in: ['CANCELLED', 'DECLINED'] }, depositSubmittedAt: { not: null } } }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.booking.groupBy({ by: ['customerId'], where: { status: 'COMPLETED' }, _count: { _all: true } }),
    // "This month" means the month the appointment was completed in.
    prisma.bookingEarning.aggregate({
      where: { booking: { completedAt: { gte: monthStart, lt: monthEnd } } },
      _sum: { commissionAmount: true },
      _count: { _all: true },
    }),
    prisma.booking.aggregate({ where: { status: 'COMPLETED' }, _avg: { total: true } }),
    prisma.booking.count({ where: { status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] } } }),
    prisma.booking.aggregate({ where: { status: 'COMPLETED', occasion: { not: null } }, _sum: { subtotal: true } }),
    prisma.booking.aggregate({ where: { status: 'COMPLETED' }, _sum: { subtotal: true } }),
    prisma.booking.findMany({
      where: { depositVerifiedAt: { not: null }, respondedAt: { not: null } },
      select: { depositVerifiedAt: true, respondedAt: true },
      orderBy: { respondedAt: 'desc' },
      take: 500,
    }),
  ]);

  const count = (status) => byStatus.find((g) => g.status === status)?._count._all ?? 0;
  const completed = count('COMPLETED');
  const noShows = count('NO_SHOW');
  const declined = count('DECLINED');
  const requests = totalBookings - openUnpaid;
  const customers = completedByCustomer.length;
  const repeatCustomers = completedByCustomer.filter((c) => c._count._all >= 2).length;
  // Bookings that have run their course after a deposit was sent. (cancelledAfterDeposit
  // already includes the ones the pro declined.)
  const ended = completed + noShows + cancelledAfterDeposit;

  return {
    generatedAt: now,
    monthStart,
    verifiedPros: { total: verifiedPros, active: activeProRows.length },
    completedThisMonth,
    depositConversion: { requests, verified: depositVerified, rate: round(rate(depositVerified, requests), 3) },
    noShow: { noShows, settled: completed + noShows, rate: round(rate(noShows, completed + noShows), 3) },
    cancellation: { cancelled: cancelledAfterDeposit, base: paidDepositBookings, rate: round(rate(cancelledAfterDeposit, paidDepositBookings), 3) },
    rating: { average: ratingAgg._avg.rating == null ? null : round(ratingAgg._avg.rating, 2), count: ratingAgg._count._all },
    repeat: { repeatCustomers, customers, rate: round(rate(repeatCustomers, customers), 3) },
    commissionThisMonth: { amount: round(num(commissionAgg._sum.commissionAmount), 2), bookings: commissionAgg._count._all },
    extras: {
      completionRate: round(rate(completed, ended), 3),
      requestToConfirmedRate: round(rate(everConfirmed, requests), 3),
      avgBookingValue: completed ? round(num(completedValueAgg._avg.total), 2) : null,
      medianResponseHours: round(median(responseRows.map((r) => (r.respondedAt - r.depositVerifiedAt) / 3600_000)), 1),
      occasionShare: round(rate(num(occasionGross._sum.subtotal), num(totalGross._sum.subtotal)), 3),
      declinedBookings: declined,
    },
  };
}
