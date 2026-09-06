import pino from 'pino';

import { env } from '../../config/environment';

const REDACT_PATHS = [
  // Request-level
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-exotel-signature"]',
  'res.headers["set-cookie"]',

  // Secret-bearing key names, at each depth they occur.
  ...[
    'password',
    'appPassword',
    'credential',
    'ciphertext',
    'accessToken',
    'refreshToken',
    'apiKey',
    'apiToken',
    'secret',
    'token',
    'sessionToken',
    'authToken',
    'webhookSecret',
    'signature',
    'encryptionKey',
    'exotelApiKey',
    'exotelApiToken',
    // Config objects are logged using environment-variable names.
    'EXOTEL_API_KEY',
    'EXOTEL_API_TOKEN',
    'EXOTEL_ACCOUNT_SID',
    'TELEPHONY_WEBHOOK_SECRET',
    'CREDENTIAL_ENCRYPTION_KEY',
    'SESSION_SECRET',
    'GOOGLE_CLIENT_SECRET',
    'MONGODB_URI',
    'REDIS_URL',
  ].flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
] as const;

/** Exported so the security suite can assert against the real list. */
export const LOG_REDACT_PATHS = REDACT_PATHS;

export const logger = pino({
  // Tests assert on behaviour, not log output; silencing keeps runs readable.
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  base: {
    service: 'automail-autocaller-api',
    environment: env.NODE_ENV,
  },
  /**
   * Secrets must never reach the log stream.
   *
   * pino matches redact paths literally, so a bare key does NOT match a nested
   * one: every shape a secret can appear in has to be listed. The `*.` and
   * `*.*.` wildcards cover the nesting depths that actually occur here (a
   * request body, a service payload, an error's captured context, a config
   * object). Keys are also listed in the SCREAMING_CASE form because config
   * objects are logged with their environment-variable names.
   */
  redact: {
    paths: [...REDACT_PATHS],
    censor: '[REDACTED]',
  },
});
