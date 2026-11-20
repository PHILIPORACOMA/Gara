// Status changes made by the admin (deposit checks, refunds) and by the professional
// (accept, decline, complete, no-show). Every change goes through assertTransition().
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { privateDir, removeFileQuietly } from '../utils/files.js';
import { formatManila } from '../utils/time.js';
import { assertTransition } from './bookingStatus.js';
import { bookingInclude, canMarkComplete, serializeBooking } from './bookingSerializer.js';
import { notifyAdmins } from './booking.service.js';
import { calculateEarning } from './pricing.js';
import { createNotification } from './notification.service.js';
import { getSettings } from './settings.service.js';

const money = (n) => `₱${Number(n).toLocaleString('en-PH')}`;
const itemsText = (booking) => booking.items.map((i) => i.name).join(', ');

async function loadBooking(tx, where) {
  const booking = await tx.booking.findFirst({ where, include: bookingInclude });
  if (!booking) throw ApiError.notFound('Booking not found');
  return booking;
}

// ------------------------------------------------------------------ admin: deposits

export async function listDepositQueue({ now = new Date() } = {}) {
  const rows = await prisma.booking.findMany({
    where: { status: 'DEPOSIT_SUBMITTED' },
    include: bookingInclude,
    orderBy: [{ depositSubmittedAt: 'asc' }, { id: 'asc' }],
  });
  return rows.map((b) => serializeBooking(b, 'ADMIN', now));
}

// The admin checked the GCash payment: the booking moves on to the professional.
export async function verifyDeposit(adminId, bookingId, { now = new Date() } = {}) {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await loadBooking(tx, { id: bookingId });
    assertTransition(existing.status, 'DEPOSIT_VERIFIED');

    const booking = await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'DEPOSIT_VERIFIED', depositVerifiedAt: now, depositVerifiedById: adminId },
      include: bookingInclude,
    });

    await createNotification(
      {
        userId: booking.customerId,
        type: 'DEPOSIT_VERIFIED',
        title: 'Deposit verified',
        body: `Your ${money(booking.depositAmount)} deposit was verified. ${booking.professional.displayName} will confirm your booking soon.`,
        bookingId,
      },
      tx,
    );
    // Only now can the pro act on it, so this is when they hear about it.
    await createNotification(
      {
        userId: booking.professional.userId,
        type: 'BOOKING_REQUESTED',
        title: 'New booking request',
        body: `${booking.customer.name} booked ${itemsText(booking)} for ${formatManila(booking.startAt)}. Accept or decline it.`,
        bookingId,
      },
      tx,
    );
    return booking;
  });
  return serializeBooking(updated, 'ADMIN', now);
}

// The payment could not be matched. The customer gets the reason and a fresh hold to try again.
export async function rejectDeposit(adminId, bookingId, note, { now = new Date() } = {}) {
  const { booking: updated, oldScreenshot } = await prisma.$transaction(async (tx) => {
    const existing = await loadBooking(tx, { id: bookingId });
    assertTransition(existing.status, 'PENDING_DEPOSIT');
    const settings = await getSettings(tx);

    const booking = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'PENDING_DEPOSIT',
        depositRejectNote: note,
        gcashRef: null,
        depositScreenshotPath: null,
        depositSubmittedAt: null,
        holdExpiresAt: new Date(now.getTime() + settings.holdMinutes * 60_000),
      },
      include: bookingInclude,
    });

    await createNotification(
      {
        userId: booking.customerId,
        type: 'DEPOSIT_REJECTED',
        title: 'Deposit not verified',
        body: `We could not verify your deposit: ${note}. Please send the correct reference number and screenshot.`,
        bookingId,
      },
      tx,
    );
    return { booking, oldScreenshot: existing.depositScreenshotPath };
  });

  if (oldScreenshot) await removeFileQuietly(privateDir('deposit', path.basename(oldScreenshot)));
  return serializeBooking(updated, 'ADMIN', now);
}

// The admin has refunded (by hand, outside Gara) a booking the pro declined.
export async function resolveRefund(bookingId, { now = new Date() } = {}) {
  const existing = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!existing) throw ApiError.notFound('Booking not found');
  if (!existing.refundNeeded) throw ApiError.unprocessable('No refund is needed for this booking.', 'NO_REFUND_NEEDED');
  if (existing.refundResolvedAt) throw ApiError.unprocessable('This refund is already marked as done.', 'REFUND_ALREADY_RESOLVED');

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { refundResolvedAt: now },
    include: bookingInclude,
  });
  return serializeBooking(updated, 'ADMIN', now);
}

