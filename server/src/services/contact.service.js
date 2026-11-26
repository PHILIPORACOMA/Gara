// Discovery and contact (workbook v3): customers find a verified pro and reach them directly on
// Messenger, by call or by SMS. Gara never sits in the middle of the conversation, so what it can
// measure is the funnel: searches -> profile views -> contact taps.
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { requireProfile } from './professional.service.js';
import { rate } from './metrics.service.js';

const DAY_MS = 24 * 3600_000;

// The link a contact button opens. CALL and SMS need a phone number, MESSENGER a link.
export function contactHref(profile, channel) {
  if (channel === 'MESSENGER') return profile.messengerUrl || null;
  if (!profile.contactPhone) return null;
  return channel === 'CALL' ? `tel:${profile.contactPhone}` : `sms:${profile.contactPhone}`;
}

// Which buttons the public profile shows (the numbers and links themselves are not public).
export const contactOptions = (profile) => ({
  messenger: Boolean(profile.messengerUrl),
  call: Boolean(profile.contactPhone),
  sms: Boolean(profile.contactPhone),
});

// A signed-in customer taps a contact button: log it and hand back the link to open.
export async function contactProfessional(customerId, professionalId, channel) {
  const profile = await prisma.professionalProfile.findFirst({
    where: { id: professionalId, verificationStatus: 'APPROVED' },
    select: { id: true, messengerUrl: true, contactPhone: true },
  });
  if (!profile) throw ApiError.notFound('Professional not found');

  const href = contactHref(profile, channel);
  if (!href) {
    throw ApiError.unprocessable('This professional cannot be reached that way yet. Try another option.', 'CHANNEL_UNAVAILABLE');
  }
  await prisma.contactEvent.create({ data: { professionalId, customerId, channel } });
  return { href, channel };
}

// Profile opened. A pro looking at their own profile is not counted.
export async function recordProfileView(professionalId, viewer) {
  if (viewer?.role === 'PROFESSIONAL') {
    const own = await prisma.professionalProfile.findFirst({ where: { id: professionalId, userId: viewer.id }, select: { id: true } });
    if (own) return;
  }
  await prisma.profileView.create({ data: { professionalId, viewerId: viewer?.id ?? null } });
}

export function recordSearch(viewer, { category, area, date }, resultCount) {
  return prisma.searchEvent.create({
    data: { userId: viewer?.id ?? null, category: category ?? null, area: area ?? null, hasDate: Boolean(date), resultCount },
  });
}

const since = (now, days) => new Date(now.getTime() - days * DAY_MS);

async function channelCounts(where) {
  const grouped = await prisma.contactEvent.groupBy({ by: ['channel'], where, _count: { _all: true } });
  const counts = { MESSENGER: 0, CALL: 0, SMS: 0 };
  grouped.forEach((g) => (counts[g.channel] = g._count._all));
  return { ...counts, total: counts.MESSENGER + counts.CALL + counts.SMS };
}

// What a pro sees on their dashboard: the proof of value behind Gara Pro.
export async function getProInsights(userId, { now = new Date() } = {}) {
  const profile = await requireProfile(userId);
  const window = async (days) => {
    const where = { professionalId: profile.id, createdAt: { gte: since(now, days) } };
    const [views, contacts] = await Promise.all([prisma.profileView.count({ where }), channelCounts(where)]);
    return { views, contacts, contactRate: rate(contacts.total, views) };
  };
  const [last7, last30] = await Promise.all([window(7), window(30)]);
  return {
    last7,
    last30,
    availabilityUpdatedAt: profile.availabilityUpdatedAt,
    availabilityStale: !profile.availabilityUpdatedAt || profile.availabilityUpdatedAt < since(now, 7),
  };
}

// Admin dashboard for the discovery version (workbook v3 success criteria).
export async function getDiscoveryMetrics({ now = new Date() } = {}) {
  const d30 = { createdAt: { gte: since(now, 30) } };
  const [byCategory, verifiedPros, pendingPros, updatedThisWeek, customers, searches, views, contacts, recentContacts] =
    await Promise.all([
      prisma.professionalCategory.groupBy({
        by: ['category'],
        where: { professional: { verificationStatus: 'APPROVED' } },
        _count: { _all: true },
      }),
      prisma.professionalProfile.count({ where: { verificationStatus: 'APPROVED' } }),
      prisma.professionalProfile.count({ where: { verificationStatus: 'PENDING' } }),
      prisma.professionalProfile.count({ where: { verificationStatus: 'APPROVED', availabilityUpdatedAt: { gte: since(now, 7) } } }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.searchEvent.count({ where: d30 }),
      prisma.profileView.count({ where: d30 }),
      channelCounts(d30),
      prisma.contactEvent.findMany({ where: { createdAt: { gte: since(now, 90) } }, select: { customerId: true, createdAt: true } }),
    ]);

  // Returning customers: contacted pros on 2+ different days in the last 90 days.
  const daysByCustomer = new Map();
  recentContacts.forEach((c) => {
    const day = c.createdAt.toISOString().slice(0, 10);
    if (!daysByCustomer.has(c.customerId)) daysByCustomer.set(c.customerId, new Set());
    daysByCustomer.get(c.customerId).add(day);
  });
  const contactingCustomers = daysByCustomer.size;
  const returning = [...daysByCustomer.values()].filter((days) => days.size >= 2).length;

  const perCategory = { HAIR: 0, NAILS: 0, MAKEUP: 0 };
  byCategory.forEach((g) => (perCategory[g.category] = g._count._all));

  return {
    generatedAt: now,
    verifiedPros: { total: verifiedPros, perCategory, pending: pendingPros },
    availabilityUpdatedWeekly: { pros: updatedThisWeek, of: verifiedPros, rate: rate(updatedThisWeek, verifiedPros) },
    customers,
    last30Days: {
      searches,
      profileViews: views,
      contacts,
      searchToContactRate: rate(contacts.total, searches),
      viewToContactRate: rate(contacts.total, views),
    },
    returningCustomers: { returning, of: contactingCustomers, rate: rate(returning, contactingCustomers) },
  };
}
