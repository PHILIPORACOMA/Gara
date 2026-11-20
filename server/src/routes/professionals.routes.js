import { Router } from 'express';
import * as discovery from '../services/discovery.service.js';
import { validate } from '../middleware/validate.js';
import { idParam, reviewsQuery, searchQuery, slotsQuery } from '../validators/discovery.validators.js';

const router = Router();

// Public: no login needed to browse. Only verified professionals are ever returned.
router.get('/', validate({ query: searchQuery }), async (req, res) => {
  res.json({ professionals: await discovery.searchProfessionals(req.valid.query) });
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  res.json({ professional: await discovery.getPublicProfile(req.valid.params.id) });
});

router.get('/:id/reviews', validate({ params: idParam, query: reviewsQuery }), async (req, res) => {
  // 404 for unknown or unverified pros, same as the profile.
  await discovery.getPublicProfile(req.valid.params.id);
  res.json(await discovery.listReviews(req.valid.params.id, req.valid.query));
});

router.get('/:id/slots', validate({ params: idParam, query: slotsQuery }), async (req, res) => {
  const { date, serviceIds, mode } = req.valid.query;
  res.json(await discovery.getBookableSlots({ professionalId: req.valid.params.id, isoDate: date, serviceIds, mode }));
});

export default router;
