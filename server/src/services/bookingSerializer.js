import { env } from '../config/env.js';

// Everything a booking list or detail screen needs. What each viewer may see differs:
//   customer: their own booking, the pro's name (and phone once confirmed)
//   pro:      the customer's name; phone and address once the deposit is verified
//   admin:    everything, including the customer's email and GCash proof
export const bookingInclude = {
  items: { orderBy: { sortOrder: 'asc' } },
  professional: { select: { id: true, displayName: true, userId: true, user: { select: { phone: true } } } },
  customer: { select: { id: true, name: true, phone: true, email: true } },
  earning: true,
  review: { select: { id: true, rating: true } },
};

const num = (d) => (d == null ? null : Number(d));

export function canMarkComplete(booking, now = new Date()) {
  return booking.status === 'CONFIRMED' && (env.ALLOW_EARLY_COMPLETE || now >= booking.startAt);
}

export function serializeBooking(b, viewerRole, now = new Date()) {
  const isAdmin = viewerRole === 'ADMIN';
  const isPro = viewerRole === 'PROFESSIONAL';
  const isCustomer = viewerRole === 'CUSTOMER';
  const depositVerifiedOrLater = ['DEPOSIT_VERIFIED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(b.status);

  return {
    id: b.id,
    status: b.status,
    mode: b.mode,
    address: isPro && !depositVerifiedOrLater ? null : b.address,
    area: b.area,
    occasion: b.occasion,
    notes: b.notes,
    startAt: b.startAt,
    endAt: b.endAt,
    createdAt: b.createdAt,
    items: b.items.map((i) => ({ id: i.id, name: i.name, category: i.category, price: num(i.price), durationMin: i.durationMin })),
    pricing: {
      subtotal: num(b.subtotal),
      travelFee: num(b.travelFee),
      total: num(b.total),
      depositPct: num(b.depositPct),
      depositAmount: num(b.depositAmount),
      balanceDue: num(b.balanceDue),
    },
    deposit: {
      gcashRef: isPro ? null : b.gcashRef,
      submittedAt: b.depositSubmittedAt,
      verifiedAt: b.depositVerifiedAt,
      rejectNote: isPro ? null : b.depositRejectNote,
      // The screenshot is private: only the customer and the admin may open it.
      screenshotPath: isPro ? null : b.depositScreenshotPath,
    },
    holdExpiresAt: isCustomer && b.status === 'PENDING_DEPOSIT' ? b.holdExpiresAt : null,
    respondedAt: b.respondedAt,
    declineReason: b.declineReason,
    completedAt: b.completedAt,
    cancelledAt: b.cancelledAt,
    refundNeeded: b.refundNeeded,
    refundResolvedAt: b.refundResolvedAt,
    // Cancelled after the deposit was paid: the admin settles it by hand (no automation yet).
    depositPaidThenCancelled: b.status === 'CANCELLED' && Boolean(b.depositSubmittedAt),
    professional: {
      id: b.professional.id,
      displayName: b.professional.displayName,
      phone: isCustomer && !['CONFIRMED', 'COMPLETED'].includes(b.status) ? null : b.professional.user?.phone ?? null,
    },
    customer: {
      id: b.customer.id,
      name: b.customer.name,
      phone: isPro && !depositVerifiedOrLater ? null : b.customer.phone,
      email: isAdmin ? b.customer.email : null,
    },
    earning: b.earning && !isCustomer
      ? {
          gross: num(b.earning.gross),
          commissionPct: num(b.earning.commissionPct),
          commissionAmount: num(b.earning.commissionAmount),
          travelFee: num(b.earning.travelFee),
          proNet: num(b.earning.proNet),
        }
      : null,
    review: b.review ? { id: b.review.id, rating: b.review.rating } : null,
    canReview: isCustomer && b.status === 'COMPLETED' && !b.review,
    canComplete: isPro && canMarkComplete(b, now),
  };
}
