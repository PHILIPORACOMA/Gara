import { describe, it, expect } from 'vitest';
import { assertCanReview } from '../src/services/review.service.js';
import { reviewBody } from '../src/validators/booking.validators.js';
import { publicName } from '../src/services/discovery.service.js';

// The review trust rule (pure part): own booking, COMPLETED, once. The integration tests run it
// against the real database too.
describe('assertCanReview', () => {
  const completed = { customerId: 7, status: 'COMPLETED', review: null };

  it('allows the customer to review their own completed booking', () => {
    expect(() => assertCanReview({ booking: completed, customerId: 7 })).not.toThrow();
  });

  it('refuses every status except COMPLETED', () => {
    for (const status of ['PENDING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED', 'CONFIRMED', 'CANCELLED', 'DECLINED', 'NO_SHOW']) {
      try {
        assertCanReview({ booking: { ...completed, status }, customerId: 7 });
        throw new Error(`${status} should not be reviewable`);
      } catch (err) {
        expect(err.code, status).toBe('REVIEW_NOT_ALLOWED');
        expect(err.status).toBe(422);
      }
    }
  });

  it('refuses a second review of the same booking', () => {
    try {
      assertCanReview({ booking: { ...completed, review: { id: 1 } }, customerId: 7 });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe('ALREADY_REVIEWED');
      expect(err.status).toBe(409);
    }
  });

  it("hides other people's bookings (404, never 403, so ids cannot be probed)", () => {
    for (const booking of [completed, null, undefined]) {
      try {
        assertCanReview({ booking, customerId: 999 });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err.status).toBe(404);
      }
    }
  });
});

describe('review input', () => {
  it('accepts 1 to 5 stars with an optional comment', () => {
    for (const rating of [1, 2, 3, 4, 5]) expect(reviewBody.safeParse({ rating }).success).toBe(true);
    expect(reviewBody.parse({ rating: '5', comment: '  Loved it  ' })).toEqual({ rating: 5, comment: 'Loved it' });
  });

  it('rejects 0, 6, decimals, text and a missing rating', () => {
    for (const rating of [0, 6, -1, 3.5, 'great', undefined, null]) {
      expect(reviewBody.safeParse({ rating }).success, String(rating)).toBe(false);
    }
  });

  it('rejects a comment over 1000 characters', () => {
    expect(reviewBody.safeParse({ rating: 5, comment: 'x'.repeat(1001) }).success).toBe(false);
  });
});

describe('publicName', () => {
  it('shows a first name and last initial only', () => {
    expect(publicName('Ana Reyes')).toBe('Ana R.');
    expect(publicName('Maria Niña de la Cruz')).toBe('Maria C.');
    expect(publicName('Cher')).toBe('Cher');
  });
});
