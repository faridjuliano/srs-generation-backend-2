import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';

const router = Router();

/**
 * POST /api/auth/register
 * Body: { email: string, password: string }
 */
router.post('/register', register);

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 */
router.post('/login', login);

export default router;

