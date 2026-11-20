import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { privateDir } from '../utils/files.js';

const router = Router();

// Stored names are random UUIDs plus an image extension; anything else is rejected, which
// also rules out path traversal ("../").
const fileName = z.string().regex(/^[0-9a-f-]{36}\.(jpg|png|webp)$/, 'Invalid file name');

function sendPrivate(res, absolutePath) {
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(absolutePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found' } });
  });
}

// A professional's ID image: visible only to the admin and the professional who owns it.
router.get('/private/id/:name', authenticate, validate({ params: z.object({ name: fileName }) }), async (req, res) => {
  const { name } = req.valid.params;
  const profile = await prisma.professionalProfile.findFirst({
    where: { idImagePath: `id/${name}` },
    select: { userId: true },
  });
  if (!profile) throw ApiError.notFound('File not found');
  if (req.user.role !== 'ADMIN' && profile.userId !== req.user.id) throw ApiError.forbidden();
  sendPrivate(res, privateDir('id', name));
});

// A GCash payment screenshot: visible only to the admin and the customer who sent it.
router.get('/private/deposit/:name', authenticate, validate({ params: z.object({ name: fileName }) }), async (req, res) => {
  const { name } = req.valid.params;
  const booking = await prisma.booking.findFirst({
    where: { depositScreenshotPath: `deposit/${name}` },
    select: { customerId: true },
  });
  if (!booking) throw ApiError.notFound('File not found');
  if (req.user.role !== 'ADMIN' && booking.customerId !== req.user.id) throw ApiError.forbidden();
  sendPrivate(res, privateDir('deposit', name));
});

export default router;
