import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { privateDir, publicDir, removeFileQuietly } from '../utils/files.js';
import { buildChecklist, MAX_PORTFOLIO_IMAGES } from './onboarding.js';

const profileInclude = {
  categories: { select: { category: true } },
  areas: { select: { area: true } },
};

// Loads the signed-in professional's profile or fails with 404.
export async function requireProfile(userId, client = prisma) {
  const profile = await client.professionalProfile.findUnique({ where: { userId }, include: profileInclude });
  if (!profile) throw ApiError.notFound('Professional profile not found');
  return profile;
}

export function serializeProfile(p) {
  return {
    id: p.id,
    displayName: p.displayName,
    bio: p.bio,
    categories: p.categories.map((c) => c.category),
    areas: p.areas.map((a) => a.area),
    serviceMode: p.serviceMode,
    storeAddress: p.storeAddress,
    travelFee: Number(p.travelFee),
    verificationStatus: p.verificationStatus,
    rejectionReason: p.rejectionReason,
    hasIdImage: Boolean(p.idImagePath),
    idImagePath: p.idImagePath,
    submittedAt: p.submittedAt,
    verifiedAt: p.verifiedAt,
    ratingAvg: Number(p.ratingAvg),
    ratingCount: p.ratingCount,
    messengerUrl: p.messengerUrl,
    contactPhone: p.contactPhone,
    availabilityUpdatedAt: p.availabilityUpdatedAt,
  };
}

export const serializePortfolioImage = (img) => ({ id: img.id, path: img.path, sortOrder: img.sortOrder });

async function loadChecklist(profile) {
  const [activeServiceCount, availabilityCount, portfolioCount] = await Promise.all([
    prisma.service.count({ where: { professionalId: profile.id, isActive: true } }),
    prisma.availabilityRule.count({ where: { professionalId: profile.id } }),
    prisma.portfolioImage.count({ where: { professionalId: profile.id } }),
  ]);
  return buildChecklist({
    profile,
    categoryCount: profile.categories.length,
    areaCount: profile.areas.length,
    activeServiceCount,
    availabilityCount,
    portfolioCount,
    hasIdImage: Boolean(profile.idImagePath),
  });
}

export async function getOwnProfile(userId) {
  const profile = await requireProfile(userId);
  const [portfolio, checklist] = await Promise.all([
    prisma.portfolioImage.findMany({ where: { professionalId: profile.id }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    loadChecklist(profile),
  ]);
  return { profile: serializeProfile(profile), portfolio: portfolio.map(serializePortfolioImage), checklist };
}

export async function updateProfile(userId, input) {
  const profile = await requireProfile(userId);

  // Do not let a pro drop a category while an active service still uses it.
  const stillUsed = await prisma.service.findMany({
    where: { professionalId: profile.id, isActive: true, category: { notIn: input.categories } },
    select: { category: true },
    distinct: ['category'],
  });
  if (stillUsed.length) {
    const names = stillUsed.map((s) => s.category.toLowerCase()).join(', ');
    throw ApiError.unprocessable(
      `You still have active ${names} services. Remove or change them before removing that category.`,
      'CATEGORY_IN_USE',
    );
  }

  const needsStore = input.serviceMode === 'STORE' || input.serviceMode === 'BOTH';
  const allowsHome = input.serviceMode === 'HOME' || input.serviceMode === 'BOTH';

  await prisma.$transaction([
    prisma.professionalProfile.update({
      where: { id: profile.id },
      data: {
        displayName: input.displayName,
        bio: input.bio ?? null,
        serviceMode: input.serviceMode,
        storeAddress: needsStore ? input.storeAddress : null,
        // The travel fee only applies to home service.
        travelFee: allowsHome ? input.travelFee : 0,
        messengerUrl: input.messengerUrl ?? null,
        contactPhone: input.contactPhone ?? null,
      },
    }),
    prisma.professionalCategory.deleteMany({ where: { professionalId: profile.id } }),
    prisma.professionalCategory.createMany({
      data: input.categories.map((category) => ({ professionalId: profile.id, category })),
    }),
    prisma.professionalArea.deleteMany({ where: { professionalId: profile.id } }),
    prisma.professionalArea.createMany({
      data: input.areas.map((area) => ({ professionalId: profile.id, area })),
    }),
  ]);

  return getOwnProfile(userId);
}

// ------------------------------------------------------------------ portfolio

export async function addPortfolioImages(userId, files) {
  const profile = await requireProfile(userId);
  if (!files.length) throw ApiError.badRequest('Choose at least one image to upload');

  const existing = await prisma.portfolioImage.count({ where: { professionalId: profile.id } });
  if (existing + files.length > MAX_PORTFOLIO_IMAGES) {
    throw ApiError.unprocessable(
      `You can have at most ${MAX_PORTFOLIO_IMAGES} portfolio photos (you have ${existing}).`,
      'PORTFOLIO_LIMIT',
    );
  }

  const last = await prisma.portfolioImage.findFirst({
    where: { professionalId: profile.id },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const start = (last?.sortOrder ?? 0) + 1;

  const created = await prisma.$transaction(
    files.map((file, i) =>
      prisma.portfolioImage.create({
        data: { professionalId: profile.id, path: `portfolio/${file.filename}`, sortOrder: start + i },
      }),
    ),
  );
  return created.map(serializePortfolioImage);
}

export async function deletePortfolioImage(userId, imageId) {
  const profile = await requireProfile(userId);
  const image = await prisma.portfolioImage.findFirst({ where: { id: imageId, professionalId: profile.id } });
  if (!image) throw ApiError.notFound('Photo not found');
  await prisma.portfolioImage.delete({ where: { id: image.id } });
  await removeFileQuietly(publicDir(path.basename(path.dirname(image.path)), path.basename(image.path)));
}

// ------------------------------------------------------------------ verification

// The pro submits (or re-submits after a rejection). An ID image is required, either
// uploaded now or already on file. The profile must be complete; the admin then decides.
export async function submitVerification(userId, idFile) {
  const profile = await requireProfile(userId);

  if (profile.verificationStatus === 'PENDING') {
    throw ApiError.unprocessable('Your verification is already being reviewed.', 'ALREADY_PENDING');
  }
  if (profile.verificationStatus === 'APPROVED') {
    throw ApiError.unprocessable('You are already verified.', 'ALREADY_VERIFIED');
  }

  const newIdPath = idFile ? `id/${idFile.filename}` : null;
  const idImagePath = newIdPath ?? profile.idImagePath;

  const checklist = await loadChecklist({ ...profile, idImagePath });
  if (!checklist.complete) {
    throw ApiError.unprocessable('Finish the checklist before submitting for verification.', 'PROFILE_INCOMPLETE', {
      missing: checklist.missing,
    });
  }

  await prisma.professionalProfile.update({
    where: { id: profile.id },
    data: { verificationStatus: 'PENDING', submittedAt: new Date(), rejectionReason: null, idImagePath },
  });

  // Replacing the ID: remove the old private file.
  if (newIdPath && profile.idImagePath) {
    await removeFileQuietly(privateDir('id', path.basename(profile.idImagePath)));
  }

  return getOwnProfile(userId);
}
