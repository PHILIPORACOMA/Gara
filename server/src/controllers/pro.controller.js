import * as professionalService from '../services/professional.service.js';
import * as catalogService from '../services/catalog.service.js';
import * as availabilityService from '../services/availability.service.js';
import { removeFileQuietly } from '../utils/files.js';

const userId = (req) => req.user.id;

// If a service rejects an upload (limit reached, incomplete profile...) the file that multer
// already wrote to disk must not be left behind.
async function discardUploads(files) {
  await Promise.all(files.map((f) => removeFileQuietly(f.path)));
}

export async function getProfile(req, res) {
  res.json(await professionalService.getOwnProfile(userId(req)));
}

export async function updateProfile(req, res) {
  res.json(await professionalService.updateProfile(userId(req), req.valid.body));
}

// ---- services
export async function listServices(req, res) {
  res.json({ services: await catalogService.listServices(userId(req)) });
}

export async function createService(req, res) {
  res.status(201).json({ service: await catalogService.createService(userId(req), req.valid.body) });
}

export async function updateService(req, res) {
  res.json({ service: await catalogService.updateService(userId(req), req.valid.params.id, req.valid.body) });
}

export async function removeService(req, res) {
  await catalogService.removeService(userId(req), req.valid.params.id);
  res.status(204).end();
}

// ---- portfolio
export async function addPortfolio(req, res) {
  const files = req.files ?? [];
  try {
    res.status(201).json({ images: await professionalService.addPortfolioImages(userId(req), files) });
  } catch (err) {
    await discardUploads(files);
    throw err;
  }
}

export async function deletePortfolio(req, res) {
  await professionalService.deletePortfolioImage(userId(req), req.valid.params.id);
  res.status(204).end();
}

// ---- availability
export async function getAvailability(req, res) {
  res.json({ rules: await availabilityService.getAvailability(userId(req)) });
}

export async function replaceAvailability(req, res) {
  res.json({ rules: await availabilityService.replaceAvailability(userId(req), req.valid.body.rules) });
}

export async function listBlockedDates(req, res) {
  res.json({ blockedDates: await availabilityService.listBlockedDates(userId(req)) });
}

export async function addBlockedDate(req, res) {
  res.status(201).json({ blockedDate: await availabilityService.addBlockedDate(userId(req), req.valid.body) });
}

export async function removeBlockedDate(req, res) {
  await availabilityService.removeBlockedDate(userId(req), req.valid.params.id);
  res.status(204).end();
}

// ---- verification
export async function submitVerification(req, res) {
  const files = req.file ? [req.file] : [];
  try {
    res.json(await professionalService.submitVerification(userId(req), req.file ?? null));
  } catch (err) {
    await discardUploads(files);
    throw err;
  }
}
