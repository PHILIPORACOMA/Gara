import { Router } from 'express';
import * as controller from '../controllers/pro.controller.js';
import * as bookingController from '../controllers/booking.controller.js';
import { calendarQuery, declineBody, pageQuery, proListQuery } from '../validators/booking.validators.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadIdImage, uploadPortfolioImages, verifyUploadedImages } from '../middleware/upload.js';
import {
  availabilityBody,
  blockedDateBody,
  idParam,
  profileBody,
  serviceBody,
} from '../validators/pro.validators.js';

const router = Router();

// Everything under /api/pro is for signed-in professionals only.
router.use(authenticate, requireRole('PROFESSIONAL'));

router.get('/profile', controller.getProfile);
router.put('/profile', validate({ body: profileBody }), controller.updateProfile);

router.get('/services', controller.listServices);
router.post('/services', validate({ body: serviceBody }), controller.createService);
router.put('/services/:id', validate({ params: idParam, body: serviceBody }), controller.updateService);
router.delete('/services/:id', validate({ params: idParam }), controller.removeService);

router.post('/portfolio', uploadPortfolioImages, verifyUploadedImages, controller.addPortfolio);
router.delete('/portfolio/:id', validate({ params: idParam }), controller.deletePortfolio);

router.get('/availability', controller.getAvailability);
router.put('/availability', validate({ body: availabilityBody }), controller.replaceAvailability);
router.get('/blocked-dates', controller.listBlockedDates);
router.post('/blocked-dates', validate({ body: blockedDateBody }), controller.addBlockedDate);
router.delete('/blocked-dates/:id', validate({ params: idParam }), controller.removeBlockedDate);

router.post('/verification', uploadIdImage, verifyUploadedImages, controller.submitVerification);

// Bookings: the professional's own only.
router.get('/dashboard', bookingController.proDashboard);
router.get('/bookings', validate({ query: proListQuery }), bookingController.proList);
router.get('/calendar', validate({ query: calendarQuery }), bookingController.proCalendar);
router.get('/earnings', validate({ query: pageQuery }), bookingController.proEarnings);
router.post('/bookings/:id/accept', validate({ params: idParam }), bookingController.accept);
router.post('/bookings/:id/decline', validate({ params: idParam, body: declineBody }), bookingController.decline);
router.post('/bookings/:id/complete', validate({ params: idParam }), bookingController.complete);
router.post('/bookings/:id/no-show', validate({ params: idParam }), bookingController.noShow);

export default router;