// ------------------------------------------------------------------ professional

// The booking must belong to the signed-in professional.
const ownedByPro = (userId, bookingId) => ({ id: bookingId, professional: { userId } });

export async function acceptBooking(proUserId, bookingId, { now = new Date() } = {}) {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await loadBooking(tx, ownedByPro(proUserId, bookingId));
    assertTransition(existing.status, 'CONFIRMED');

    const booking = await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED', respondedAt: now },
      include: bookingInclude,
    });
    await createNotification(
      {
        userId: booking.customerId,
        type: 'BOOKING_CONFIRMED',
        title: 'Booking confirmed',
        body: `${booking.professional.displayName} confirmed your appointment on ${formatManila(booking.startAt)}. Balance due on the day: ${money(booking.balanceDue)}.`,
        bookingId,
      },
      tx,
    );
    return booking;
  });
  return serializeBooking(updated, 'PROFESSIONAL', now);
}

// Declining after the deposit was verified means the customer is owed their money back:
// the booking is flagged "refund needed" for the admin.
export async function declineBooking(proUserId, bookingId, reason, { now = new Date() } = {}) {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await loadBooking(tx, ownedByPro(proUserId, bookingId));
    assertTransition(existing.status, 'DECLINED');

    const booking = await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'DECLINED', respondedAt: now, declineReason: reason ?? null, refundNeeded: true, holdExpiresAt: null },
      include: bookingInclude,
    });
    await createNotification(
      {
        userId: booking.customerId,
        type: 'BOOKING_DECLINED',
        title: 'Booking declined',
        body: `${booking.professional.displayName} could not take your booking${reason ? ` (${reason})` : ''}. Your ${money(booking.depositAmount)} deposit will be refunded.`,
        bookingId,
      },
      tx,
    );
    await notifyAdmins(tx, {
      type: 'REFUND_NEEDED',
      title: 'Refund needed',
      body: `${booking.professional.displayName} declined booking #${booking.id}. Refund ${money(booking.depositAmount)} to ${booking.customer.name} (ref ${booking.gcashRef ?? 'n/a'}).`,
      bookingId,
    });
    return booking;
  });
  return serializeBooking(updated, 'PROFESSIONAL', now);
}

function assertAppointmentHappened(booking, now) {
  if (!canMarkComplete(booking, now)) {
    throw ApiError.unprocessable('You can mark this booking after the appointment has started.', 'TOO_EARLY');
  }
}

// COMPLETED records the money: gross (services only), Gara's commission, and the pro's net.
// The travel fee is never commissioned.
export async function completeBooking(proUserId, bookingId, { now = new Date() } = {}) {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await loadBooking(tx, ownedByPro(proUserId, bookingId));
    assertTransition(existing.status, 'COMPLETED');
    assertAppointmentHappened(existing, now);

    // The commission rate was snapshotted when the booking was made, so later changes to the
    // setting never rewrite agreed bookings.
    const earning = calculateEarning({
      subtotal: existing.subtotal,
      travelFee: existing.travelFee,
      commissionPct: existing.commissionPct,
    });
    await tx.bookingEarning.create({ data: { bookingId, ...earning } });

    const booking = await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'COMPLETED', completedAt: now },
      include: bookingInclude,
    });
    await createNotification(
      {
        userId: booking.customerId,
        type: 'REVIEW_REQUEST',
        title: 'How was your appointment?',
        body: `Thanks for booking ${booking.professional.displayName}. Leave a review to help other customers.`,
        bookingId,
      },
      tx,
    );
    return booking;
  });
  return serializeBooking(updated, 'PROFESSIONAL', now);
}

export async function markNoShow(proUserId, bookingId, { now = new Date() } = {}) {
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await loadBooking(tx, ownedByPro(proUserId, bookingId));
    assertTransition(existing.status, 'NO_SHOW');
    assertAppointmentHappened(existing, now);

    const booking = await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'NO_SHOW' },
      include: bookingInclude,
    });
    await createNotification(
      {
        userId: booking.customerId,
        type: 'BOOKING_NO_SHOW',
        title: 'Marked as no-show',
        body: `${booking.professional.displayName} marked your ${formatManila(booking.startAt)} appointment as a no-show. The deposit is kept.`,
        bookingId,
      },
      tx,
    );
    return booking;
  });
  return serializeBooking(updated, 'PROFESSIONAL', now);
}
