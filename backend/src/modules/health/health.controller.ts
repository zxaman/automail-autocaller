import type { RequestHandler } from 'express';

import type { HealthService } from './health.service';

/**
 * Liveness: is the process running at all?
 *
 * Deliberately checks nothing else. If this consulted the database, a brief
 * database outage would make every instance fail liveness and be killed,
 * turning a recoverable dependency blip into a restart storm.
 */
export const getLiveness: RequestHandler = (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'AutoCall & AutoMail API is running',
    data: {
      service: 'automail-autocaller-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
};

/**
 * Readiness: can this instance serve traffic right now?
 *
 * Returns 503 when a hard dependency is down so the load balancer stops
 * sending it requests.
 */
export function createReadinessHandler(healthService: HealthService): RequestHandler {
  return (_req, res, next) => {
    healthService
      .report()
      .then((report) => {
        res.status(report.ready ? 200 : 503).json({
          success: report.ready,
          message: report.ready ? 'Service is ready' : 'Service dependencies are not ready',
          data: {
            status: report.ready ? 'ready' : 'not-ready',
            dependencies: report.dependencies,
            queueDepth: report.queueDepth,
            uptimeSeconds: report.uptimeSeconds,
            version: report.version,
            timestamp: new Date().toISOString(),
          },
        });
      })
      .catch(next);
  };
}

/** Backwards-compatible aliases for the original health endpoints. */
export const getHealth = getLiveness;
