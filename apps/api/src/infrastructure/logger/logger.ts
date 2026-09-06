import pino from 'pino';

import { env } from '../../config/environment';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'automail-autocaller-api',
    environment: env.NODE_ENV,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'appPassword',
      'credential',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
    ],
    censor: '[REDACTED]',
  },
});
