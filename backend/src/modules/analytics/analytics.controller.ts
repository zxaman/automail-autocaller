import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/app-error';
import { sendSuccess } from '../../shared/http/api-response';
import type { AuthContext } from '../auth/auth.types';
import type { AnalyticsService } from './analytics.service';
import { METRIC_DEFINITIONS } from './analytics.types';
import type { AnalyticsQueryInput } from './analytics.validation';

/** HTTP boundary for analytics. No business logic lives here. */
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  public getSummary: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const query = req.query as unknown as AnalyticsQueryInput;

      const summary = await this.analyticsService.getSummary(
        { workspaceId: auth.workspaceId },
        {
          preset: query.preset,
          timezone: query.timezone,
          from: query.from,
          to: query.to,
          granularity: query.granularity,
        },
      );

      sendSuccess(res, 200, 'Analytics retrieved successfully', summary);
    });
  };

  /**
   * Published definitions for every metric.
   *
   * Served as data so the UI can show a definition next to the number it
   * describes, instead of the meaning living only in documentation.
   */
  public getDefinitions: RequestHandler = (_req, res, next) => {
    void this.run(next, async () => {
      sendSuccess(res, 200, 'Metric definitions retrieved successfully', {
        definitions: METRIC_DEFINITIONS,
      });
    });
  };

  private requireAuth(auth: AuthContext | undefined): AuthContext {
    if (!auth) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    }

    return auth;
  }

  private async run(
    next: (error?: unknown) => void,
    handler: () => Promise<void>,
  ): Promise<void> {
    try {
      await handler();
    } catch (error) {
      next(error);
    }
  }
}
