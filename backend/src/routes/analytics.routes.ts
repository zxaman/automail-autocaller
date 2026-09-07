import { Router, type RequestHandler } from 'express';

import { validateQuery } from '../middleware/validate.middleware';
import type { AnalyticsModule } from '../modules/analytics/analytics.module';
import { analyticsQuerySchema } from '../modules/analytics/analytics.validation';

export function createAnalyticsRouter(
  analyticsModule: AnalyticsModule,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  const controller = analyticsModule.analyticsController;

  /**
   * `authenticate` is attached per route, not with `router.use`: this router
   * shares the `/api/v1` mount, and a root-level guard would also intercept
   * unmatched paths and turn an unknown-route 404 into a misleading 401.
   */
  router.get(
    '/analytics',
    authenticate,
    validateQuery(analyticsQuerySchema),
    controller.getSummary,
  );

  router.get('/analytics/definitions', authenticate, controller.getDefinitions);

  return router;
}
