import pino from 'pino';

import { env } from '../../config/environment';

export const logger = pino({
  // Tests assert on behaviour, not log output; silencing keeps runs readable.
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  base: {
    service: 'automail-autocaller-api',
    environment: env.NODE_ENV,
  },
  /**
   * Secrets must never reach the log stream. Bare keys cover top-level fields,
   * the `req.body.*` and `*.*` forms cover the nested shapes that actually
   * occur (a request body, a service payload, an error's captured context).
   */
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
      'req.body.password',
      'req.body.appPassword',
      'req.body.credential',
      '*.password',
      '*.appPassword',
      '*.credential',
      '*.ciphertext',
      'ciphertext',
      'details.appPassword',
    ],
    censor: '[REDACTED]',
  },
});
