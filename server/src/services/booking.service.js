import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { formatManila, toManilaIsoDate } from '../utils/time.js';
import { assertTransition, CUSTOMER_TABS } from './bookingStatus.js';
import { bookingInclude, serializeBooking } from './bookingSerializer.js';
import { calculatePricing } from './pricing.js';
import { computeSlots, findConflict } from './slots.js';
import { assertBookableDate, loadDayContext } from './slots.service.js';
import { createNotification } from './notification.service.js';
import { getSettings } from './settings.service.js';

// A customer may have at most this many unpaid bookings holding slots at once, so nobody can
// block a professional's calendar by creating bookings they never pay for.
export const MAX_UNPAID_BOOKINGS = 3;

// ------------------------------------------------------------------ shared helpers

export async function notifyAdmins(client, payload) {
  const admins = await client.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  await Promise.all(admins.map((a) => createNotification({ ...payload, userId: a.id }, client)));
}

// Serialise bookings for one professional's calendar: concurrent attempts to book the same
// pro queue up on this row lock, so the conflict check below can never be raced.
export function lockProfessional(tx, professionalId) {
  return tx.$queryRaw`SELECT id FROM professional_profiles WHERE id = ${professionalId} FOR UPDATE`;
}

// Loads the pro and the chosen services and checks they can be booked in this mode.
async function loadSelection(client, { professionalId, serviceIds, mode }) {
  const profile = await client.professionalProfile.findFirst({
    where: { id: professionalId, verificationStatus: 'APPROVED' },
    include: {
      areas: { select: { area: true } },
      services: { where: { isActive: true, id: { in: serviceIds } } },
    },
  });
  if (!profile) throw ApiError.notFound('Professional not found');

  if (mode === 'HOME' && profile.serviceMode === 'STORE') {
    throw ApiError.unprocessable('This professional does not offer home service.', 'MODE_NOT_OFFERED');
  }
  if (mode === 'STORE' && profile.serviceMode === 'HOME') {
    throw ApiError.unprocessable('This professional does not offer in-store service.', 'MODE_NOT_OFFERED');
  }

  // Keep the order the customer picked them in.
  const services = serviceIds.map((id) => profile.services.find((s) => s.id === id)).filter(Boolean);
  if (services.length !== serviceIds.length) {
    throw ApiError.unprocessable('One or more services are not available from this professional.', 'INVALID_SERVICES');
  }
  return { profile, services, durationMin: services.reduce((sum, s) => sum + s.durationMin, 0) };
}

// ------------------------------------------------------------------ quote

// The price breakdown shown BEFORE the customer confirms.
export async function quoteBooking({ professionalId, serviceIds, mode }) {
  const { profile, services, durationMin } = await loadSelection(prisma, { professionalId, serviceIds, mode });
  const settings = await getSettings();
  return {
    professionalId,
    mode,
    durationMin,
    items: services.map((s) => ({ id: s.id, name: s.name, category: s.category, price: Number(s.price), durationMin: s.durationMin })),
    pricing: calculatePricing({
      servicePrices: services.map((s) => s.price),
      travelFee: profile.travelFee,
      mode,
      depositPct: settings.depositPct,
    }),
    areas: profile.areas.map((a) => a.area),
    holdMinutes: settings.holdMinutes,
  };
}

// ------------------------------------------------------------------ create

