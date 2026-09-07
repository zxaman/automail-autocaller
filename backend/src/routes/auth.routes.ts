import { Router } from 'express';

import { env } from '../config/environment';
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

  // Development-only: bypass Google OAuth for local testing.
  if (env.NODE_ENV !== 'production') {
    router.post('/auth/dev-login', authRateLimiter, authController.devLogin);
  }

  return router;
}
