import { Router } from 'express';
import { z } from 'zod';
import * as discovery from '../services/discovery.service.js';
import * as contact from '../services/contact.service.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { env } from '../config/env.js';
import { idParam, reviewsQuery, searchQuery, slotsQuery } from '../validators/discovery.validators.js';

const router = Router();

// Public: no login needed to browse. Only verified professionals are ever returned.
// The Find a pro page sends source=search so its searches count toward the
// search-to-contact rate (the home page's "top-rated" list does not).
router.get('/', optionalAuth, validate({ query: searchQuery }), async (req, res) => {
  const { source, ...filters } = req.valid.query;
  const professionals = await discovery.searchProfessionals(filters);
  if (source === 'search') await contact.recordSearch(req.user, filters, professionals.length);
  res.json({ professionals });
});

router.get('/:id', optionalAuth, validate({ params: idParam }), async (req, res) => {
  const professional = await discovery.getPublicProfile(req.valid.params.id);
  await contact.recordProfileView(professional.id, req.user);
  res.json({ professional });
});

// Contact buttons: customers must be signed in. Each tap is logged, then the browser opens the
// returned Messenger, tel: or sms: link.
const contactBody = z.object({ channel: z.enum(['MESSENGER', 'CALL', 'SMS'], { error: 'Choose Messenger, Call or SMS' }) });

router.post(
  '/:id/contact',
  authenticate,
  requireRole('CUSTOMER'),
  validate({ params: idParam, body: contactBody }),
  async (req, res) => {
    res.json(await contact.contactProfessional(req.user.id, req.valid.params.id, req.valid.body.channel));
  },
);

// Reviews come from completed bookings and slots feed the booking flow: bookings version only.
if (env.FEATURE_BOOKINGS) {
  router.get('/:id/reviews', validate({ params: idParam, query: reviewsQuery }), async (req, res) => {
    // 404 for unknown or unverified pros, same as the profile.
    await discovery.getPublicProfile(req.valid.params.id);
    res.json(await discovery.listReviews(req.valid.params.id, req.valid.query));
  });

  router.get('/:id/slots', validate({ params: idParam, query: slotsQuery }), async (req, res) => {
    const { date, serviceIds, mode } = req.valid.query;
    res.json(await discovery.getBookableSlots({ professionalId: req.valid.params.id, isoDate: date, serviceIds, mode }));
  });
}

export default router;
