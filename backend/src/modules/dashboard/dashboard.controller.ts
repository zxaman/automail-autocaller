import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/app-error';
import { sendSuccess } from '../../shared/http/api-response';
import type { DashboardService } from './dashboard.service';
import type { DashboardQueryInputSchema } from './dashboard.validation';

/** HTTP boundary for the dashboard. */
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  public getSnapshot: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        if (!req.auth) {
          throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
        }

        const query = req.query as unknown as DashboardQueryInputSchema;
        const snapshot = await this.dashboardService.getSnapshot(
          { workspaceId: req.auth.workspaceId },
          query,
        );

        sendSuccess(res, 200, 'Dashboard retrieved successfully', snapshot);
      } catch (error) {
        next(error);
      }
    })();
  };
}
