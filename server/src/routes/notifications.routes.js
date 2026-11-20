import { Router } from 'express';
import { z } from 'zod';
import * as notifications from '../services/notification.service.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/discovery.validators.js';

const router = Router();

// Every signed-in user (customer, pro, admin) has their own notifications.
router.use(authenticate);

const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) });

router.get('/', validate({ query: listQuery }), async (req, res) => {
  res.json(await notifications.listForUser(req.user.id, req.valid.query));
});

router.get('/unread-count', async (req, res) => {
  res.json({ unreadCount: await notifications.unreadCount(req.user.id) });
});

router.post('/read-all', async (req, res) => {
  await notifications.markAllRead(req.user.id);
  res.status(204).end();
});

router.post('/:id/read', validate({ params: idParam }), async (req, res) => {
  await notifications.markRead(req.user.id, req.valid.params.id);
  res.status(204).end();
});

export default router;
