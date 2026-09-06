import pino from 'pino';

import { env } from '../../config/environment';

export const logger = pino({
  // Tests assert on behaviour, not log output; silencing keeps runs readable.
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
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
