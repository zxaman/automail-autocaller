import { Router, type RequestHandler } from 'express';

import { validate } from '../middleware/validate.middleware';
import type { DashboardModule } from '../modules/dashboard/dashboard.module';
import { dashboardQuerySchema } from '../modules/dashboard/dashboard.validation';

export function createDashboardRouter(
  dashboardModule: DashboardModule,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.get(
    '/dashboard',
    authenticate,
    validate(dashboardQuerySchema, 'query'),
    dashboardModule.dashboardController.getSnapshot,
  );

  return router;
}
