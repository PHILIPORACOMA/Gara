import { prisma } from '../lib/prisma.js';

const serialize = (n) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  bookingId: n.bookingId,
  read: n.readAt != null,
  createdAt: n.createdAt,
});

// Latest notifications for the bell, newest first, plus how many are unread.
export async function listForUser(userId, { limit = 30 } = {}) {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { notifications: rows.map(serialize), unreadCount };
}

export async function unreadCount(userId) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

// Only your own notifications can be marked read (others are ignored, not revealed).
export async function markRead(userId, notificationId) {
  await prisma.notification.updateMany({ where: { id: notificationId, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllRead(userId) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

// Creates an in-app notification. Pass a transaction client as `client` so the notification
// is saved atomically with the change that caused it. With `dedupeKey`, creating the same
// notification twice is a no-op (used for scheduled reminders).
export async function createNotification({ userId, type, title, body, bookingId = null, dedupeKey = null }, client = prisma) {
  if (dedupeKey) {
    const existing = await client.notification.findUnique({ where: { dedupeKey }, select: { id: true } });
    if (existing) return null;
  }
  return client.notification.create({ data: { userId, type, title, body, bookingId, dedupeKey } });
}
