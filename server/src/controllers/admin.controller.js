import path from 'node:path';
import * as verificationService from '../services/verification.service.js';
import * as settingsService from '../services/settings.service.js';
import { getMetrics } from '../services/metrics.service.js';
import { getDiscoveryMetrics } from '../services/contact.service.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { publicDir, removeFileQuietly } from '../utils/files.js';

// Discovery version: searches, views, contacts. Bookings version: bookings, deposits, commission.
export async function metrics(req, res) {
  if (env.FEATURE_BOOKINGS) res.json({ kind: 'bookings', metrics: await getMetrics() });
  else res.json({ kind: 'discovery', metrics: await getDiscoveryMetrics() });
}

export async function getSettings(req, res) {
  res.json({ settings: await settingsService.getAdminSettings() });
}

export async function updateSettings(req, res) {
  res.json({ settings: await settingsService.updateSettings(req.valid.body) });
}

export async function uploadQr(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose an image of the GCash QR code');
  try {
    const { settings, previousPath } = await settingsService.setQrPath(`qr/${req.file.filename}`);
    if (previousPath) await removeFileQuietly(publicDir('qr', path.basename(previousPath)));
    res.json({ settings });
  } catch (err) {
    await removeFileQuietly(req.file.path);
    throw err;
  }
}

export async function listVerifications(req, res) {
  const status = req.valid.query.status;
  res.json({ verifications: await verificationService.listVerifications(status) });
}

export async function approveVerification(req, res) {
  res.json({ verification: await verificationService.approve(req.valid.params.id) });
}

export async function rejectVerification(req, res) {
  res.json({ verification: await verificationService.reject(req.valid.params.id, req.valid.body.reason) });
}
