import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import publicRoutes from './public.routes.js';
import proRoutes from './pro.routes.js';
import adminRoutes from './admin.routes.js';
import filesRoutes from './files.routes.js';
import professionalsRoutes from './professionals.routes.js';
import bookingsRoutes from './bookings.routes.js';
import notificationsRoutes from './notifications.routes.js';
import { env } from '../config/env.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/professionals', professionalsRoutes);
// Bookings are off in the discovery version (workbook v3); see FEATURE_BOOKINGS.
if (env.FEATURE_BOOKINGS) router.use('/bookings', bookingsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/pro', proRoutes);
router.use('/admin', adminRoutes);
router.use('/files', filesRoutes);
router.use('/', publicRoutes);

export default router;
