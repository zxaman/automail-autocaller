import { Router } from 'express';

import { env } from '../config/environment';
import { renderMetrics } from '../infrastructure/observability/metrics';
import { createReadinessHandler, getLiveness } from '../modules/health/health.controller';
import type { HealthService } from '../modules/health/health.service';

export function createHealthRouter(healthService: HealthService): Router {
  const router = Router();

  router.get('/health', getLiveness);
  router.get('/health/live', getLiveness);
  router.get('/health/ready', createReadinessHandler(healthService));

  /*
   * Metrics are operational data, not public data: counts of sends and
   * failures leak business volume. They sit behind a bearer token rather than
   * a user session, because a scraper has no session. When METRICS_TOKEN is
   * unset the endpoint is disabled entirely rather than left open.
   */
  router.get('/metrics', (req, res) => {
    const token = env.METRICS_TOKEN;

    if (!token) {
      res.status(404).json({
        success: false,
        message: 'Metrics are not enabled',
        error: { code: 'METRICS_DISABLED' },
      });
      return;
    }

    if (req.header('authorization') !== `Bearer ${token}`) {
      res.status(401).json({
        success: false,
        message: 'Metrics require a valid token',
        error: { code: 'UNAUTHORIZED' },
      });
      return;
    }

    res.type('text/plain; version=0.0.4').send(renderMetrics());
  });

  return router;
}