export async function createBooking(customerId, input, { now = new Date() } = {}) {
  const { professionalId, serviceIds, mode, address, area, occasion, notes } = input;
  const startAt = new Date(input.startAt);

  const booking = await prisma.$transaction(
    async (tx) => {
      // 1. Take the lock on this professional's calendar first.
      await lockProfessional(tx, professionalId);

      const { profile, services, durationMin } = await loadSelection(tx, { professionalId, serviceIds, mode });
      if (mode === 'HOME' && !profile.areas.some((a) => a.area === area)) {
        throw ApiError.validation([{ field: 'area', message: 'This professional does not serve that area' }]);
      }

      const endAt = new Date(startAt.getTime() + durationMin * 60_000);
      const isoDate = toManilaIsoDate(startAt);
      assertBookableDate(isoDate);

      const unpaid = await tx.booking.count({
        where: { customerId, status: 'PENDING_DEPOSIT', holdExpiresAt: { gt: now } },
      });
      if (unpaid >= MAX_UNPAID_BOOKINGS) {
        throw ApiError.unprocessable(
          `You already have ${MAX_UNPAID_BOOKINGS} bookings waiting for a deposit. Pay or cancel one before booking another.`,
          'TOO_MANY_UNPAID',
        );
      }

      // 2. Re-check availability inside the lock. Nothing the client sent is trusted:
      //    the slot must still be free AND be one the pro actually offers.
      const day = (await loadDayContext([professionalId], isoDate, tx)).get(professionalId);
      if (findConflict(day.bookings, startAt, endAt, now)) {
        throw ApiError.conflict('That time was just taken. Please choose another slot.', 'SLOT_TAKEN');
      }
      const offered = computeSlots({ isoDate, durationMin, now, ...day });
      if (!offered.some((s) => s.startAt.getTime() === startAt.getTime())) {
        throw ApiError.unprocessable('That time is not available. Please choose another slot.', 'INVALID_SLOT');
      }

      // 3. Price snapshot from the current settings and the pro's current prices.
      const settings = await getSettings(tx);
      const pricing = calculatePricing({
        servicePrices: services.map((s) => s.price),
        travelFee: profile.travelFee,
        mode,
        depositPct: settings.depositPct,
      });

      return tx.booking.create({
        data: {
          customerId,
          professionalId,
          mode,
          address: mode === 'HOME' ? address : null,
          area: mode === 'HOME' ? area : null,
          occasion: occasion ?? null,
          notes: notes ?? null,
          startAt,
          endAt,
          status: 'PENDING_DEPOSIT',
          subtotal: pricing.subtotal,
          travelFee: pricing.travelFee,
          total: pricing.total,
          depositPct: pricing.depositPct,
          depositAmount: pricing.depositAmount,
          balanceDue: pricing.balanceDue,
          commissionPct: settings.commissionPct,
          holdExpiresAt: new Date(now.getTime() + settings.holdMinutes * 60_000),
          items: {
            create: services.map((s, i) => ({
              serviceId: s.id,
              name: s.name,
              category: s.category,
              price: s.price,
              durationMin: s.durationMin,
              sortOrder: i,
            })),
          },
        },
        include: bookingInclude,
      });
    },
    { isolationLevel: 'ReadCommitted', timeout: 15_000 },
  );

  return serializeBooking(booking, 'CUSTOMER', now);
}

// ------------------------------------------------------------------ deposit

// The customer paid the deposit by GCash and sends the reference number and a screenshot.
// An admin verifies it next. `file` is the screenshot multer already saved.
export async function submitDeposit(customerId, bookingId, { gcashRef }, file, { now = new Date() } = {}) {
  if (!file) throw ApiError.validation([{ field: 'screenshot', message: 'Upload a screenshot of your GCash payment' }]);

  const result = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.booking.findFirst({ where: { id: bookingId, customerId } });
      if (!existing) throw ApiError.notFound('Booking not found');
      assertTransition(existing.status, 'DEPOSIT_SUBMITTED');

      // The unpaid hold ran out. Pay late only if nobody took the slot in the meantime.
      if (existing.holdExpiresAt && existing.holdExpiresAt <= now) {
        await lockProfessional(tx, existing.professionalId);
        const day = (await loadDayContext([existing.professionalId], toManilaIsoDate(existing.startAt), tx)).get(existing.professionalId);
        if (findConflict(day.bookings, existing.startAt, existing.endAt, now)) {
          await tx.booking.update({
            where: { id: bookingId },
            data: { status: 'CANCELLED', cancelledAt: now, holdExpiresAt: null },
          });
          return { slotLost: true };
        }
      }

      const clash = await tx.booking.findFirst({ where: { gcashRef, id: { not: bookingId } }, select: { id: true } });
      if (clash) {
        throw ApiError.conflict('This reference number was already used for another booking.', 'REF_ALREADY_USED', [
          { field: 'gcashRef', message: 'This reference number was already used for another booking' },
        ]);
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'DEPOSIT_SUBMITTED',
          gcashRef,
          depositScreenshotPath: `deposit/${file.filename}`,
          depositSubmittedAt: now,
          depositRejectNote: null,
          holdExpiresAt: null,
        },
        include: bookingInclude,
      });

      await notifyAdmins(tx, {
        type: 'DEPOSIT_SUBMITTED',
        title: 'Deposit to verify',
        body: `${updated.customer.name} sent ₱${Number(updated.depositAmount).toLocaleString('en-PH')} (ref ${gcashRef}) for booking #${updated.id} with ${updated.professional.displayName}.`,
        bookingId: updated.id,
      });

      return { booking: updated };
    },
    { isolationLevel: 'ReadCommitted', timeout: 15_000 },
  );

  if (result.slotLost) {
    throw ApiError.conflict(
      'Your 2-hour hold expired and the time was booked by someone else. Nothing was charged by Gara; please choose another time.',
      'SLOT_TAKEN',
    );
  }
  return serializeBooking(result.booking, 'CUSTOMER', now);
}

