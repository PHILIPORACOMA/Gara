import { Router } from 'express';
import * as controller from '../controllers/booking.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { discardUploadsOnError, uploadDepositScreenshot, verifyUploadedImages } from '../middleware/upload.js';
import { createBookingBody, customerListQuery, depositBody, idParam, quoteBody, reviewBody } from '../validators/booking.validators.js';

const router = Router();
const customer = requireRole('CUSTOMER');

router.use(authenticate);

router.post('/quote', customer, validate({ body: quoteBody }), controller.quote);
router.post('/', customer, validate({ body: createBookingBody }), controller.create);
router.get('/', customer, validate({ query: customerListQuery }), controller.listMine);

// Customer, the booking's professional, or admin (anyone else gets 404).
router.get('/:id', validate({ params: idParam }), controller.getOne);

router.post(
  '/:id/deposit',
  customer,
  uploadDepositScreenshot,
  verifyUploadedImages,
  validate({ params: idParam, body: depositBody }),
  controller.submitDeposit,
  discardUploadsOnError,
);
router.post('/:id/cancel', customer, validate({ params: idParam }), controller.cancel);
// Only the booking's customer, only once it is COMPLETED, only once (see review.service.js).
router.post('/:id/review', customer, validate({ params: idParam, body: reviewBody }), controller.review);

export default router;
