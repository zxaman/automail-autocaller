import { Router } from 'express';
import { authRateLimiter } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validate.middleware';
import type { AuthModule } from '../modules/auth/auth.module';
import { registerSchema, loginSchema } from '../modules/auth/auth.validation';

export function createAuthRouter(authModule: AuthModule): Router {
  const router = Router();
  const { authController, authenticate } = authModule;

  router.post('/auth/register', authRateLimiter, validate(registerSchema), authController.register);
  router.post('/auth/login', authRateLimiter, validate(loginSchema), authController.login);
  router.get('/auth/me', authenticate, authController.getCurrentUser);
  router.post('/auth/logout', authenticate, authController.logout);

  return router;
}
