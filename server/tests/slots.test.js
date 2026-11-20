import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { computeSlots, findConflict, isHoldingSlot, overlaps } from '../src/services/slots.js';
import { manilaMinutesToDate } from '../src/utils/time.js';

// Friday 20 Nov 2026 in Manila. "Now" is the evening before, so the lead-time rule never interferes.
const DAY = '2026-11-20';
const NOW = new Date('2026-11-19T10:00:00Z');
const hhmm = (d) => DateTime.fromJSDate(d, { zone: 'Asia/Manila' }).toFormat('HH:mm');
const starts = (slots) => slots.map((s) => hhmm(s.startAt));
const at = (h, m = 0) => manilaMinutesToDate(DAY, h * 60 + m);
const booking = (fromH, toH, status = 'CONFIRMED', extra = {}) => ({ startAt: at(fromH), endAt: at(toH), status, holdExpiresAt: null, ...extra });
const morning = [{ startMin: 540, endMin: 720 }]; // 9:00 - 12:00

describe('computeSlots: opening hours and duration', () => {
  it('offers every 30 minutes while the service still fits before closing', () => {
    expect(starts(computeSlots({ isoDate: DAY, windows: morning, durationMin: 60, now: NOW }))).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00']);
  });

  it('uses the TOTAL duration of all chosen services', () => {
    // e.g. 90 min haircut + 60 min makeup = 150 min: only 9:00 and 9:30 fit before noon
    expect(starts(computeSlots({ isoDate: DAY, windows: morning, durationMin: 150, now: NOW }))).toEqual(['09:00', '09:30']);
  });

  it('allows a service that exactly fills the window, and nothing longer', () => {
    expect(starts(computeSlots({ isoDate: DAY, windows: [{ startMin: 540, endMin: 660 }], durationMin: 120, now: NOW }))).toEqual(['09:00']);
    expect(computeSlots({ isoDate: DAY, windows: morning, durationMin: 240, now: NOW })).toEqual([]);
  });

  it('has no slots on a day off (no windows)', () => {
    expect(computeSlots({ isoDate: DAY, windows: [], durationMin: 60, now: NOW })).toEqual([]);
  });

  it('handles split days: nothing is offered across the lunch break', () => {
    const windows = [
      { startMin: 780, endMin: 1020 }, // 13:00 - 17:00 (given out of order on purpose)
      { startMin: 540, endMin: 720 }, // 9:00 - 12:00
    ];
    const result = starts(computeSlots({ isoDate: DAY, windows, durationMin: 90, now: NOW }));
    expect(result).toEqual(['09:00', '09:30', '10:00', '10:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30']);
    expect(result).not.toContain('11:00'); // 11:00-12:30 would run into lunch
  });

  it('returns nothing without a valid duration', () => {
    expect(computeSlots({ isoDate: DAY, windows: morning, durationMin: 0, now: NOW })).toEqual([]);
  });
});

describe('computeSlots: blocked dates', () => {
  it('removes every slot on a blocked date', () => {
    expect(computeSlots({ isoDate: DAY, windows: morning, blocked: true, durationMin: 60, now: NOW })).toEqual([]);
  });
});

describe('computeSlots: existing bookings', () => {
  it('removes any slot that overlaps an active booking, keeps back-to-back ones', () => {
    // Booked 10:00-11:00. A 60-minute service can start at 9:00 (ends exactly 10:00) and 11:00.
    const result = starts(computeSlots({ isoDate: DAY, windows: morning, durationMin: 60, bookings: [booking(10, 11)], now: NOW }));
    expect(result).toEqual(['09:00', '11:00']);
  });

  it('blocks slots on every active status', () => {
    for (const status of ['DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED', 'CONFIRMED']) {
      const result = computeSlots({ isoDate: DAY, windows: morning, durationMin: 180, bookings: [booking(9, 10, status)], now: NOW });
      expect(result, status).toEqual([]);
    }
  });

  it('ignores finished or cancelled bookings', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'DECLINED', 'NO_SHOW']) {
      const result = computeSlots({ isoDate: DAY, windows: morning, durationMin: 180, bookings: [booking(9, 12, status)], now: NOW });
      expect(starts(result), status).toEqual(['09:00']);
    }
  });

  it('holds a slot for an unpaid booking until the hold expires', () => {
    const live = booking(9, 12, 'PENDING_DEPOSIT', { holdExpiresAt: new Date(NOW.getTime() + 30 * 60_000) });
    const expired = booking(9, 12, 'PENDING_DEPOSIT', { holdExpiresAt: new Date(NOW.getTime() - 1) });
    expect(computeSlots({ isoDate: DAY, windows: morning, durationMin: 180, bookings: [live], now: NOW })).toEqual([]);
    expect(starts(computeSlots({ isoDate: DAY, windows: morning, durationMin: 180, bookings: [expired], now: NOW }))).toEqual(['09:00']);
  });

  it('does not let one pro-calendar booking remove slots that are free elsewhere in the day', () => {
    const windows = [{ startMin: 540, endMin: 1020 }];
    const result = starts(computeSlots({ isoDate: DAY, windows, durationMin: 60, bookings: [booking(13, 14)], now: NOW }));
    expect(result).toContain('12:00'); // ends exactly at 13:00
    expect(result).toContain('14:00'); // starts exactly when the booking ends
    expect(result).not.toContain('12:30');
    expect(result).not.toContain('13:00');
    expect(result).not.toContain('13:30');
  });
});

