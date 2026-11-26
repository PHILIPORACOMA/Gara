import { describe, it, expect, beforeEach, afterAll, inject } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { signToken } from '../src/services/auth.service.js';
import { getDiscoveryMetrics, getProInsights } from '../src/services/contact.service.js';
import { resetDatabase, createUser, createVerifiedPro } from './helpers/db.js';

const ready = inject('testDbReady');

// Discovery version end to end through the HTTP API: search, view, contact (workbook v3).
describe.skipIf(!ready)('discovery and contact (integration, real MySQL)', () => {
  let pro;
  let customer;
  const auth = (user) => ({ Authorization: `Bearer ${signToken(user)}` });

  beforeEach(async () => {
    await resetDatabase();
    await prisma.searchEvent.deleteMany();
    pro = await createVerifiedPro();
    await prisma.professionalProfile.update({
      where: { id: pro.profile.id },
      data: { messengerUrl: 'https://m.me/marareyes', contactPhone: '+639171234567' },
    });
    customer = await createUser('CUSTOMER', 'Bea Santos');
  });

  afterAll(async () => {
    await resetDatabase();
    await prisma.searchEvent.deleteMany();
    await prisma.$disconnect();
  });

  it('the public profile shows which contact buttons exist but never the number or link', async () => {
    const res = await request(app).get(`/api/professionals/${pro.profile.id}`);
    expect(res.status).toBe(200);
    expect(res.body.professional.contact).toEqual({ messenger: true, call: true, sms: true });
    expect(JSON.stringify(res.body)).not.toContain('9171234567');
    expect(JSON.stringify(res.body)).not.toContain('m.me/marareyes');
    expect(res.body.professional.availability.length).toBe(7);
  });

  it('contacting a pro requires a signed-in customer', async () => {
    const url = `/api/professionals/${pro.profile.id}/contact`;
    expect((await request(app).post(url).send({ channel: 'CALL' })).status).toBe(401);
    const otherPro = await createVerifiedPro();
    expect((await request(app).post(url).set(auth(otherPro.user)).send({ channel: 'CALL' })).status).toBe(403);
    expect(await prisma.contactEvent.count()).toBe(0);
  });

  it('a customer tap returns the link to open and is counted', async () => {
    const url = `/api/professionals/${pro.profile.id}/contact`;
    const m = await request(app).post(url).set(auth(customer)).send({ channel: 'MESSENGER' });
    const c = await request(app).post(url).set(auth(customer)).send({ channel: 'CALL' });
    const s = await request(app).post(url).set(auth(customer)).send({ channel: 'SMS' });
    expect([m.body.href, c.body.href, s.body.href]).toEqual(['https://m.me/marareyes', 'tel:+639171234567', 'sms:+639171234567']);
    const events = await prisma.contactEvent.findMany({ orderBy: { id: 'asc' } });
    expect(events.map((e) => e.channel)).toEqual(['MESSENGER', 'CALL', 'SMS']);
    expect(events.every((e) => e.customerId === customer.id && e.professionalId === pro.profile.id)).toBe(true);
  });

  it('a channel the pro did not set up is refused, and nothing is counted', async () => {
    await prisma.professionalProfile.update({ where: { id: pro.profile.id }, data: { contactPhone: null } });
    const res = await request(app).post(`/api/professionals/${pro.profile.id}/contact`).set(auth(customer)).send({ channel: 'SMS' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CHANNEL_UNAVAILABLE');
    expect(await prisma.contactEvent.count()).toBe(0);
  });

  it('unverified pros cannot be contacted', async () => {
    await prisma.professionalProfile.update({ where: { id: pro.profile.id }, data: { verificationStatus: 'PENDING' } });
    const res = await request(app).post(`/api/professionals/${pro.profile.id}/contact`).set(auth(customer)).send({ channel: 'CALL' });
    expect(res.status).toBe(404);
  });

  it('counts profile views (visitors and customers) but not the pro viewing their own profile', async () => {
    await request(app).get(`/api/professionals/${pro.profile.id}`);
    await request(app).get(`/api/professionals/${pro.profile.id}`).set(auth(customer));
    await request(app).get(`/api/professionals/${pro.profile.id}`).set(auth(pro.user));
    const views = await prisma.profileView.findMany({ orderBy: { id: 'asc' } });
    expect(views.map((v) => v.viewerId)).toEqual([null, customer.id]);
  });

  it('counts searches from the Find a pro page only', async () => {
    await request(app).get('/api/professionals?category=HAIR&source=search');
    await request(app).get('/api/professionals'); // home page list
    const searches = await prisma.searchEvent.findMany();
    expect(searches).toHaveLength(1);
    expect(searches[0]).toMatchObject({ category: 'HAIR', resultCount: 1 });
  });

  it('booking routes are switched off in the discovery version', async () => {
    expect((await request(app).get('/api/bookings').set(auth(customer))).status).toBe(404);
    expect((await request(app).get(`/api/professionals/${pro.profile.id}/reviews`)).status).toBe(404);
  });

  it('pro insights and admin metrics add up', async () => {
    for (let i = 0; i < 4; i += 1) await request(app).get(`/api/professionals/${pro.profile.id}`).set(auth(customer));
    await request(app).get('/api/professionals?source=search');
    await request(app).get('/api/professionals?area=Cebu%20City&source=search');
    const url = `/api/professionals/${pro.profile.id}/contact`;
    await request(app).post(url).set(auth(customer)).send({ channel: 'MESSENGER' });

    const insights = await getProInsights(pro.user.id);
    expect(insights.last7).toMatchObject({ views: 4, contactRate: 0.25 });
    expect(insights.last7.contacts).toMatchObject({ MESSENGER: 1, CALL: 0, SMS: 0, total: 1 });
    expect(insights.availabilityStale).toBe(true); // never updated by the pro

    await request(app).put('/api/pro/availability').set(auth(pro.user)).send({ rules: [{ dayOfWeek: 1, startMin: 540, endMin: 1080 }] });
    expect((await getProInsights(pro.user.id)).availabilityStale).toBe(false);

    const m = await getDiscoveryMetrics();
    expect(m.verifiedPros).toMatchObject({ total: 1, perCategory: { HAIR: 1, NAILS: 0, MAKEUP: 0 } });
    expect(m.last30Days).toMatchObject({ searches: 2, profileViews: 4, searchToContactRate: 0.5, viewToContactRate: 0.25 });
    expect(m.availabilityUpdatedWeekly).toMatchObject({ pros: 1, of: 1, rate: 1 });
    expect(m.returningCustomers).toMatchObject({ returning: 0, of: 1 });
  });
});
