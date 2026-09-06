import type { RequestHandler } from 'express';

import { isDatabaseReady } from '../../infrastructure/database/mongoose';

export const getHealth: RequestHandler = (_req, res) => {
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

export const getReadiness: RequestHandler = (_req, res) => {
  const databaseReady = isDatabaseReady();
  const ready = databaseReady;

  res.status(ready ? 200 : 503).json({
    success: ready,
    message: ready ? 'Service is ready' : 'Service dependencies are not ready',
    data: {
      status: ready ? 'ready' : 'not-ready',
      dependencies: {
        database: databaseReady ? 'ready' : 'not-ready',
      },
      timestamp: new Date().toISOString(),
    },
  });
};