// ------------------------------------------------------------------ cancel

export async function cancelBooking(customerId, bookingId, { now = new Date() } = {}) {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findFirst({ where: { id: bookingId, customerId } });
    if (!existing) throw ApiError.notFound('Booking not found');
    assertTransition(existing.status, 'CANCELLED');
    if (now >= existing.startAt) {
      throw ApiError.unprocessable('The appointment has already started, so it can no longer be cancelled.', 'ALREADY_STARTED');
    }

    const booking = await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED', cancelledAt: now, cancelledById: customerId, holdExpiresAt: null },
      include: bookingInclude,
    });

    const when = formatManila(booking.startAt);
    // The pro only knows about a booking once its deposit is verified.
    if (['DEPOSIT_VERIFIED', 'CONFIRMED'].includes(existing.status)) {
      await createNotification(
        {
          userId: booking.professional.userId,
          type: 'BOOKING_CANCELLED',
          title: 'Booking cancelled',
          body: `${booking.customer.name} cancelled the appointment on ${when}.`,
          bookingId: booking.id,
        },
        tx,
      );
    }
    // If a deposit was already sent, the admin settles it by hand.
    if (existing.depositSubmittedAt) {
      await notifyAdmins(tx, {
        type: 'BOOKING_CANCELLED',
        title: 'Cancelled booking with a deposit',
        body: `Booking #${booking.id} (${booking.customer.name}, ${when}) was cancelled after a deposit was sent. Settle the deposit manually.`,
        bookingId: booking.id,
      });
    }
    return booking;
  });

  return serializeBooking(updated, 'CUSTOMER', now);
}

// ------------------------------------------------------------------ reading

export function tabCounts(grouped, tabs) {
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  const counts = Object.fromEntries(
    Object.entries(tabs).map(([tab, statuses]) => [tab, statuses.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0)]),
  );
  counts.all = Object.values(byStatus).reduce((a, b) => a + b, 0);
  return counts;
}

export async function listCustomerBookings(customerId, tab, { now = new Date() } = {}) {
  const statuses = tab === 'all' ? null : CUSTOMER_TABS[tab];
  const [rows, grouped] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId, ...(statuses && { status: { in: statuses } }) },
      include: bookingInclude,
      orderBy: { startAt: ['completed', 'cancelled', 'all'].includes(tab) ? 'desc' : 'asc' },
    }),
    prisma.booking.groupBy({ by: ['status'], where: { customerId }, _count: { _all: true } }),
  ]);
  return { bookings: rows.map((b) => serializeBooking(b, 'CUSTOMER', now)), counts: tabCounts(grouped, CUSTOMER_TABS) };
}

// One booking, for its customer, its professional, or an admin. Anyone else gets a 404 so
// booking ids cannot be probed.
export async function getBookingForViewer(viewer, bookingId, { now = new Date() } = {}) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  const allowed =
    booking &&
    (viewer.role === 'ADMIN' ||
      (viewer.role === 'CUSTOMER' && booking.customerId === viewer.id) ||
      (viewer.role === 'PROFESSIONAL' && booking.professional.userId === viewer.id));
  if (!allowed) throw ApiError.notFound('Booking not found');
  return serializeBooking(booking, viewer.role, now);
}
