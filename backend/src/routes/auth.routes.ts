import { Router } from 'express';

import { authRateLimiter } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validate.middleware';
import type { AuthModule } from '../modules/auth/auth.module';
import { googleLoginSchema } from '../modules/auth/auth.validation';

/**
 * Routes are declarative only: validation, rate limiting, authentication, then
 * the controller. No business logic lives in this layer.
 */
export function createAuthRouter(authModule: AuthModule): Router {
  const router = Router();
  const { authController, authenticate } = authModule;

  router.post(
    '/auth/google',
    authRateLimiter,
    validate(googleLoginSchema),
    authController.loginWithGoogle,
  );
  router.get('/auth/me', authenticate, authController.getCurrentUser);
  router.post('/auth/logout', authenticate, authController.logout);

  return router;
}
