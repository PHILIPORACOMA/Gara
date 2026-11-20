// Scheduled housekeeping. jobs/scheduler.js runs this every few minutes; every function is
// safe to run repeatedly (idempotent), so a restart or an overlapping run does no harm.
import { prisma } from '../lib/prisma.js';
import { formatManila } from '../utils/time.js';
import { createNotification } from './notification.service.js';

const REMINDER_WINDOW_MS = 24 * 3600_000;

// The day-before reminder: once a CONFIRMED appointment is within 24 hours, remind both people
// (in the app; email/SMS is on the roadmap). The dedupeKey makes sure each reminder is created once.
export async function createDayBeforeReminders({ now = new Date() } = {}) {
  const due = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', startAt: { gt: now, lte: new Date(now.getTime() + REMINDER_WINDOW_MS) } },
    include: {
      customer: { select: { id: true, name: true } },
      professional: { select: { displayName: true, userId: true } },
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });

  let created = 0;
  for (const b of due) {
    const when = formatManila(b.startAt);
    const services = b.items.map((i) => i.name).join(', ');
    const forCustomer = await createNotification({
      userId: b.customer.id,
      type: 'REMINDER_DAY_BEFORE',
      title: 'Appointment tomorrow',
      body: `Reminder: ${services} with ${b.professional.displayName} on ${when}. Balance due on the day: ₱${Number(b.balanceDue).toLocaleString('en-PH')}.`,
      bookingId: b.id,
      dedupeKey: `reminder:customer:${b.id}`,
    });
    const forPro = await createNotification({
      userId: b.professional.userId,
      type: 'REMINDER_DAY_BEFORE',
      title: 'Appointment tomorrow',
      body: `Reminder: ${b.customer.name} is booked for ${services} on ${when}.`,
      bookingId: b.id,
      dedupeKey: `reminder:pro:${b.id}`,
    });
    created += (forCustomer ? 1 : 0) + (forPro ? 1 : 0);
  }
  return { created };
}

// Unpaid bookings whose hold ran out are cancelled so they stop cluttering lists.
// (The slot itself was already free again the moment the hold expired.)
export async function expireStaleHolds({ now = new Date() } = {}) {
  const stale = await prisma.booking.findMany({
    where: { status: 'PENDING_DEPOSIT', holdExpiresAt: { lte: now } },
    include: { professional: { select: { displayName: true } } },
  });

  let expired = 0;
  for (const b of stale) {
    // Re-check the status in the same statement, so a deposit submitted a moment ago wins.
    const { count } = await prisma.booking.updateMany({
      where: { id: b.id, status: 'PENDING_DEPOSIT' },
      data: { status: 'CANCELLED', cancelledAt: now, holdExpiresAt: null },
    });
    if (count === 1) {
      expired += 1;
      await createNotification({
        userId: b.customerId,
        type: 'BOOKING_CANCELLED',
        title: 'Booking expired',
        body: `Your booking with ${b.professional.displayName} on ${formatManila(b.startAt)} was cancelled because the deposit was not sent in time. You can book again anytime.`,
        bookingId: b.id,
      });
    }
  }
  return { expired };
}

export async function runMaintenance(options) {
  const holds = await expireStaleHolds(options);
  const reminders = await createDayBeforeReminders(options);
  return { ...holds, ...reminders };
}
