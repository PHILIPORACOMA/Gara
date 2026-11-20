// Demo data so the app looks alive right after setup.
//
//   npm run db:seed
//
// WARNING: this WIPES every table first and then inserts the demo data, so it always starts
// from the same known state. Never run it against a database with real data. It refuses to
// run when NODE_ENV=production.
//
// Every demo account uses the same password (DEMO_PASSWORD); the logins are listed in the
// root README and printed at the end of this script.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { calculateEarning, calculatePricing } from '../src/services/pricing.js';
import { manilaMinutesToDate, nowManila } from '../src/utils/time.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed: NODE_ENV=production (the seed wipes all data).');
  process.exit(1);
}

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Gara1234!';
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
const DEPOSIT_PCT = 20;
const COMMISSION_PCT = 10;
const HOLD_MINUTES = 120;

// ------------------------------------------------------------------ files

// Minimal PNG encoder (solid colour with a light border) for placeholder ID/receipt images.
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}
function makePng(width, height, [r, g, b]) {
  const row = Buffer.alloc(1 + width * 3);
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y += 1) {
    const edge = y < 6 || y >= height - 6;
    for (let x = 0; x < width; x += 1) {
      const border = edge || x < 6 || x >= width - 6;
      const o = y * row.length + 1 + x * 3;
      raw[o] = border ? 255 : r;
      raw[o + 1] = border ? 255 : g;
      raw[o + 2] = border ? 255 : b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const PALETTES = [
  ['#ffd1dc', '#e8386f'], ['#ffe5b4', '#c99532'], ['#d4e4ff', '#5a7fd6'], ['#e3d4ff', '#8a5ad6'],
  ['#d4f5e4', '#2f9e6b'], ['#ffd9c7', '#e5703c'], ['#f9d4f0', '#c0449e'], ['#dff1ff', '#3b82c4'],
];

// Placeholder portfolio picture (SVG) so profiles are not empty. Real uploads are JPG/PNG/WebP.
function portfolioSvg(category, [light, dark], variant) {
  const shapes = {
    HAIR: Array.from({ length: 7 }, (_, i) => `<path d="M${40 + i * 38} 20 C ${10 + i * 38} 110, ${90 + i * 38} 170, ${40 + i * 38} 300" stroke="${dark}" stroke-width="${6 + (i % 3) * 3}" fill="none" stroke-linecap="round" opacity="${0.35 + (i % 4) * 0.15}"/>`).join(''),
    NAILS: Array.from({ length: 5 }, (_, i) => `<rect x="${24 + i * 56}" y="${90 + (i % 2) * 24}" width="40" height="${96 - (i % 2) * 10}" rx="20" fill="${dark}" opacity="${0.45 + i * 0.1}"/>`).join(''),
    MAKEUP: `<circle cx="100" cy="150" r="52" fill="${dark}" opacity="0.5"/><circle cx="190" cy="120" r="38" fill="${dark}" opacity="0.7"/><ellipse cx="230" cy="215" rx="46" ry="26" fill="${dark}" opacity="0.4"/>`,
  }[category];
  const label = { HAIR: 'Hair', NAILS: 'Nails', MAKEUP: 'Makeup' }[category];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="${label} sample ${variant}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs><rect width="320" height="320" fill="url(#g)"/>${shapes}<text x="160" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="${dark}">${label} look ${variant}</text></svg>`;
}

function ensureDirs() {
  for (const d of ['public/portfolio', 'public/qr', 'private/id', 'private/deposit']) fs.mkdirSync(path.join(UPLOAD_DIR, d), { recursive: true });
}

// Delete every uploaded file that the database points to (they belong to the data being wiped).
async function removeReferencedFiles() {
  const [portfolio, pros, bookings, settings] = await Promise.all([
    prisma.portfolioImage.findMany({ select: { path: true } }),
    prisma.professionalProfile.findMany({ select: { idImagePath: true } }),
    prisma.booking.findMany({ select: { depositScreenshotPath: true } }),
    prisma.setting.findMany({ select: { gcashQrPath: true } }),
  ]);
  const rel = [
    ...portfolio.map((p) => `public/${p.path}`),
    ...pros.map((p) => p.idImagePath && `private/${p.idImagePath}`),
    ...bookings.map((b) => b.depositScreenshotPath && `private/${b.depositScreenshotPath}`),
    ...settings.map((s) => s.gcashQrPath && `public/${s.gcashQrPath}`),
  ].filter(Boolean);
  for (const r of new Set(rel)) fs.rmSync(path.join(UPLOAD_DIR, r), { force: true });
}

async function wipe() {
  await removeReferencedFiles();
  // Children before parents.
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.bookingEarning.deleteMany();
  await prisma.bookingItem.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.availabilityRule.deleteMany();
  await prisma.blockedDate.deleteMany();
  await prisma.portfolioImage.deleteMany();
  await prisma.service.deleteMany();
  await prisma.professionalCategory.deleteMany();
  await prisma.professionalArea.deleteMany();
  await prisma.professionalProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();
}

// ------------------------------------------------------------------ demo content

const CUSTOMERS = [
  { key: 'ana', name: 'Ana Reyes', email: 'ana@gara.test', phone: '0917 301 4455' },
  { key: 'ben', name: 'Benjie Cruz', email: 'ben@gara.test', phone: '0918 222 7788' },
  { key: 'carla', name: 'Carla Mendoza', email: 'carla@gara.test', phone: '0927 555 1290' },
];

const MON_SAT_9_6 = [1, 2, 3, 4, 5, 6].map((d) => [d, 540, 1080]);
const lunchBreak = (days) => days.flatMap((d) => [[d, 540, 720], [d, 780, 1080]]);

const PROS = [
  {
    key: 'mara', email: 'mara@gara.test', name: 'Mara Reyes', displayName: 'Mara Reyes Hair Studio', phone: '0917 880 1201',
    bio: 'Bridal and event hairstylist with 8 years of experience. Soft waves, sleek updos and long-lasting color. Studio in Colon, or I come to you.',
    categories: ['HAIR'], areas: ['Cebu City', 'Mandaue City'], mode: 'BOTH', address: '2nd Floor, Gaisano Metro Colon, Osmeña Blvd, Cebu City', travelFee: 200,
    availability: lunchBreak([1, 2, 3, 4, 5, 6]),
    services: [
      ['Haircut and blow-dry', 'HAIR', 450, 45, 'Wash, cut and styled blow-dry.'],
      ['Full hair color', 'HAIR', 2200, 150, 'Single-color application. Price for shoulder length hair.'],
      ['Rebond', 'HAIR', 2800, 180, 'Straightening treatment for smooth, shiny hair.'],
      ['Bridal hairstyle', 'HAIR', 1800, 90, 'Updo or soft waves, with a quick trial discussion.'],
      ['Keratin treatment', 'HAIR', 2500, 120, 'Reduces frizz and adds shine for up to 3 months.'],
    ],
  },
  {
    key: 'jun', email: 'jun@gara.test', name: 'Jun Cabahug', displayName: 'Jun Cabahug Hair and Beauty', phone: '0922 410 7765',
    bio: 'Clean cuts, balayage and hair spa in Mandaue. Walk in with a photo and walk out with the look.',
    categories: ['HAIR'], areas: ['Mandaue City', 'Cebu City', 'Consolacion'], mode: 'STORE', address: 'Unit 4, A. C. Cortes Ave, Mandaue City', travelFee: 0,
    availability: MON_SAT_9_6,
    services: [
      ['Haircut', 'HAIR', 300, 30, 'Cut and finish.'],
      ['Hair spa', 'HAIR', 700, 60, 'Deep-conditioning spa with scalp massage.'],
      ['Balayage', 'HAIR', 3800, 180, 'Hand-painted highlights. Toner included.'],
    ],
  },
  {
    key: 'lia', email: 'lia@gara.test', name: 'Lia Alcoseba', displayName: 'Lia Alcoseba Nails', phone: '0919 633 2048',
    bio: 'Home-service nail technician. Gel, soft-gel extensions and custom nail art, done in the comfort of your home.',
    categories: ['NAILS'], areas: ['Cebu City', 'Talisay City', 'Minglanilla'], mode: 'HOME', address: null, travelFee: 150,
    availability: [[2, 600, 1140], [3, 600, 1140], [4, 600, 1140], [5, 600, 1140], [6, 540, 1080], [7, 540, 1080]],
    services: [
      ['Gel manicure', 'NAILS', 550, 60, 'Gel polish with cuticle care.'],
      ['Gel pedicure', 'NAILS', 650, 60, 'Gel polish with foot scrub.'],
      ['Mani and pedi combo', 'NAILS', 950, 105, 'Gel manicure and pedicure together.'],
      ['Nail art (per set)', 'NAILS', 350, 45, 'Custom design on top of any service.'],
      ['Soft gel extensions', 'NAILS', 1200, 120, 'Natural-looking length and shape.'],
    ],
  },
  {
    key: 'chelsea', email: 'chelsea@gara.test', name: 'Chelsea Ong', displayName: 'Chelsea Nail Bar', phone: '0917 912 3340',
    bio: 'Cozy nail bar in Lapu-Lapu. Classic and acrylic sets, spotless tools and friendly service.',
    categories: ['NAILS'], areas: ['Lapu-Lapu City', 'Cordova', 'Mandaue City'], mode: 'STORE', address: 'Ground Floor, Gaisano Grand Mall, Lapu-Lapu City', travelFee: 0,
    availability: [[1, 600, 1200], [2, 600, 1200], [3, 600, 1200], [4, 600, 1200], [5, 600, 1200], [6, 600, 1200], [7, 600, 1080]],
    services: [
      ['Classic manicure', 'NAILS', 250, 30, 'Shape, cuticle care and regular polish.'],
      ['Classic pedicure', 'NAILS', 300, 45, 'Soak, scrub and regular polish.'],
      ['Gel polish', 'NAILS', 450, 45, 'Long-lasting gel color.'],
      ['Acrylic set', 'NAILS', 1300, 120, 'Full acrylic set with your choice of shape.'],
    ],
  },
  {
    key: 'bea', email: 'bea@gara.test', name: 'Bea Fernandez', displayName: 'Bea Fernandez Makeup', phone: '0928 700 5612',
    bio: 'Bridal and debut makeup artist. Long-wear, camera-ready glam that still looks like you. Available for early-morning call times.',
    categories: ['MAKEUP'], areas: ['Cebu City', 'Mandaue City', 'Lapu-Lapu City'], mode: 'BOTH', address: 'Banilad Town Centre, Banilad, Cebu City', travelFee: 300,
    availability: [[1, 480, 1140], [2, 480, 1140], [3, 480, 1140], [4, 480, 1140], [5, 480, 1140], [6, 480, 1140]],
    services: [
      ['Soft glam', 'MAKEUP', 1500, 60, 'Polished everyday-to-event makeup.'],
      ['Bridal makeup', 'MAKEUP', 5500, 120, 'Includes lashes and touch-up kit. Trial is a separate booking.'],
      ['Debut makeup', 'MAKEUP', 3500, 90, 'For debutantes and their court.'],
      ['Graduation makeup', 'MAKEUP', 1800, 60, 'Camera-ready for the big day.'],
      ['Photoshoot makeup', 'MAKEUP', 2500, 75, 'Editorial-style makeup for shoots.'],
    ],
  },
  {
    key: 'kiko', email: 'kiko@gara.test', name: 'Kiko Dizon', displayName: 'Kiko Dizon Makeup Artistry', phone: '0915 288 9031',
    bio: 'Makeup artist who comes to you. Natural looks to full party glam, for weddings, birthdays and nights out.',
    categories: ['MAKEUP'], areas: ['Talisay City', 'Cebu City', 'Minglanilla', 'Naga City'], mode: 'HOME', address: null, travelFee: 250,
    availability: [[3, 600, 1200], [4, 600, 1200], [5, 600, 1200], [6, 540, 1200], [7, 540, 1200]],
    services: [
      ['Natural makeup', 'MAKEUP', 1200, 45, 'Fresh, skin-like finish.'],
      ['Party glam', 'MAKEUP', 1800, 60, 'Bold and long-lasting for the night.'],
      ['Bridal makeup', 'MAKEUP', 6000, 120, 'Full bridal look with lashes.'],
    ],
  },
  {
    key: 'tin', email: 'tin@gara.test', name: 'Tin Alvarez', displayName: 'Glow by Tin', phone: '0926 144 7720',
    bio: 'Hair, makeup and nails from one person, perfect for events when you want a complete look in a single appointment.',
    categories: ['HAIR', 'MAKEUP', 'NAILS'], areas: ['Cebu City', 'Mandaue City', 'Consolacion', 'Liloan'], mode: 'BOTH', address: 'Unit 12, The Terraces, Nivel Hills, Lahug, Cebu City', travelFee: 250,
    availability: MON_SAT_9_6,
    services: [
      ['Haircut', 'HAIR', 500, 45, 'Cut and style.'],
      ['Bridal hairstyle', 'HAIR', 2000, 90, 'Updo or waves for the big day.'],
      ['Soft glam makeup', 'MAKEUP', 1600, 60, 'Polished, natural glam.'],
      ['Gel manicure', 'NAILS', 600, 60, 'Gel polish with cuticle care.'],
    ],
  },
  {
    key: 'sofia', email: 'sofia@gara.test', name: 'Sofia Tan', displayName: 'Sofia Tan Hair and Makeup', phone: '0917 455 6128',
    bio: 'Hair color specialist and event makeup artist. Debuts, graduations and photoshoots are my favorite.',
    categories: ['HAIR', 'MAKEUP'], areas: ['Cebu City', 'Talisay City', 'Naga City'], mode: 'BOTH', address: 'Mabolo Garden Flats, Mabolo, Cebu City', travelFee: 300,
    availability: [[1, 540, 1080], [2, 540, 1080], [4, 540, 1080], [5, 540, 1080], [6, 540, 1080], [7, 600, 960]],
    services: [
      ['Haircut', 'HAIR', 500, 45, 'Cut and blow-dry.'],
      ['Hair color', 'HAIR', 2500, 150, 'Full color, any shade.'],
      ['Event makeup', 'MAKEUP', 2800, 90, 'Debuts, grad balls and formal events.'],
    ],
  },
  {
    // Not yet verified: shows up in the admin verification queue.
    key: 'dani', email: 'dani@gara.test', name: 'Dani Villamor', displayName: 'Dani Villamor Nail Studio', phone: '0920 377 4410', status: 'PENDING',
    bio: 'Newly joined nail artist specializing in minimalist and Korean-style designs.',
    categories: ['NAILS'], areas: ['Cebu City', 'Mandaue City'], mode: 'BOTH', address: 'Escario St, Cebu City', travelFee: 150,
    availability: MON_SAT_9_6,
    services: [
      ['Gel manicure', 'NAILS', 500, 60, 'Gel polish with cuticle care.'],
      ['Korean nail art', 'NAILS', 900, 90, 'Minimalist designs with chrome or cat-eye effects.'],
    ],
  },
];

// Past (COMPLETED, reviewed), NO_SHOW, DECLINED and live bookings.
// day is "days from today" (negative = past); hour is the Manila start time.
const BOOKINGS = [
  { c: 'ana', p: 'mara', s: [3], mode: 'STORE', day: -42, hour: 10, status: 'COMPLETED', occasion: 'WEDDING', rating: 5, comment: 'Mara did my bridal updo and it lasted the whole day, even through the dancing. Super patient with my 20 hairpin requests!' },
  { c: 'ana', p: 'mara', s: [0, 1], mode: 'STORE', day: -20, hour: 14, status: 'COMPLETED', rating: 5, comment: 'Best haircut and color I have had in Cebu. She actually listens and explains what suits my skin tone.' },
  { c: 'ben', p: 'mara', s: [2], mode: 'STORE', day: -12, hour: 9, status: 'COMPLETED', rating: 4, comment: 'Rebond came out really straight and shiny. Took a bit longer than expected but worth it.' },
  { c: 'carla', p: 'bea', s: [1], mode: 'HOME', day: -35, hour: 8, status: 'COMPLETED', occasion: 'WEDDING', rating: 5, comment: 'Bea arrived on time at 8 AM, set up in our living room and my makeup stayed perfect from ceremony to the last dance. Photos looked amazing.' },
  { c: 'carla', p: 'bea', s: [3], mode: 'HOME', day: -9, hour: 9, status: 'COMPLETED', occasion: 'GRADUATION', rating: 5, comment: 'Natural but polished, exactly what I asked for. My mom cried happy tears at the photos.' },
  { c: 'ben', p: 'bea', s: [0], mode: 'STORE', day: -30, hour: 14, status: 'NO_SHOW' },
  { c: 'ana', p: 'lia', s: [2], mode: 'HOME', day: -15, hour: 13, status: 'COMPLETED', rating: 5, comment: 'So convenient to get mani and pedi at home. Clean tools, neat finish, and she brought her own lamp and chair.' },
  { c: 'ben', p: 'lia', s: [4], mode: 'HOME', day: -6, hour: 10, status: 'COMPLETED', rating: 4, comment: 'Soft gel extensions look natural. One nail lifted after a week but she fixed it for free.' },
  { c: 'ana', p: 'chelsea', s: [3], mode: 'STORE', day: -28, hour: 11, status: 'COMPLETED', rating: 4, comment: 'Cute shop and a really nice acrylic set. A little wait at the start but the result was great.' },
  { c: 'carla', p: 'chelsea', s: [0, 1], mode: 'STORE', day: -8, hour: 15, status: 'COMPLETED', rating: 5, comment: 'Affordable and so clean. My go-to for regular mani and pedi now.' },
  { c: 'ben', p: 'jun', s: [0], mode: 'STORE', day: -18, hour: 10, status: 'COMPLETED', rating: 5, comment: 'Quick, sharp haircut every time. Jun remembers how I like it.' },
  { c: 'carla', p: 'jun', s: [2], mode: 'STORE', day: -11, hour: 9, status: 'COMPLETED', rating: 4, comment: 'Beautiful balayage, soft and natural. It is a long session so bring a charger!' },
  { c: 'ana', p: 'kiko', s: [1], mode: 'HOME', day: -22, hour: 16, status: 'COMPLETED', occasion: 'BIRTHDAY', rating: 5, comment: 'Kiko made me feel so confident for my birthday dinner. The glam lasted until 2 AM!' },
  { c: 'ben', p: 'kiko', s: [0], mode: 'HOME', day: -5, hour: 10, status: 'COMPLETED', rating: 3, comment: 'Nice natural look but he arrived 20 minutes late because of traffic. Would book again with an earlier slot.' },
  { c: 'ana', p: 'tin', s: [0, 3, 2], mode: 'STORE', day: -14, hour: 10, status: 'COMPLETED', occasion: 'PHOTOSHOOT', rating: 5, comment: 'Hair, nails and makeup in one go before our photoshoot, and it all matched. Huge time saver.' },
  { c: 'carla', p: 'sofia', s: [2, 0], mode: 'HOME', day: -10, hour: 13, status: 'COMPLETED', occasion: 'DEBUT', rating: 5, comment: 'Sofia did my cousin\'s debut makeup and my haircut at home. Everyone asked who did it!' },
  { c: 'ben', p: 'sofia', s: [1], mode: 'STORE', day: -3, hour: 10, status: 'COMPLETED', rating: 4, comment: 'Color is exactly the shade I showed her. Studio is easy to find.' },
  // Live bookings
  { c: 'carla', p: 'tin', s: [1], mode: 'STORE', day: 6, hour: 10, status: 'DECLINED', occasion: 'OTHER', declineReason: 'Sorry, I am down with the flu', refundNeeded: true },
  { c: 'ana', p: 'mara', s: [0], mode: 'STORE', day: 3, hour: 10, status: 'CONFIRMED' },
  { c: 'carla', p: 'mara', s: [4], mode: 'STORE', day: 4, hour: 14, status: 'DEPOSIT_VERIFIED' },
  { c: 'ben', p: 'lia', s: [1], mode: 'HOME', day: 5, hour: 13, status: 'DEPOSIT_SUBMITTED' },
  { c: 'ana', p: 'bea', s: [0], mode: 'HOME', day: 7, hour: 9, status: 'PENDING_DEPOSIT', occasion: 'OTHER' },
];

// ------------------------------------------------------------------ builders

// First day on or after `fromDay` (days from today) when the pro's weekly hours cover the whole appointment.
function nextWorkingDay(proDef, fromDay, startMin, endMin) {
  for (let d = fromDay; d < fromDay + 14; d += 1) {
    const day = nowManila().plus({ days: d });
    if (proDef.availability.some(([dow, s, e]) => dow === day.weekday && s <= startMin && e >= endMin)) return day.toISODate();
  }
  return nowManila().plus({ days: fromDay }).toISODate();
}

async function main() {
  ensureDirs();
  await wipe();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.setting.create({
    data: { id: 1, depositPct: DEPOSIT_PCT, commissionPct: COMMISSION_PCT, holdMinutes: HOLD_MINUTES, gcashNumber: '0917 123 4567', gcashName: 'Gara Beauty (demo)' },
  });
  await prisma.user.create({ data: { email: 'admin@gara.test', name: 'Gara Admin', passwordHash, role: 'ADMIN', phone: '0917 000 0001' } });

  const customers = {};
  for (const c of CUSTOMERS) {
    customers[c.key] = await prisma.user.create({ data: { email: c.email, name: c.name, phone: c.phone, passwordHash, role: 'CUSTOMER' } });
  }

  // One shared placeholder receipt image for every demo GCash screenshot.
  const receiptName = `${randomUUID()}.png`;
  fs.writeFileSync(path.join(UPLOAD_DIR, 'private/deposit', receiptName), makePng(280, 360, [236, 244, 255]));

  const pros = {};
  for (const [index, def] of PROS.entries()) {
    const user = await prisma.user.create({ data: { email: def.email, name: def.name, phone: def.phone, passwordHash, role: 'PROFESSIONAL' } });

    const idName = `${randomUUID()}.png`;
    fs.writeFileSync(path.join(UPLOAD_DIR, 'private/id', idName), makePng(320, 200, [222, 226, 232]));

    const approved = (def.status ?? 'APPROVED') === 'APPROVED';
    const profile = await prisma.professionalProfile.create({
      data: {
        userId: user.id,
        displayName: def.displayName,
        bio: def.bio,
        serviceMode: def.mode,
        storeAddress: def.address,
        travelFee: def.travelFee,
        verificationStatus: approved ? 'APPROVED' : 'PENDING',
        idImagePath: `id/${idName}`,
        submittedAt: nowManila().minus({ days: approved ? 60 : 1 }).toJSDate(),
        verifiedAt: approved ? nowManila().minus({ days: 55 - index }).toJSDate() : null,
        categories: { create: def.categories.map((category) => ({ category })) },
        areas: { create: def.areas.map((area) => ({ area })) },
        availability: { create: def.availability.map(([dayOfWeek, startMin, endMin]) => ({ dayOfWeek, startMin, endMin })) },
        services: { create: def.services.map(([name, category, price, durationMin, description]) => ({ name, category, price, durationMin, description })) },
      },
      include: { services: { orderBy: { id: 'asc' } } },
    });

    // Three placeholder portfolio pictures, one per category the pro offers (cycled).
    for (let i = 0; i < 3; i += 1) {
      const category = def.categories[i % def.categories.length];
      const file = `seed-${def.key}-${i + 1}.svg`;
      fs.writeFileSync(path.join(UPLOAD_DIR, 'public/portfolio', file), portfolioSvg(category, PALETTES[(index + i) % PALETTES.length], i + 1));
      await prisma.portfolioImage.create({ data: { professionalId: profile.id, path: `portfolio/${file}`, sortOrder: i + 1 } });
    }
    pros[def.key] = { def, user, profile, services: profile.services };
  }

  // Bookings, reviews, earnings.
  const now = new Date();
  const refTag = String(Date.now()).slice(-6);
  const reviewTotals = {};
  let n = 0;
  for (const b of BOOKINGS) {
    n += 1;
    const pro = pros[b.p];
    const customer = customers[b.c];
    const chosen = b.s.map((i) => pro.services[i]);
    const pricing = calculatePricing({ servicePrices: chosen.map((s) => s.price), travelFee: pro.profile.travelFee, mode: b.mode, depositPct: DEPOSIT_PCT });
    const durationMin = chosen.reduce((sum, s) => sum + s.durationMin, 0);
    // Future bookings are moved to the next day this pro actually works at that time.
    const isoDay = b.day > 0 ? nextWorkingDay(pro.def, b.day, b.hour * 60, b.hour * 60 + durationMin) : nowManila().plus({ days: b.day }).toISODate();
    const startAt = manilaMinutesToDate(isoDay, b.hour * 60);
    const endAt = new Date(startAt.getTime() + durationMin * 60_000);
    const hoursAfter = (date, h) => new Date(date.getTime() + h * 3600_000);

    const paidStatuses = ['DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'DECLINED'];
    const paid = paidStatuses.includes(b.status);
    const verified = ['DEPOSIT_VERIFIED', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'DECLINED'].includes(b.status);
    const responded = ['CONFIRMED', 'COMPLETED', 'NO_SHOW', 'DECLINED'].includes(b.status);
    const submittedAt = paid ? new Date(Math.min(now.getTime() - 3600_000, startAt.getTime() - 3 * 86_400_000)) : null;

    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        professionalId: pro.profile.id,
        mode: b.mode,
        address: b.mode === 'HOME' ? `${10 + n} Sampaguita St., Barangay ${['Lahug', 'Banilad', 'Mabolo', 'Guadalupe'][n % 4]}` : null,
        area: b.mode === 'HOME' ? pro.def.areas[0] : null,
        occasion: b.occasion ?? null,
        notes: b.occasion === 'WEDDING' ? 'Please bring a hair dryer. Wedding at 2 PM.' : null,
        startAt,
        endAt,
        status: b.status,
        subtotal: pricing.subtotal,
        travelFee: pricing.travelFee,
        total: pricing.total,
        depositPct: pricing.depositPct,
        depositAmount: pricing.depositAmount,
        balanceDue: pricing.balanceDue,
        commissionPct: COMMISSION_PCT,
        gcashRef: paid ? `GC${refTag}${String(n).padStart(3, '0')}` : null,
        depositScreenshotPath: paid ? `deposit/${receiptName}` : null,
        depositSubmittedAt: submittedAt,
        depositVerifiedAt: verified ? hoursAfter(submittedAt, 2) : null,
        respondedAt: responded ? hoursAfter(submittedAt, 5) : null,
        declineReason: b.declineReason ?? null,
        refundNeeded: Boolean(b.refundNeeded),
        holdExpiresAt: b.status === 'PENDING_DEPOSIT' ? hoursAfter(now, 2) : null,
        completedAt: b.status === 'COMPLETED' ? hoursAfter(endAt, 0.5) : null,
        createdAt: paid ? hoursAfter(submittedAt, -1) : now,
        items: { create: chosen.map((s, i) => ({ serviceId: s.id, name: s.name, category: s.category, price: s.price, durationMin: s.durationMin, sortOrder: i })) },
      },
    });

    if (b.status === 'COMPLETED') {
      const earning = calculateEarning({ subtotal: pricing.subtotal, travelFee: pricing.travelFee, commissionPct: COMMISSION_PCT });
      await prisma.bookingEarning.create({ data: { bookingId: booking.id, ...earning, createdAt: hoursAfter(endAt, 0.5) } });
      await prisma.review.create({
        data: { bookingId: booking.id, customerId: customer.id, professionalId: pro.profile.id, rating: b.rating, comment: b.comment, createdAt: hoursAfter(endAt, 20) },
      });
      (reviewTotals[pro.profile.id] ??= []).push(b.rating);
    }
  }

  // Ratings shown on pro cards.
  for (const [profileId, ratings] of Object.entries(reviewTotals)) {
    const avg = ratings.reduce((a, c) => a + c, 0) / ratings.length;
    await prisma.professionalProfile.update({ where: { id: Number(profileId) }, data: { ratingAvg: Math.round(avg * 100) / 100, ratingCount: ratings.length } });
  }

  // A few notifications so the bell is not empty on first login.
  const admin = await prisma.user.findUnique({ where: { email: 'admin@gara.test' } });
  const find = (status, p, customerKey) =>
    prisma.booking.findFirst({
      where: { status, professional: { userId: pros[p].user.id }, ...(customerKey && { customerId: customers[customerKey].id }) },
    });
  const submitted = await find('DEPOSIT_SUBMITTED', 'lia');
  const requested = await find('DEPOSIT_VERIFIED', 'mara');
  const confirmed = await find('CONFIRMED', 'mara');
  const declined = await find('DECLINED', 'tin');
  const birthday = await find('COMPLETED', 'kiko', 'ana');
  await prisma.notification.createMany({
    data: [
      { userId: admin.id, type: 'DEPOSIT_SUBMITTED', title: 'Deposit to verify', body: 'Benjie Cruz sent a GCash deposit for a booking with Lia Alcoseba Nails.', bookingId: submitted.id },
      { userId: admin.id, type: 'REFUND_NEEDED', title: 'Refund needed', body: 'Glow by Tin declined a booking. Refund the deposit to Carla Mendoza.', bookingId: declined.id },
      { userId: pros.mara.user.id, type: 'BOOKING_REQUESTED', title: 'New booking request', body: 'Carla Mendoza booked Keratin treatment. Accept or decline it.', bookingId: requested.id },
      { userId: customers.ana.id, type: 'BOOKING_CONFIRMED', title: 'Booking confirmed', body: 'Mara Reyes Hair Studio confirmed your appointment.', bookingId: confirmed.id },
      { userId: customers.ana.id, type: 'BOOKING_COMPLETED', title: 'Appointment completed', body: 'Your appointment with Kiko Dizon Makeup Artistry is done. Thanks for booking with Gara!', bookingId: birthday.id },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    verifiedPros: await prisma.professionalProfile.count({ where: { verificationStatus: 'APPROVED' } }),
    bookings: await prisma.booking.count(),
    completed: await prisma.booking.count({ where: { status: 'COMPLETED' } }),
    reviews: await prisma.review.count(),
  };

  console.log('\nSeed complete:', JSON.stringify(counts));
  console.log(`\nDemo logins (password for every account: ${DEMO_PASSWORD})`);
  console.log('  Admin      admin@gara.test');
  console.log(`  Customers  ${CUSTOMERS.map((c) => c.email).join(', ')}`);
  console.log(`  Verified   ${PROS.filter((p) => !p.status).map((p) => p.email).join(', ')}`);
  console.log('  Pending    dani@gara.test (waiting in the admin verification queue)\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
