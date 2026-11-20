import { Router } from 'express';
import { AREAS, CATEGORIES, OCCASIONS, SERVICE_MODES, TIMEZONE } from '../config/constants.js';
import { getPublicSettings } from '../services/settings.service.js';

const router = Router();

// Option lists the client needs for forms and filters.
router.get('/meta', (req, res) => {
  res.json({
    timezone: TIMEZONE,
    categories: CATEGORIES,
    areas: AREAS,
    occasions: OCCASIONS,
    serviceModes: SERVICE_MODES,
  });
});

router.get('/settings/public', async (req, res) => {
  res.json({ settings: await getPublicSettings() });
});

export default router;
