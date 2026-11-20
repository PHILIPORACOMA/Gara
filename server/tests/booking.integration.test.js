import { describe, it, expect, beforeAll, beforeEach, afterAll, inject } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { cancelBooking, createBooking, submitDeposit, MAX_UNPAID_BOOKINGS } from '../src/services/booking.service.js';
import { acceptBooking, completeBooking, declineBooking, markNoShow, rejectDeposit, verifyDeposit } from '../src/services/bookingWorkflow.service.js';
import { resetDatabase, createUser, createVerifiedPro, testDay, at } from './helpers/db.js';
import { isoDateToDbDate } from '../src/utils/time.js';

// These tests run against a REAL MySQL database (DATABASE_URL_TEST), because the point is to
// prove that the database transaction and row lock really prevent double-booking.
const ready = inject('testDbReady');

describe.skipIf(!ready)('booking (integration, real MySQL)', () => {
  let day;
  let pro;
  const input = (overrides = {}) => ({
    professionalId: pro.profile.id,
    serviceIds: [pro.bridal.id],
    mode: 'STORE',
    startAt: at(day, 10).toISOString(),
    ...overrides,
  });
  const homeInput = (overrides = {}) =>
    input({ mode: 'HOME', address: '45 Mango Ave, Barangay Lahug', area: 'Cebu City', ...overrides });

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    await prisma.setting.create({ data: { id: 1 } }); // deposit 20%, commission 10%, hold 120 min
    day = testDay();
    pro = await createVerifiedPro();
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  describe('double-booking prevention', () => {
    it('lets exactly ONE of five simultaneous requests for the same slot succeed', async () => {
      const customers = await Promise.all([1, 2, 3, 4, 5].map((n) => createUser('CUSTOMER', `Customer ${n}`)));

      const results = await Promise.allSettled(customers.map((c) => createBooking(c.id, input())));

      const won = results.filter((r) => r.status === 'fulfilled');
      const lost = results.filter((r) => r.status === 'rejected');
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(4);
      for (const r of lost) expect(r.reason.code).toBe('SLOT_TAKEN');
      expect(await prisma.booking.count({ where: { professionalId: pro.profile.id } })).toBe(1);
    });

    it('also stops simultaneous requests for OVERLAPPING (not identical) times', async () => {
      const customers = await Promise.all([1, 2, 3].map((n) => createUser('CUSTOMER', `Customer ${n}`)));
      // 90-minute bookings starting 10:00, 10:30 and 11:00 (10:00-11:30, 10:30-12:00, 11:00-12:30):
      // every pair overlaps, so at most one may win whatever the order they arrive in.
      const starts = [at(day, 10), at(day, 10, 30), at(day, 11)];
      const both = [pro.bridal.id, pro.treatment.id];

      const results = await Promise.allSettled(
        customers.map((c, i) => createBooking(c.id, input({ serviceIds: both, startAt: starts[i].toISOString() }))),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await prisma.booking.count({ where: { professionalId: pro.profile.id } })).toBe(1);
    });

    it('allows back-to-back appointments and rejects real overlaps', async () => {
      const customer = await createUser('CUSTOMER');
      const other = await createUser('CUSTOMER');
      await createBooking(customer.id, input()); // 10:00-11:00

      await expect(createBooking(other.id, input({ startAt: at(day, 10, 30).toISOString() }))).rejects.toMatchObject({ code: 'SLOT_TAKEN' });
      await expect(createBooking(other.id, input({ startAt: at(day, 9, 30).toISOString() }))).rejects.toMatchObject({ code: 'SLOT_TAKEN' });

      await expect(createBooking(other.id, input({ startAt: at(day, 11).toISOString() }))).resolves.toBeTruthy(); // starts when the first ends
      await expect(createBooking(other.id, input({ startAt: at(day, 9).toISOString() }))).resolves.toBeTruthy(); // ends when the first starts
    });

    it('frees the slot when the booking is cancelled', async () => {
      const first = await createUser('CUSTOMER');
      const second = await createUser('CUSTOMER');
      const booking = await createBooking(first.id, input());
      await expect(createBooking(second.id, input())).rejects.toMatchObject({ code: 'SLOT_TAKEN' });

      await cancelBooking(first.id, booking.id);

      await expect(createBooking(second.id, input())).resolves.toBeTruthy();
    });

    it('frees the slot when an unpaid hold expires, but not before', async () => {
      const first = await createUser('CUSTOMER');
      const second = await createUser('CUSTOMER');
      const booking = await createBooking(first.id, input());

      await expect(createBooking(second.id, input())).rejects.toMatchObject({ code: 'SLOT_TAKEN' });

      await prisma.booking.update({ where: { id: booking.id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });

      await expect(createBooking(second.id, input())).resolves.toBeTruthy();
    });

    it('keeps the slot held once a deposit has been submitted, even past the original hold time', async () => {
      const first = await createUser('CUSTOMER');
      const second = await createUser('CUSTOMER');
      const booking = await createBooking(first.id, input());
      await submitDeposit(first.id, booking.id, { gcashRef: 'REF000111' }, { filename: 'x.png' });

      await expect(createBooking(second.id, input())).rejects.toMatchObject({ code: 'SLOT_TAKEN' });
    });

    it('rejects a time outside the pro\'s opening hours, on a blocked date, and in the past', async () => {
      const customer = await createUser('CUSTOMER');
      await expect(createBooking(customer.id, input({ startAt: at(day, 7).toISOString() }))).rejects.toMatchObject({ code: 'INVALID_SLOT' });
      await expect(createBooking(customer.id, input({ startAt: at(day, 17, 30).toISOString() }))).rejects.toMatchObject({ code: 'INVALID_SLOT' }); // runs past 18:00

      await prisma.blockedDate.create({ data: { professionalId: pro.profile.id, date: isoDateToDbDate(day), reason: 'Holiday' } });
      await expect(createBooking(customer.id, input())).rejects.toMatchObject({ code: 'INVALID_SLOT' });

      const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      await expect(createBooking(customer.id, input({ startAt: yesterday }))).rejects.toMatchObject({ code: 'DATE_IN_PAST' });
    });

    it('limits how many unpaid bookings one customer can hold', async () => {
      const customer = await createUser('CUSTOMER');
      for (let i = 0; i < MAX_UNPAID_BOOKINGS; i += 1) {
        await createBooking(customer.id, input({ startAt: at(day, 9 + i).toISOString() }));
      }
      await expect(createBooking(customer.id, input({ startAt: at(day, 14).toISOString() }))).rejects.toMatchObject({ code: 'TOO_MANY_UNPAID' });
    });

    it('does not accept services that belong to someone else or a mode the pro does not offer', async () => {
      const customer = await createUser('CUSTOMER');
      const homeOnly = await createVerifiedPro({ serviceMode: 'HOME' });
      await expect(createBooking(customer.id, input({ serviceIds: [999999] }))).rejects.toMatchObject({ code: 'INVALID_SERVICES' });
      await expect(
        createBooking(customer.id, { professionalId: homeOnly.profile.id, serviceIds: [homeOnly.bridal.id], mode: 'STORE', startAt: at(day, 10).toISOString() }),
      ).rejects.toMatchObject({ code: 'MODE_NOT_OFFERED' });
    });
  });

  describe('price snapshot', () => {
    it('stores the breakdown: services + travel fee = total, 20% deposit, balance on the day', async () => {
      const customer = await createUser('CUSTOMER');
      const booking = await createBooking(customer.id, homeInput({ serviceIds: [pro.bridal.id, pro.treatment.id] }));

      expect(booking.status).toBe('PENDING_DEPOSIT');
      expect(booking.pricing).toEqual({ subtotal: 2450, travelFee: 150, total: 2600, depositPct: 20, depositAmount: 520, balanceDue: 2080 });
      expect(booking.items.map((i) => i.name)).toEqual(['Bridal hairstyle', 'Hair treatment']);
      // 60 + 30 minutes
      expect(new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()).toBe(90 * 60_000);
      expect(booking.holdExpiresAt).toBeTruthy();
    });

    it('charges no travel fee for in-store bookings', async () => {
      const customer = await createUser('CUSTOMER');
      const booking = await createBooking(customer.id, input());
      expect(booking.pricing.travelFee).toBe(0);
      expect(booking.pricing.total).toBe(1800);
    });

    it('home service needs an address in an area the pro serves', async () => {
      const customer = await createUser('CUSTOMER');
      await expect(createBooking(customer.id, homeInput({ area: 'Liloan' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('is unaffected by later price or setting changes', async () => {
      const customer = await createUser('CUSTOMER');
      const booking = await createBooking(customer.id, input());
      await prisma.service.update({ where: { id: pro.bridal.id }, data: { price: 9999 } });
      await prisma.setting.update({ where: { id: 1 }, data: { depositPct: 50, commissionPct: 25 } });

      const stored = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(Number(stored.subtotal)).toBe(1800);
      expect(Number(stored.depositAmount)).toBe(360);
      expect(Number(stored.commissionPct)).toBe(10);
    });
  });

  describe('deposit, confirmation, completion and commission (full flow)', () => {
    let admin;
    let customer;

    const bookAndPay = async (overrides = {}) => {
      const booking = await createBooking(customer.id, homeInput({ serviceIds: [pro.bridal.id, pro.treatment.id], ...overrides }));
      await submitDeposit(customer.id, booking.id, { gcashRef: `REF${Math.floor(Math.random() * 1e9)}` }, { filename: 'shot.png' });
      return booking;
    };

    beforeEach(async () => {
      admin = await createUser('ADMIN');
      customer = await createUser('CUSTOMER', 'Ana Reyes');
    });

    it('walks PENDING_DEPOSIT -> DEPOSIT_SUBMITTED -> DEPOSIT_VERIFIED -> CONFIRMED -> COMPLETED and records the 10% commission', async () => {
      const booking = await bookAndPay();
      expect((await prisma.booking.findUnique({ where: { id: booking.id } })).status).toBe('DEPOSIT_SUBMITTED');

      const verified = await verifyDeposit(admin.id, booking.id);
      expect(verified.status).toBe('DEPOSIT_VERIFIED');

      const confirmed = await acceptBooking(pro.user.id, booking.id);
      expect(confirmed.status).toBe('CONFIRMED');

      const afterAppointment = new Date(new Date(booking.endAt).getTime() + 60_000);
      const done = await completeBooking(pro.user.id, booking.id, { now: afterAppointment });
      expect(done.status).toBe('COMPLETED');

      const earning = await prisma.bookingEarning.findUnique({ where: { bookingId: booking.id } });
      // gross = services only (1800 + 650); commission 10% of that; the 150 travel fee is NOT commissioned.
      expect(Number(earning.gross)).toBe(2450);
      expect(Number(earning.commissionAmount)).toBe(245);
      expect(Number(earning.travelFee)).toBe(150);
      expect(Number(earning.proNet)).toBe(2355);
    });

    it('creates a notification for each step that matters', async () => {
      const booking = await bookAndPay();
      await verifyDeposit(admin.id, booking.id);
      await acceptBooking(pro.user.id, booking.id);
      await completeBooking(pro.user.id, booking.id, { now: new Date(new Date(booking.endAt).getTime() + 60_000) });

      const types = async (userId) => (await prisma.notification.findMany({ where: { userId } })).map((n) => n.type).sort();
      expect(await types(admin.id)).toEqual(['DEPOSIT_SUBMITTED']);
      expect(await types(pro.user.id)).toEqual(['BOOKING_REQUESTED']);
      expect(await types(customer.id)).toEqual(['BOOKING_CONFIRMED', 'DEPOSIT_VERIFIED', 'REVIEW_REQUEST']);
    });

    it('cannot be completed twice, and a second earning is never written', async () => {
      const booking = await bookAndPay();
      await verifyDeposit(admin.id, booking.id);
      await acceptBooking(pro.user.id, booking.id);
      const after = { now: new Date(new Date(booking.endAt).getTime() + 60_000) };
      await completeBooking(pro.user.id, booking.id, after);

      await expect(completeBooking(pro.user.id, booking.id, after)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
      expect(await prisma.bookingEarning.count({ where: { bookingId: booking.id } })).toBe(1);
    });

    it('will not complete or no-show before the appointment (unless the demo switch is on)', async () => {
      const booking = await bookAndPay();
      await verifyDeposit(admin.id, booking.id);
      await acceptBooking(pro.user.id, booking.id);
      const beforeStart = { now: new Date(new Date(booking.startAt).getTime() - 3600_000) };

      await expect(completeBooking(pro.user.id, booking.id, beforeStart)).rejects.toMatchObject({ code: 'TOO_EARLY' });
      await expect(markNoShow(pro.user.id, booking.id, beforeStart)).rejects.toMatchObject({ code: 'TOO_EARLY' });
      expect(await prisma.bookingEarning.count()).toBe(0);
    });

    it('no-show records no earning', async () => {
      const booking = await bookAndPay();
      await verifyDeposit(admin.id, booking.id);
      await acceptBooking(pro.user.id, booking.id);
      const done = await markNoShow(pro.user.id, booking.id, { now: new Date(new Date(booking.endAt).getTime() + 60_000) });
      expect(done.status).toBe('NO_SHOW');
      expect(await prisma.bookingEarning.count()).toBe(0);
    });

    it('the pro cannot accept before the admin verified the deposit', async () => {
      const booking = await bookAndPay();
      await expect(acceptBooking(pro.user.id, booking.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    });

    it('declining a verified booking flags a refund for the admin and frees the slot', async () => {
      const booking = await bookAndPay();
      await verifyDeposit(admin.id, booking.id);

      const declined = await declineBooking(pro.user.id, booking.id, 'Family emergency');
      expect(declined.status).toBe('DECLINED');
      expect(declined.refundNeeded).toBe(true);
      expect(declined.declineReason).toBe('Family emergency');
      expect((await prisma.notification.findMany({ where: { userId: admin.id, type: 'REFUND_NEEDED' } })).length).toBe(1);

      const other = await createUser('CUSTOMER');
      await expect(createBooking(other.id, homeInput({ serviceIds: [pro.bridal.id, pro.treatment.id] }))).resolves.toBeTruthy();
    });

    it('a rejected deposit returns the booking to PENDING_DEPOSIT with a fresh hold and a note', async () => {
      const booking = await bookAndPay();
      const rejected = await rejectDeposit(admin.id, booking.id, 'Reference number does not match');
      expect(rejected.status).toBe('PENDING_DEPOSIT');
      expect(rejected.deposit.rejectNote).toBe('Reference number does not match');
      expect(rejected.deposit.gcashRef).toBeNull();

      await expect(submitDeposit(customer.id, booking.id, { gcashRef: 'REFRETRY01' }, { filename: 'again.png' })).resolves.toMatchObject({ status: 'DEPOSIT_SUBMITTED' });
    });

    it('one GCash reference number cannot be used for two bookings', async () => {
      const a = await createBooking(customer.id, input({ startAt: at(day, 10).toISOString() }));
      const b = await createBooking(customer.id, input({ startAt: at(day, 12).toISOString() }));
      await submitDeposit(customer.id, a.id, { gcashRef: 'SAMEREF123' }, { filename: 'a.png' });
      await expect(submitDeposit(customer.id, b.id, { gcashRef: 'SAMEREF123' }, { filename: 'b.png' })).rejects.toMatchObject({ code: 'REF_ALREADY_USED' });
    });

    it('a customer can only touch their own booking', async () => {
      const booking = await bookAndPay();
      const stranger = await createUser('CUSTOMER');
      await expect(cancelBooking(stranger.id, booking.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(submitDeposit(stranger.id, booking.id, { gcashRef: 'SOMETHING99' }, { filename: 'z.png' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('another pro cannot accept or complete this pro\'s booking', async () => {
      const booking = await bookAndPay();
      await verifyDeposit(admin.id, booking.id);
      const rival = await createVerifiedPro();
      await expect(acceptBooking(rival.user.id, booking.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('cancelling after the deposit was sent notifies the admin to settle it manually', async () => {
      const booking = await bookAndPay();
      await verifyDeposit(admin.id, booking.id);
      const cancelled = await cancelBooking(customer.id, booking.id);
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.depositPaidThenCancelled).toBe(true);
      const proNotes = await prisma.notification.findMany({ where: { userId: pro.user.id, type: 'BOOKING_CANCELLED' } });
      expect(proNotes).toHaveLength(1);
      expect((await prisma.notification.findMany({ where: { userId: admin.id, type: 'BOOKING_CANCELLED' } })).length).toBe(1);
    });

    it('cannot cancel once the appointment has started', async () => {
      const booking = await bookAndPay();
      const duringAppointment = { now: new Date(new Date(booking.startAt).getTime() + 60_000) };
      await expect(cancelBooking(customer.id, booking.id, duringAppointment)).rejects.toMatchObject({ code: 'ALREADY_STARTED' });
    });
  });
});
