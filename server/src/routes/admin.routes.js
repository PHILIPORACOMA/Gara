import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/admin.controller.js';
import * as bookingController from '../controllers/booking.controller.js';
import { adminBookingsQuery, depositRejectBody } from '../validators/booking.validators.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { env } from '../config/env.js';
import { discardUploadsOnError, uploadQrImage, verifyUploadedImages } from '../middleware/upload.js';
import { idParam, rejectBody } from '../validators/pro.validators.js';

const router = Router();

// Everything under /api/admin is for the Gara team only.
router.use(authenticate, requireRole('ADMIN'));

const settingsBody = z.object({
  depositPct: z.coerce.number({ error: 'Enter a number' }).min(1, 'Deposit must be at least 1%').max(100, 'Deposit cannot be more than 100%'),
  commissionPct: z.coerce.number({ error: 'Enter a number' }).min(0, 'Commission cannot be negative').max(50, 'Commission cannot be more than 50%'),
  holdMinutes: z.coerce.number({ error: 'Enter a number' }).int('Use whole minutes').min(15, 'At least 15 minutes').max(1440, 'At most 24 hours'),
  gcashNumber: z.string({ error: 'Enter the GCash number' }).trim().min(7, 'Enter a valid GCash number').max(30),
  gcashName: z.string({ error: 'Enter the account name' }).trim().min(2, 'Enter the account name').max(80),
});

router.get('/metrics', controller.metrics);

// Deposit %, commission % and GCash details only matter when bookings are on.
if (env.FEATURE_BOOKINGS) {
  router.get('/settings', controller.getSettings);
  router.put('/settings', validate({ body: settingsBody }), controller.updateSettings);
  router.post('/settings/qr', uploadQrImage, verifyUploadedImages, controller.uploadQr, discardUploadsOnError);
}

const verificationQuery = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
});

router.get('/verifications', validate({ query: verificationQuery }), controller.listVerifications);
router.post('/verifications/:id/approve', validate({ params: idParam }), controller.approveVerification);
router.post('/verifications/:id/reject', validate({ params: idParam, body: rejectBody }), controller.rejectVerification);

// GCash deposits waiting to be checked, and the full booking list (bookings version only).
if (env.FEATURE_BOOKINGS) {
  router.get('/deposits', bookingController.adminDeposits);
  router.post('/bookings/:id/deposit/verify', validate({ params: idParam }), bookingController.adminVerifyDeposit);
  router.post('/bookings/:id/deposit/reject', validate({ params: idParam, body: depositRejectBody }), bookingController.adminRejectDeposit);
  router.get('/bookings', validate({ query: adminBookingsQuery }), bookingController.adminBookingsList);
  router.post('/bookings/:id/refund-resolved', validate({ params: idParam }), bookingController.adminRefundResolved);
}

export default router;
