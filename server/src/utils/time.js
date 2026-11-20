import { DateTime } from 'luxon';
import { TIMEZONE } from '../config/constants.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// "YYYY-MM-DD" is a valid calendar date.
export function isValidIsoDate(value) {
  return typeof value === 'string' && ISO_DATE.test(value) && DateTime.fromISO(value, { zone: TIMEZONE }).isValid;
}

export function nowManila() {
  return DateTime.now().setZone(TIMEZONE);
}

// Midnight (Asia/Manila) at the start of the given "YYYY-MM-DD".
export function manilaStartOfDay(isoDate) {
  return DateTime.fromISO(isoDate, { zone: TIMEZONE }).startOf('day');
}

// The Manila wall-clock time `minutes` after midnight on `isoDate`, as a JS Date (UTC instant).
export function manilaMinutesToDate(isoDate, minutes) {
  return manilaStartOfDay(isoDate).plus({ minutes }).toJSDate();
}

// ISO weekday of a Manila date: 1 = Monday ... 7 = Sunday (matches AvailabilityRule.dayOfWeek).
export function manilaIsoWeekday(isoDate) {
  return manilaStartOfDay(isoDate).weekday;
}

// "YYYY-MM-DD" of an instant, as seen in Manila.
export function toManilaIsoDate(date) {
  return DateTime.fromJSDate(date, { zone: TIMEZONE }).toISODate();
}

// Prisma writes DATE columns from the UTC date part, so store a Manila calendar date
// as midnight UTC of the same "YYYY-MM-DD".
export function isoDateToDbDate(isoDate) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

// Reverse of isoDateToDbDate.
export function dbDateToIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

// "Fri, Nov 20, 9:00 AM" in Manila time, for notification text.
export function formatManila(date) {
  return DateTime.fromJSDate(date, { zone: TIMEZONE }).toFormat('ccc, LLL d, h:mm a');
}

// "YYYY-MM" Manila month window as [start, endExclusive) UTC instants.
export function manilaMonthRange(now = nowManila()) {
  const start = now.startOf('month');
  return { start: start.toJSDate(), end: start.plus({ months: 1 }).toJSDate() };
}
