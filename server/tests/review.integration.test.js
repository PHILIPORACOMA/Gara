import { describe, it, expect, beforeEach, afterAll, inject } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { createBooking, submitDeposit } from '../src/services/booking.service.js';
import { acceptBooking, completeBooking, verifyDeposit } from '../src/services/bookingWorkflow.service.js';
import { createReview } from '../src/services/review.service.js';
import { listReviews } from '../src/services/discovery.service.js';
import { createDayBeforeReminders, expireStaleHolds } from '../src/services/maintenance.service.js';
import { resetDatabase, createUser, createVerifiedPro, testDay, at } from './helpers/db.js';

const ready = inject('testDbReady');

describe.skipIf(!ready)('reviews, ratings and scheduled jobs (integration, real MySQL)', () => {
  let day;
  let pro;
  let admin;
  let hour;

  // Book -> pay -> verify -> accept (and optionally complete) at a fresh hour each time.
  const makeBooking = async (customer, { complete = true } = {}) => {
    hour += 1;
    const booking = await createBooking(customer.id, {
      professionalId: pro.profile.id,
      serviceIds: [pro.bridal.id],
      mode: 'STORE',
      startAt: at(day, hour).toISOString(),
    });
    await submitDeposit(customer.id, booking.id, { gcashRef: `REF${Date.now()}${hour}` }, { filename: 'x.png' });
    await verifyDeposit(admin.id, booking.id);
    await acceptBooking(pro.user.id, booking.id);
    if (complete) await completeBooking(pro.user.id, booking.id, { now: new Date(new Date(booking.endAt).getTime() + 60_000) });
    return booking;
  };

  beforeEach(async () => {
    await resetDatabase();
    await prisma.setting.create({ data: { id: 1 } });
    day = testDay();
    hour = 8;
    pro = await createVerifiedPro();
    admin = await createUser('ADMIN');
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  describe('review only after completion', () => {
    it('refuses a review on a booking that is not completed, whatever its status', async () => {
      const customer = await createUser('CUSTOMER');
      const unpaid = await createBooking(customer.id, { professionalId: pro.profile.id, serviceIds: [pro.bridal.id], mode: 'STORE', startAt: at(day, 16).toISOString() });
      await expect(createReview(customer.id, unpaid.id, { rating: 5 })).rejects.toMatchObject({ code: 'REVIEW_NOT_ALLOWED' });

      const confirmed = await makeBooking(customer, { complete: false });
      await expect(createReview(customer.id, confirmed.id, { rating: 5 })).rejects.toMatchObject({ code: 'REVIEW_NOT_ALLOWED' });

      for (const status of ['CANCELLED', 'DECLINED', 'NO_SHOW']) {
        await prisma.booking.update({ where: { id: confirmed.id }, data: { status } });
        await expect(createReview(customer.id, confirmed.id, { rating: 5 }), status).rejects.toMatchObject({ code: 'REVIEW_NOT_ALLOWED' });
      }
      expect(await prisma.review.count()).toBe(0);
    });

    it('lets the customer review a completed booking, and shows it as a verified-booking review', async () => {
      const customer = await createUser('CUSTOMER', 'Ana Reyes');
      const booking = await makeBooking(customer);

      const review = await createReview(customer.id, booking.id, { rating: 5, comment: 'Beautiful updo, on time!' });
      expect(review.rating).toBe(5);

      const listed = await listReviews(pro.profile.id, { page: 1, pageSize: 10 });
      expect(listed.total).toBe(1);
      expect(listed.reviews[0]).toMatchObject({ rating: 5, comment: 'Beautiful updo, on time!', customerName: 'Ana R.', verifiedBooking: true });
    });

    it('allows only one review per booking, even when two arrive at the same moment', async () => {
      const customer = await createUser('CUSTOMER');
      const booking = await makeBooking(customer);

      const results = await Promise.allSettled([
        createReview(customer.id, booking.id, { rating: 5 }),
        createReview(customer.id, booking.id, { rating: 1 }),
        createReview(customer.id, booking.id, { rating: 3 }),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      for (const r of results.filter((x) => x.status === 'rejected')) expect(r.reason.code).toBe('ALREADY_REVIEWED');
      expect(await prisma.review.count({ where: { bookingId: booking.id } })).toBe(1);
      expect((await prisma.professionalProfile.findUnique({ where: { id: pro.profile.id } })).ratingCount).toBe(1);
    });

    it("cannot review someone else's booking", async () => {
      const owner = await createUser('CUSTOMER');
      const stranger = await createUser('CUSTOMER');
      const booking = await makeBooking(owner);
      await expect(createReview(stranger.id, booking.id, { rating: 1, comment: 'Not even my booking' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe("the professional's rating", () => {
    it('is the average of all reviews, kept up to date', async () => {
      const [a, b, c] = await Promise.all([1, 2, 3].map(() => createUser('CUSTOMER')));
      const read = async () => {
        const p = await prisma.professionalProfile.findUnique({ where: { id: pro.profile.id } });
        return { avg: Number(p.ratingAvg), count: p.ratingCount };
      };
      expect(await read()).toEqual({ avg: 0, count: 0 });

      await createReview(a.id, (await makeBooking(a)).id, { rating: 5 });
      expect(await read()).toEqual({ avg: 5, count: 1 });

      await createReview(b.id, (await makeBooking(b)).id, { rating: 4 });
      expect(await read()).toEqual({ avg: 4.5, count: 2 });

      await createReview(c.id, (await makeBooking(c)).id, { rating: 4 });
      expect(await read()).toEqual({ avg: 4.33, count: 3 });
    });
  });

  describe('scheduled jobs', () => {
    it('expires unpaid bookings whose hold ran out, and nothing else', async () => {
      const customer = await createUser('CUSTOMER');
      const base = { professionalId: pro.profile.id, serviceIds: [pro.bridal.id], mode: 'STORE' };
      const stale = await createBooking(customer.id, { ...base, startAt: at(day, 9).toISOString() });
      const fresh = await createBooking(customer.id, { ...base, startAt: at(day, 11).toISOString() });
      const paid = await createBooking(customer.id, { ...base, startAt: at(day, 13).toISOString() });
      await submitDeposit(customer.id, paid.id, { gcashRef: 'PAIDREF001' }, { filename: 'x.png' });
      await prisma.booking.update({ where: { id: stale.id }, data: { holdExpiresAt: new Date(Date.now() - 60_000) } });

      expect(await expireStaleHolds()).toEqual({ expired: 1 });

      const status = async (id) => (await prisma.booking.findUnique({ where: { id } })).status;
      expect(await status(stale.id)).toBe('CANCELLED');
      expect(await status(fresh.id)).toBe('PENDING_DEPOSIT');
      expect(await status(paid.id)).toBe('DEPOSIT_SUBMITTED');
      expect(await prisma.notification.count({ where: { userId: customer.id, type: 'BOOKING_CANCELLED' } })).toBe(1);
      expect(await expireStaleHolds()).toEqual({ expired: 0 }); // safe to run again
    });

    it('creates the day-before reminder once, for both people, only for confirmed bookings inside 24 hours', async () => {
      const customer = await createUser('CUSTOMER');
      const confirmed = await makeBooking(customer, { complete: false });
      const unpaid = await createBooking(customer.id, { professionalId: pro.profile.id, serviceIds: [pro.bridal.id], mode: 'STORE', startAt: at(day, 15).toISOString() });
      const start = new Date(confirmed.startAt);

      // 2 days before: too early.
      expect(await createDayBeforeReminders({ now: new Date(start.getTime() - 48 * 3600_000) })).toEqual({ created: 0 });
      // 12 hours before: reminders for the customer and the pro, not for the unpaid booking.
      expect(await createDayBeforeReminders({ now: new Date(start.getTime() - 12 * 3600_000) })).toEqual({ created: 2 });
      // Running again (every 5 minutes) must not duplicate them.
      expect(await createDayBeforeReminders({ now: new Date(start.getTime() - 11 * 3600_000) })).toEqual({ created: 0 });

      expect(await prisma.notification.count({ where: { type: 'REMINDER_DAY_BEFORE', userId: customer.id, bookingId: confirmed.id } })).toBe(1);
      expect(await prisma.notification.count({ where: { type: 'REMINDER_DAY_BEFORE', userId: pro.user.id, bookingId: confirmed.id } })).toBe(1);
      expect(await prisma.notification.count({ where: { type: 'REMINDER_DAY_BEFORE', bookingId: unpaid.id } })).toBe(0);
    });
  });
});
