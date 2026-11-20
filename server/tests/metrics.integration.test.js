import { describe, it, expect, beforeEach, afterAll, inject } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { createBooking, submitDeposit, cancelBooking } from '../src/services/booking.service.js';
import { acceptBooking, completeBooking, declineBooking, markNoShow, verifyDeposit } from '../src/services/bookingWorkflow.service.js';
import { createReview } from '../src/services/review.service.js';
import { getMetrics, median, rate } from '../src/services/metrics.service.js';
import { getEarnings } from '../src/services/proBookings.service.js';
import { updateSettings, getPublicSettings } from '../src/services/settings.service.js';
import { resetDatabase, createUser, createVerifiedPro, testDay, at } from './helpers/db.js';

const ready = inject('testDbReady');

describe('metric helpers', () => {
  it('rate() is null, not NaN or Infinity, when there is nothing to measure', () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(1, 4)).toBe(0.25);
  });

  it('median() handles odd, even and empty lists', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe.skipIf(!ready)('admin metrics and settings (integration, real MySQL)', () => {
  let day;
  let pro;
  let admin;
  let hour;
  let lastEnd;

  const book = async (customer, { occasion, pay = true, verify = true } = {}) => {
    hour += 1;
    const b = await createBooking(customer.id, {
      professionalId: pro.profile.id,
      serviceIds: [pro.bridal.id],
      mode: 'STORE',
      startAt: at(day, hour).toISOString(),
      ...(occasion && { occasion }),
    });
    lastEnd = new Date(b.endAt);
    if (pay) await submitDeposit(customer.id, b.id, { gcashRef: `M${Date.now()}${hour}` }, { filename: 'x.png' });
    if (pay && verify) await verifyDeposit(admin.id, b.id);
    return b;
  };
  const after = (b) => ({ now: new Date(new Date(b.endAt).getTime() + 60_000) });
  const complete = async (b) => {
    await acceptBooking(pro.user.id, b.id);
    await completeBooking(pro.user.id, b.id, after(b));
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

  it('reports zeros and nulls (not errors) on an empty platform', async () => {
    const m = await getMetrics();
    expect(m.verifiedPros.total).toBe(1);
    expect(m.completedThisMonth).toBe(0);
    expect(m.depositConversion.rate).toBeNull();
    expect(m.rating).toEqual({ average: null, count: 0 });
    expect(m.commissionThisMonth.amount).toBe(0);
    expect(m.extras.avgBookingValue).toBeNull();
  });

  it('computes every dashboard number from a known set of bookings', async () => {
    const [c1, c2, c3] = await Promise.all([1, 2, 3].map(() => createUser('CUSTOMER')));
    // An unverified pro must not count as verified.
    const unverified = await createVerifiedPro();
    await prisma.professionalProfile.update({ where: { id: unverified.profile.id }, data: { verificationStatus: 'PENDING' } });

    const a = await book(c1, { occasion: 'WEDDING' }); await complete(a); // completed, wedding
    const b = await book(c1); await complete(b); //                          completed (c1 is a repeat customer)
    const c = await book(c2); await complete(c); //                          completed
    const d = await book(c2); await acceptBooking(pro.user.id, d.id); await markNoShow(pro.user.id, d.id, after(d)); // no-show
    const e = await book(c3); await declineBooking(pro.user.id, e.id, 'Sick'); //                                     declined after payment
    const f = await book(c3, { pay: false }); //                             unpaid, hold still running (left out of requests)
    const g = await book(c3, { pay: false }); //                             unpaid, then cancelled
    await cancelBooking(c3.id, g.id);

    await createReview(c1.id, a.id, { rating: 5 });
    await createReview(c1.id, b.id, { rating: 4 });

    // The metrics run at a simulated "now" (just after the last appointment). Keep booking F's
    // unpaid hold alive at that moment, as it would be in real life.
    const simulatedNow = lastEnd;
    await prisma.booking.update({ where: { id: f.id }, data: { holdExpiresAt: new Date(simulatedNow.getTime() + 3600_000) } });

    const m = await getMetrics({ now: simulatedNow });

    expect(m.verifiedPros).toEqual({ total: 1 + 0 + 1 - 1 + 0 + 0 + 1 - 1, active: 1 }); // main pro only (the other helper pro is PENDING)
    expect(m.completedThisMonth).toBe(3);
    // 7 bookings, 1 still in its unpaid hold -> 6 requests; 5 had the deposit verified.
    expect(m.depositConversion).toEqual({ requests: 6, verified: 5, rate: 0.833 });
    expect(m.noShow).toEqual({ noShows: 1, settled: 4, rate: 0.25 });
    // 5 sent a deposit; 1 of them (the decline) ended without service. Cancelling an unpaid booking does not count.
    expect(m.cancellation).toEqual({ cancelled: 1, base: 5, rate: 0.2 });
    expect(m.rating).toEqual({ average: 4.5, count: 2 });
    expect(m.repeat).toEqual({ repeatCustomers: 1, customers: 2, rate: 0.5 });
    // 10% of 3 x 1,800 services
    expect(m.commissionThisMonth).toEqual({ amount: 540, bookings: 3 });
    expect(m.extras.avgBookingValue).toBe(1800);
    expect(m.extras.occasionShare).toBe(0.333); // 1 of 3 completed bookings was an occasion
    expect(m.extras.completionRate).toBe(0.6); // 3 completed out of 5 that ran their course (3 + 1 no-show + 1 declined)
    expect(m.extras.medianResponseHours).toBeLessThan(1);
  });

  it("the pro's earnings and the admin's commission agree", async () => {
    const customer = await createUser('CUSTOMER');
    const homeBooking = async () => {
      hour += 1;
      const b = await createBooking(customer.id, {
        professionalId: pro.profile.id, serviceIds: [pro.bridal.id, pro.treatment.id], mode: 'HOME',
        startAt: at(day, hour).toISOString(), address: '45 Mango Ave, Lahug', area: 'Cebu City',
      });
      await submitDeposit(customer.id, b.id, { gcashRef: `H${Date.now()}${hour}` }, { filename: 'x.png' });
      await verifyDeposit(admin.id, b.id);
      await complete(b);
      lastEnd = new Date(b.endAt);
    };
    await homeBooking();

    const earnings = await getEarnings(pro.user.id);
    expect(earnings.summary.allTime).toMatchObject({ completedBookings: 1, gross: 2450, commission: 245, travelFees: 150, net: 2355 });
    expect(earnings.rows[0]).toMatchObject({ gross: 2450, commissionAmount: 245, travelFee: 150, proNet: 2355 });

    const m = await getMetrics({ now: lastEnd });
    expect(m.commissionThisMonth.amount).toBe(earnings.summary.allTime.commission);
  });

  describe('settings', () => {
    it('a changed deposit % applies to new bookings only, and the public settings follow it', async () => {
      const customer = await createUser('CUSTOMER');
      const before = await book(customer, { pay: false });
      expect(before.pricing.depositPct).toBe(20);

      await updateSettings({ depositPct: 35, commissionPct: 12, holdMinutes: 60, gcashNumber: '0917 555 1234', gcashName: 'Gara Beauty Inc' });
      const after = await book(customer, { pay: false });

      expect(after.pricing).toMatchObject({ depositPct: 35, depositAmount: 630, balanceDue: 1170 });
      expect((await prisma.booking.findUnique({ where: { id: before.id } })).depositPct.toString()).toBe('20');
      expect(Number((await prisma.booking.findUnique({ where: { id: after.id } })).commissionPct)).toBe(12);
      expect(await getPublicSettings()).toMatchObject({ depositPct: 35, commissionPct: 12, gcashNumber: '0917 555 1234', gcashName: 'Gara Beauty Inc' });
    });

    it('commission follows the rate the booking was made with, even if the setting changes before completion', async () => {
      const customer = await createUser('CUSTOMER');
      const b = await book(customer);
      await updateSettings({ depositPct: 20, commissionPct: 25, holdMinutes: 120, gcashNumber: '0917 000 0000', gcashName: 'Gara' });
      await complete(b);
      const earning = await prisma.bookingEarning.findUnique({ where: { bookingId: b.id } });
      expect(Number(earning.commissionAmount)).toBe(180); // still 10% of 1,800
    });
  });
});
