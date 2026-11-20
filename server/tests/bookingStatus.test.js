import { describe, it, expect } from 'vitest';
import { assertTransition, canTransition, TRANSITIONS } from '../src/services/bookingStatus.js';

const ALL = Object.keys(TRANSITIONS);

describe('booking status machine', () => {
  it('allows the happy path step by step', () => {
    const path = ['PENDING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED', 'CONFIRMED', 'COMPLETED'];
    for (let i = 1; i < path.length; i += 1) expect(canTransition(path[i - 1], path[i])).toBe(true);
  });

  it('does not allow skipping steps', () => {
    expect(canTransition('PENDING_DEPOSIT', 'CONFIRMED')).toBe(false);
    expect(canTransition('PENDING_DEPOSIT', 'DEPOSIT_VERIFIED')).toBe(false);
    expect(canTransition('DEPOSIT_SUBMITTED', 'CONFIRMED')).toBe(false);
    expect(canTransition('DEPOSIT_VERIFIED', 'COMPLETED')).toBe(false);
  });

  it('the pro can only accept or decline after the admin verified the deposit', () => {
    expect(canTransition('DEPOSIT_VERIFIED', 'CONFIRMED')).toBe(true);
    expect(canTransition('DEPOSIT_VERIFIED', 'DECLINED')).toBe(true);
    expect(canTransition('DEPOSIT_SUBMITTED', 'DECLINED')).toBe(false);
    expect(canTransition('PENDING_DEPOSIT', 'DECLINED')).toBe(false);
  });

  it('only a confirmed booking can be completed or marked no-show', () => {
    for (const from of ALL.filter((s) => s !== 'CONFIRMED')) {
      expect(canTransition(from, 'COMPLETED'), `${from} -> COMPLETED`).toBe(false);
      expect(canTransition(from, 'NO_SHOW'), `${from} -> NO_SHOW`).toBe(false);
    }
    expect(canTransition('CONFIRMED', 'COMPLETED')).toBe(true);
    expect(canTransition('CONFIRMED', 'NO_SHOW')).toBe(true);
  });

  it('a rejected deposit sends the booking back to PENDING_DEPOSIT', () => {
    expect(canTransition('DEPOSIT_SUBMITTED', 'PENDING_DEPOSIT')).toBe(true);
  });

  it('finished bookings are final', () => {
    for (const final of ['COMPLETED', 'CANCELLED', 'DECLINED', 'NO_SHOW']) {
      expect(TRANSITIONS[final]).toEqual([]);
      for (const to of ALL) expect(canTransition(final, to), `${final} -> ${to}`).toBe(false);
    }
  });

  it('can be cancelled from every active status, but not after it is finished', () => {
    for (const from of ['PENDING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED', 'CONFIRMED']) {
      expect(canTransition(from, 'CANCELLED')).toBe(true);
    }
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('assertTransition throws a 422 INVALID_TRANSITION with a readable message', () => {
    expect(() => assertTransition('COMPLETED', 'CONFIRMED')).toThrowError(/completed and cannot move to confirmed/);
    try {
      assertTransition('CANCELLED', 'CONFIRMED');
    } catch (err) {
      expect(err.status).toBe(422);
      expect(err.code).toBe('INVALID_TRANSITION');
    }
    expect(() => assertTransition('CONFIRMED', 'COMPLETED')).not.toThrow();
  });
});
