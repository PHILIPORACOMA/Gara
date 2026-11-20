import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { requireProfile } from './professional.service.js';

export const serializeService = (s) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  price: Number(s.price),
  durationMin: s.durationMin,
  description: s.description,
  isActive: s.isActive,
});

async function assertCategoryOffered(profile, category) {
  const offered = profile.categories.map((c) => c.category);
  if (!offered.includes(category)) {
    throw ApiError.unprocessable(
      `Add ${category.toLowerCase()} to your categories in your profile before creating a service in it.`,
      'CATEGORY_NOT_OFFERED',
      [{ field: 'category', message: 'Not one of your categories' }],
    );
  }
}

async function findOwnService(profileId, serviceId) {
  const service = await prisma.service.findFirst({ where: { id: serviceId, professionalId: profileId } });
  if (!service) throw ApiError.notFound('Service not found');
  return service;
}

export async function listServices(userId) {
  const profile = await requireProfile(userId);
  const services = await prisma.service.findMany({
    where: { professionalId: profile.id, isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return services.map(serializeService);
}

export async function createService(userId, input) {
  const profile = await requireProfile(userId);
  await assertCategoryOffered(profile, input.category);
  const service = await prisma.service.create({
    data: { ...input, description: input.description ?? null, professionalId: profile.id },
  });
  return serializeService(service);
}

export async function updateService(userId, serviceId, input) {
  const profile = await requireProfile(userId);
  const existing = await findOwnService(profile.id, serviceId);
  if (!existing.isActive) throw ApiError.notFound('Service not found');
  await assertCategoryOffered(profile, input.category);
  const service = await prisma.service.update({
    where: { id: serviceId },
    data: { ...input, description: input.description ?? null },
  });
  return serializeService(service);
}

// Soft delete: past bookings keep their own snapshot, and the history stays intact.
export async function removeService(userId, serviceId) {
  const profile = await requireProfile(userId);
  const existing = await findOwnService(profile.id, serviceId);
  if (!existing.isActive) return;
  await prisma.service.update({ where: { id: serviceId }, data: { isActive: false } });
}