describe('computeSlots: now, lead time and Manila time', () => {
  it('hides slots that start sooner than the minimum lead time', () => {
    // It is 9:20 AM Manila on the day itself. With a 60 minute lead the first slot is 10:30.
    const now = new Date('2026-11-20T01:20:00Z');
    expect(starts(computeSlots({ isoDate: DAY, windows: morning, durationMin: 60, now }))).toEqual(['10:30', '11:00']);
  });

  it('offers nothing once the day is over', () => {
    const now = new Date('2026-11-20T15:00:00Z'); // 11 PM Manila
    expect(computeSlots({ isoDate: DAY, windows: morning, durationMin: 60, now })).toEqual([]);
  });

  it('returns correct UTC instants for Manila (UTC+8) wall-clock times', () => {
    const [first] = computeSlots({ isoDate: DAY, windows: morning, durationMin: 60, now: NOW });
    expect(first.startAt.toISOString()).toBe('2026-11-20T01:00:00.000Z'); // 9:00 AM Manila
    expect(first.endAt.toISOString()).toBe('2026-11-20T02:00:00.000Z'); // 10:00 AM Manila
  });

  it('is not affected by the machine timezone: a late-evening slot stays on the same Manila day', () => {
    const windows = [{ startMin: 1260, endMin: 1380 }]; // 9 PM - 11 PM
    const [slot] = computeSlots({ isoDate: DAY, windows, durationMin: 60, now: NOW });
    expect(slot.startAt.toISOString()).toBe('2026-11-20T13:00:00.000Z');
    expect(DateTime.fromJSDate(slot.startAt, { zone: 'Asia/Manila' }).toISODate()).toBe(DAY);
  });
});

describe('overlaps / findConflict (the rule used to prevent double-booking)', () => {
  it('treats intervals as half-open: back-to-back is not a conflict', () => {
    expect(overlaps(at(9), at(10), at(10), at(11))).toBe(false);
    expect(overlaps(at(10), at(11), at(9), at(10))).toBe(false);
  });

  it('detects partial overlap, containment and identical times', () => {
    expect(overlaps(at(9), at(10, 30), at(10), at(11))).toBe(true);
    expect(overlaps(at(9), at(12), at(10), at(11))).toBe(true);
    expect(overlaps(at(10), at(11), at(9), at(12))).toBe(true);
    expect(overlaps(at(10), at(11), at(10), at(11))).toBe(true);
  });

  it('findConflict returns the clashing booking and ignores freed ones', () => {
    const confirmed = booking(10, 11, 'CONFIRMED');
    const cancelled = booking(10, 11, 'CANCELLED');
    expect(findConflict([cancelled, confirmed], at(10, 30), at(11, 30), NOW)).toBe(confirmed);
    expect(findConflict([cancelled], at(10), at(11), NOW)).toBeUndefined();
    expect(findConflict([confirmed], at(11), at(12), NOW)).toBeUndefined();
  });

  it('isHoldingSlot: unpaid bookings without a hold time never hold a slot', () => {
    expect(isHoldingSlot({ status: 'PENDING_DEPOSIT', holdExpiresAt: null }, NOW)).toBe(false);
  });
});
