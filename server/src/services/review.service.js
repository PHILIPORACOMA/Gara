import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';

// The trust rule, as a pure function so it is easy to test:
// a review is allowed only on the customer's OWN booking, once it is COMPLETED, and only once.
export function assertCanReview({ booking, customerId }) {
  if (!booking || booking.customerId !== customerId) throw ApiError.notFound('Booking not found');
  if (booking.status !== 'COMPLETED') {
    throw ApiError.unprocessable('You can review a booking only after it has been completed.', 'REVIEW_NOT_ALLOWED');
  }
  if (booking.review) throw ApiError.conflict('You have already reviewed this booking.', 'ALREADY_REVIEWED');
}

export const serializeReview = (r) => ({ id: r.id, bookingId: r.bookingId, rating: r.rating, comment: r.comment, createdAt: r.createdAt });

export async function createReview(customerId, bookingId, { rating, comment }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { review: true } });
      assertCanReview({ booking, customerId });

      const review = await tx.review.create({
        data: { bookingId, customerId, professionalId: booking.professionalId, rating, comment: comment || null },
      });

      // Keep the pro's average and count up to date (read straight from the reviews table).
      const agg = await tx.review.aggregate({
        where: { professionalId: booking.professionalId },
        _avg: { rating: true },
        _count: { _all: true },
      });
      await tx.professionalProfile.update({
        where: { id: booking.professionalId },
        data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 100) / 100, ratingCount: agg._count._all },
      });

      return serializeReview(review);
    });
  } catch (err) {
    // Two simultaneous submissions: the unique index on bookingId lets only one through.
    if (err?.code === 'P2002') throw ApiError.conflict('You have already reviewed this booking.', 'ALREADY_REVIEWED');
    throw err;
  }
}
