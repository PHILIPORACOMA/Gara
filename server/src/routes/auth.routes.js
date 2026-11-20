import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { loginBody, registerBody } from '../validators/auth.validators.js';

const router = Router();

router.post('/register', validate({ body: registerBody }), controller.register);
router.post('/login', validate({ body: loginBody }), controller.login);
router.get('/me', authenticate, controller.me);

export default router;
