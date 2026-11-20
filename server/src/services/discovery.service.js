import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeService } from './catalog.service.js';
import { assertBookableDate, filterByDateAvailability, getSlots } from './slots.service.js';

// Only APPROVED professionals are ever visible to customers.
const VISIBLE = { verificationStatus: 'APPROVED' };

// "Ana Reyes" -> "Ana R." Reviews show a first name and last initial only.
export function publicName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function serializeCard(p) {
  return {
    id: p.id,
    displayName: p.displayName,
    bio: p.bio ? p.bio.slice(0, 160) : null,
    verified: true,
    categories: p.categories.map((c) => c.category),
    areas: p.areas.map((a) => a.area),
    serviceMode: p.serviceMode,
    travelFee: Number(p.travelFee),
    ratingAvg: Number(p.ratingAvg),
    ratingCount: p.ratingCount,
    coverPath: p.portfolio[0]?.path ?? null,
    fromPrice: p.services.length ? Math.min(...p.services.map((s) => Number(s.price))) : null,
    serviceCount: p.services.length,
  };
}

// Filters: category, area, date, price range, home service only.
// A pro matches when they have at least one active service that satisfies the
// category and price filters; with a date, they also need an open slot that day.
export async function searchProfessionals({ category, area, date, minPrice, maxPrice, homeOnly }) {
  if (date) assertBookableDate(date);

  const serviceWhere = {
    isActive: true,
    ...(category && { category }),
    ...((minPrice != null || maxPrice != null) && {
      price: { ...(minPrice != null && { gte: minPrice }), ...(maxPrice != null && { lte: maxPrice }) },
    }),
  };

  const profiles = await prisma.professionalProfile.findMany({
    where: {
      ...VISIBLE,
      ...(category && { categories: { some: { category } } }),
      ...(area && { areas: { some: { area } } }),
      ...(homeOnly && { serviceMode: { in: ['HOME', 'BOTH'] } }),
      services: { some: serviceWhere },
    },
    include: {
      categories: { select: { category: true } },
      areas: { select: { area: true } },
      portfolio: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: 1 },
      // Only the matching services, so "from" prices respect the filters.
      services: { where: serviceWhere, select: { price: true, durationMin: true } },
    },
    orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }, { id: 'asc' }],
    take: 100,
  });

  let candidates = profiles.map((p) => ({
    ...p,
    shortestDurationMin: Math.min(...p.services.map((s) => s.durationMin)),
  }));
  if (date) candidates = await filterByDateAvailability(candidates, date);

  return candidates.map(serializeCard);
}

async function requireVisibleProfile(id) {
  const profile = await prisma.professionalProfile.findFirst({
    where: { id, ...VISIBLE },
    include: {
      categories: { select: { category: true } },
      areas: { select: { area: true } },
      portfolio: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      services: { where: { isActive: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] },
    },
  });
  if (!profile) throw ApiError.notFound('Professional not found');
  return profile;
}

function serializeReview(r) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
    customerName: publicName(r.customer.name),
    // A review can only exist for a COMPLETED booking, so every review is verified.
    verifiedBooking: true,
  };
}

export async function listReviews(professionalId, { page, pageSize }) {
  const where = { professionalId };
  const [total, rows] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { customer: { select: { name: true } } },
    }),
  ]);
  return { reviews: rows.map(serializeReview), total, page, pageSize };
}

export async function getPublicProfile(id) {
  const p = await requireVisibleProfile(id);
  const firstReviews = await listReviews(id, { page: 1, pageSize: 5 });
  return {
    id: p.id,
    displayName: p.displayName,
    bio: p.bio,
    verified: true,
    verifiedAt: p.verifiedAt,
    categories: p.categories.map((c) => c.category),
    areas: p.areas.map((a) => a.area),
    serviceMode: p.serviceMode,
    storeAddress: p.serviceMode === 'HOME' ? null : p.storeAddress,
    travelFee: p.serviceMode === 'STORE' ? 0 : Number(p.travelFee),
    ratingAvg: Number(p.ratingAvg),
    ratingCount: p.ratingCount,
    portfolio: p.portfolio.map((img) => ({ id: img.id, path: img.path })),
    services: p.services.map(serializeService),
    reviews: firstReviews.reviews,
    reviewTotal: firstReviews.total,
  };
}

// Open start times for the chosen services on a date. The same function backs the booking
// flow, and the server re-checks the slot again when the booking is created.
export async function getBookableSlots({ professionalId, isoDate, serviceIds, mode }) {
  assertBookableDate(isoDate);
  const profile = await requireVisibleProfile(professionalId);

  if (mode === 'HOME' && profile.serviceMode === 'STORE') {
    throw ApiError.unprocessable('This professional does not offer home service.', 'MODE_NOT_OFFERED');
  }
  if (mode === 'STORE' && profile.serviceMode === 'HOME') {
    throw ApiError.unprocessable('This professional does not offer in-store service.', 'MODE_NOT_OFFERED');
  }

  const chosen = profile.services.filter((s) => serviceIds.includes(s.id));
  if (chosen.length !== serviceIds.length) {
    throw ApiError.unprocessable('One or more services are not available from this professional.', 'INVALID_SERVICES');
  }

  const durationMin = chosen.reduce((sum, s) => sum + s.durationMin, 0);
  const slots = await getSlots({ professionalId, isoDate, durationMin });
  return {
    date: isoDate,
    durationMin,
    slots: slots.map((s) => ({ startAt: s.startAt.toISOString(), endAt: s.endAt.toISOString() })),
  };
}
