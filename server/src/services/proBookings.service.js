import { prisma } from '../lib/prisma.js';
import { manilaMonthRange, manilaStartOfDay, nowManila } from '../utils/time.js';
import { PRO_TABS } from './bookingStatus.js';
import { bookingInclude, serializeBooking } from './bookingSerializer.js';
import { tabCounts } from './booking.service.js';
import { requireProfile } from './professional.service.js';

const num = (d) => Number(d ?? 0);

export async function listProBookings(proUserId, tab, { now = new Date() } = {}) {
  const profile = await requireProfile(proUserId);
  const statuses = tab === 'all' ? null : PRO_TABS[tab];
  const [rows, grouped] = await Promise.all([
    prisma.booking.findMany({
      where: { professionalId: profile.id, ...(statuses && { status: { in: statuses } }) },
      include: bookingInclude,
      orderBy: { startAt: ['completed', 'cancelled', 'all'].includes(tab) ? 'desc' : 'asc' },
    }),
    prisma.booking.groupBy({ by: ['status'], where: { professionalId: profile.id }, _count: { _all: true } }),
  ]);
  return { bookings: rows.map((b) => serializeBooking(b, 'PROFESSIONAL', now)), counts: tabCounts(grouped, PRO_TABS) };
}

// Bookings that matter for a month calendar (cancelled and declined ones are left out).
export async function getCalendar(proUserId, month, { now = new Date() } = {}) {
  const profile = await requireProfile(proUserId);
  const { start, end } = manilaMonthRange(manilaStartOfDay(`${month}-01`));
  const rows = await prisma.booking.findMany({
    where: {
      professionalId: profile.id,
      status: { in: ['DEPOSIT_VERIFIED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
      startAt: { gte: start, lt: end },
    },
    include: bookingInclude,
    orderBy: { startAt: 'asc' },
  });
  return { month, bookings: rows.map((b) => serializeBooking(b, 'PROFESSIONAL', now)) };
}

async function earningsTotals(professionalId, range) {
  const where = {
    booking: { professionalId, ...(range && { completedAt: { gte: range.start, lt: range.end } }) },
  };
  const agg = await prisma.bookingEarning.aggregate({
    where,
    _sum: { gross: true, commissionAmount: true, travelFee: true, proNet: true },
    _count: { _all: true },
  });
  return {
    completedBookings: agg._count._all,
    gross: num(agg._sum.gross),
    commission: num(agg._sum.commissionAmount),
    travelFees: num(agg._sum.travelFee),
    net: num(agg._sum.proNet),
  };
}

export async function getEarnings(proUserId, { page = 1, pageSize = 20 } = {}) {
  const profile = await requireProfile(proUserId);
  const where = { booking: { professionalId: profile.id } };
  const [allTime, thisMonth, total, rows] = await Promise.all([
    earningsTotals(profile.id),
    earningsTotals(profile.id, manilaMonthRange()),
    prisma.bookingEarning.count({ where }),
    prisma.bookingEarning.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { booking: { include: { customer: { select: { name: true } }, items: { orderBy: { sortOrder: 'asc' } } } } },
    }),
  ]);

  return {
    summary: { allTime, thisMonth },
    rows: rows.map((e) => ({
      id: e.id,
      bookingId: e.bookingId,
      completedAt: e.booking.completedAt ?? e.createdAt,
      startAt: e.booking.startAt,
      customerName: e.booking.customer.name,
      services: e.booking.items.map((i) => i.name),
      gross: num(e.gross),
      commissionPct: num(e.commissionPct),
      commissionAmount: num(e.commissionAmount),
      travelFee: num(e.travelFee),
      proNet: num(e.proNet),
    })),
    total,
    page,
    pageSize,
  };
}

export async function getDashboard(proUserId, { now = new Date() } = {}) {
  const profile = await requireProfile(proUserId);
  const [grouped, upcoming, thisMonth, allTime] = await Promise.all([
    prisma.booking.groupBy({ by: ['status'], where: { professionalId: profile.id }, _count: { _all: true } }),
    prisma.booking.findMany({
      where: { professionalId: profile.id, status: { in: ['DEPOSIT_VERIFIED', 'CONFIRMED'] }, endAt: { gte: now } },
      include: bookingInclude,
      orderBy: { startAt: 'asc' },
      take: 10,
    }),
    earningsTotals(profile.id, manilaMonthRange(nowManila())),
    earningsTotals(profile.id),
  ]);
  return {
    counts: tabCounts(grouped, PRO_TABS),
    upcoming: upcoming.map((b) => serializeBooking(b, 'PROFESSIONAL', now)),
    earnings: { thisMonth, allTime },
  };
}
