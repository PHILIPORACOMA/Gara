// Pure scheduling logic (no database). Everything here works on plain data so it can be
// unit tested exhaustively. slots.service.js loads the data and calls these functions;
// booking.service.js calls findConflict() again inside the booking transaction.
import { SLOT_INTERVAL_MIN } from '../config/constants.js';
import { manilaMinutesToDate } from '../utils/time.js';

// Customers cannot book a slot starting sooner than this from now, or further ahead than this.
export const MIN_LEAD_MINUTES = 60;
export const MAX_ADVANCE_DAYS = 90;

// Half-open intervals [start, end): back-to-back appointments do NOT overlap.
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

// Does this booking currently occupy the pro's calendar?
// Unpaid bookings (PENDING_DEPOSIT) only hold their slot until holdExpiresAt.
export function isHoldingSlot(booking, now) {
  switch (booking.status) {
    case 'PENDING_DEPOSIT':
      return booking.holdExpiresAt ? booking.holdExpiresAt > now : false;
    case 'DEPOSIT_SUBMITTED':
    case 'DEPOSIT_VERIFIED':
    case 'CONFIRMED':
      return true;
    default:
      return false; // COMPLETED, CANCELLED, DECLINED, NO_SHOW free the slot
  }
}

// First existing booking that clashes with [start, end), or undefined.
export function findConflict(bookings, start, end, now) {
  return bookings.find((b) => isHoldingSlot(b, now) && overlaps(start, end, b.startAt, b.endAt));
}

// Open start times for one pro on one Manila date.
//   isoDate     "YYYY-MM-DD" (Asia/Manila)
//   windows     [{ startMin, endMin }] the pro works that weekday (minutes from midnight)
//   blocked     true when the date is a blocked date
//   bookings    existing bookings that day: { startAt, endAt, status, holdExpiresAt }
//   durationMin total duration of the chosen services
//   now         current instant (a Date); slots earlier than now + leadMin are hidden
// Returns [{ startAt: Date, endAt: Date }], earliest first.
export function computeSlots({
  isoDate,
  windows,
  blocked = false,
  bookings = [],
  durationMin,
  now = new Date(),
  intervalMin = SLOT_INTERVAL_MIN,
  leadMin = MIN_LEAD_MINUTES,
}) {
  if (blocked || !durationMin || durationMin <= 0) return [];

  const earliest = new Date(now.getTime() + leadMin * 60_000);
  const slots = [];

  for (const window of [...windows].sort((a, b) => a.startMin - b.startMin)) {
    for (let start = window.startMin; start + durationMin <= window.endMin; start += intervalMin) {
      const startAt = manilaMinutesToDate(isoDate, start);
      const endAt = manilaMinutesToDate(isoDate, start + durationMin);
      if (startAt < earliest) continue;
      if (findConflict(bookings, startAt, endAt, now)) continue;
      slots.push({ startAt, endAt });
    }
  }
  return slots;
}
