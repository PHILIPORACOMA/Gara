import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { createNotification } from './notification.service.js';

const adminInclude = {
  user: { select: { name: true, email: true, phone: true } },
  categories: { select: { category: true } },
  areas: { select: { area: true } },
  services: { where: { isActive: true }, orderBy: { name: 'asc' } },
  portfolio: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
};

function serializeForAdmin(p) {
  return {
    id: p.id,
    displayName: p.displayName,
    bio: p.bio,
    user: p.user,
    categories: p.categories.map((c) => c.category),
    areas: p.areas.map((a) => a.area),
    serviceMode: p.serviceMode,
    storeAddress: p.storeAddress,
    travelFee: Number(p.travelFee),
    verificationStatus: p.verificationStatus,
    rejectionReason: p.rejectionReason,
    submittedAt: p.submittedAt,
    verifiedAt: p.verifiedAt,
    // The ID image is private: the admin UI loads it through GET /files/private/<idImagePath>.
    idImagePath: p.idImagePath,
    services: p.services.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      price: Number(s.price),
      durationMin: s.durationMin,
    })),
    portfolio: p.portfolio.map((img) => ({ id: img.id, path: img.path })),
  };
}

// status defaults to PENDING (the admin queue). Oldest submission first.
export async function listVerifications(status = 'PENDING') {
  const profiles = await prisma.professionalProfile.findMany({
    where: { verificationStatus: status },
    include: adminInclude,
    orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
  });
  return profiles.map(serializeForAdmin);
}

async function loadPending(profileId, client = prisma) {
  const profile = await client.professionalProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw ApiError.notFound('Professional not found');
  if (profile.verificationStatus !== 'PENDING') {
    throw ApiError.unprocessable('This application is not waiting for review.', 'NOT_PENDING');
  }
  return profile;
}

export async function approve(profileId) {
  return prisma.$transaction(async (tx) => {
    const profile = await loadPending(profileId, tx);
    const updated = await tx.professionalProfile.update({
      where: { id: profileId },
      data: { verificationStatus: 'APPROVED', verifiedAt: new Date(), rejectionReason: null },
      include: adminInclude,
    });
    await createNotification(
      {
        userId: profile.userId,
        type: 'VERIFICATION_APPROVED',
        title: 'You are verified!',
        body: 'Your profile now shows the Verified badge and appears in search. Customers can start booking you.',
      },
      tx,
    );
    return serializeForAdmin(updated);
  });
}

export async function reject(profileId, reason) {
  return prisma.$transaction(async (tx) => {
    const profile = await loadPending(profileId, tx);
    const updated = await tx.professionalProfile.update({
      where: { id: profileId },
      data: { verificationStatus: 'REJECTED', rejectionReason: reason },
      include: adminInclude,
    });
    await createNotification(
      {
        userId: profile.userId,
        type: 'VERIFICATION_REJECTED',
        title: 'Verification needs changes',
        body: `We could not verify your profile yet: ${reason}. Update your details and submit again.`,
      },
      tx,
    );
    return serializeForAdmin(updated);
  });
}
