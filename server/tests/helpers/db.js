import { prisma } from '../../src/lib/prisma.js';
import { manilaMinutesToDate, nowManila } from '../../src/utils/time.js';

// Safety net: these helpers delete data, so they refuse to run unless the connection string
// points at a database with "test" in its name.
export function assertTestDatabase() {
  const name = new URL(process.env.DATABASE_URL).pathname.slice(1);
  if (!/test/i.test(name)) throw new Error(`Refusing to wipe "${name}": not a test database.`);
}

export async function resetDatabase() {
  assertTestDatabase();
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

let counter = 0;
export function createUser(role, name = `${role} ${++counter}`) {
  return prisma.user.create({
    data: { email: `${role.toLowerCase()}${++counter}-${Date.now()}@test.local`, passwordHash: 'x', name, role },
  });
}

// A verified pro who works every day 9:00-18:00 and offers two HAIR services:
//   "Bridal hairstyle" 1,800 / 60 min and "Hair treatment" 650 / 30 min. Home travel fee 150.
export async function createVerifiedPro({ serviceMode = 'BOTH', travelFee = 150 } = {}) {
  const user = await createUser('PROFESSIONAL', 'Mara Glam');
  const profile = await prisma.professionalProfile.create({
    data: {
      userId: user.id,
      displayName: 'Mara Glam',
      serviceMode,
      storeAddress: '12 Colon St, Cebu City',
      travelFee,
      verificationStatus: 'APPROVED',
      verifiedAt: new Date(),
      categories: { create: [{ category: 'HAIR' }] },
      areas: { create: [{ area: 'Cebu City' }] },
      availability: {
        create: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({ dayOfWeek, startMin: 540, endMin: 1080 })),
      },
      services: {
        create: [
          { name: 'Bridal hairstyle', category: 'HAIR', price: 1800, durationMin: 60 },
          { name: 'Hair treatment', category: 'HAIR', price: 650, durationMin: 30 },
        ],
      },
    },
    include: { services: { orderBy: { id: 'asc' } } },
  });
  return { user, profile, bridal: profile.services[0], treatment: profile.services[1] };
}

// A Manila calendar day a week from now (inside the booking horizon, after the lead time).
export const testDay = () => nowManila().plus({ days: 7 }).toISODate();
// Start instant for "h:mm Manila time on that day".
export const at = (isoDate, hour, minute = 0) => manilaMinutesToDate(isoDate, hour * 60 + minute);
