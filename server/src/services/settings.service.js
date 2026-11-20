import { prisma } from '../lib/prisma.js';

// The settings table holds exactly one row (id = 1), created on first use with schema defaults
// (deposit 20%, commission 10%, hold 120 minutes).
export function getSettings(client = prisma) {
  return client.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

const serializeAdmin = (s) => ({
  depositPct: Number(s.depositPct),
  commissionPct: Number(s.commissionPct),
  holdMinutes: s.holdMinutes,
  gcashNumber: s.gcashNumber,
  gcashName: s.gcashName,
  gcashQrPath: s.gcashQrPath ?? null,
  updatedAt: s.updatedAt,
});

export async function getAdminSettings() {
  return serializeAdmin(await getSettings());
}

// Changes apply to NEW bookings only: every booking keeps the deposit % and commission %
// it was made with.
export async function updateSettings(input) {
  await getSettings();
  return serializeAdmin(await prisma.setting.update({ where: { id: 1 }, data: input }));
}

// Replaces the GCash QR image. Returns the previous path so the caller can delete the old file.
export async function setQrPath(path) {
  const before = await getSettings();
  const updated = await prisma.setting.update({ where: { id: 1 }, data: { gcashQrPath: path } });
  return { settings: serializeAdmin(updated), previousPath: before.gcashQrPath };
}

// What any visitor may see. Commission is shown on purpose: professionals are told the rate
// plainly before they sign up.
export async function getPublicSettings() {
  const s = await getSettings();
  return {
    depositPct: Number(s.depositPct),
    commissionPct: Number(s.commissionPct),
    holdMinutes: s.holdMinutes,
    gcashNumber: s.gcashNumber,
    gcashName: s.gcashName,
    // Relative to the public uploads folder; the client prefixes VITE_UPLOADS_URL.
    gcashQrPath: s.gcashQrPath ?? null,
  };
}
