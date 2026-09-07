import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { LOG_REDACT_PATHS } from '../infrastructure/logger/logger';

/**
 * Secrets must never reach the log stream.
 *
 * This asserts on real pino output rather than on the path list, because the
 * bug this replaces was a list that looked complete but did not match the
 * shapes secrets actually appear in.
 */
function captureLog(payload: Record<string, unknown>): string {
  const chunks: string[] = [];
  const stream = {
    write: (chunk: string) => {
      chunks.push(chunk);
    },
  };

  const logger = pino(
    { level: 'info', redact: { paths: [...LOG_REDACT_PATHS], censor: '[REDACTED]' } },
    stream,
  );

  logger.info(payload, 'probe');

  return chunks.join('');
}

describe('log redaction', () => {
  const secret = 'SUPER-SECRET-VALUE';

  const secretKeys = [
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
    'encryptionKey',
    'exotelApiToken',
    'EXOTEL_API_TOKEN',
    'TELEPHONY_WEBHOOK_SECRET',
    'CREDENTIAL_ENCRYPTION_KEY',
    'GOOGLE_CLIENT_SECRET',
    'MONGODB_URI',
  ];

  for (const key of secretKeys) {
    it(`redacts ${key} at the top level`, () => {
      expect(captureLog({ [key]: secret })).not.toContain(secret);
    });

    it(`redacts ${key} one level deep`, () => {
      expect(captureLog({ config: { [key]: secret } })).not.toContain(secret);
    });

    it(`redacts ${key} two levels deep`, () => {
      expect(captureLog({ err: { context: { [key]: secret } } })).not.toContain(secret);
    });
  }

  it('redacts the authorization and cookie request headers', () => {
    const output = captureLog({
      req: { headers: { authorization: secret, cookie: secret } },
    });

    expect(output).not.toContain(secret);
  });

  it('redacts the provider webhook signature header', () => {
    const output = captureLog({
      req: { headers: { 'x-exotel-signature': secret } },
    });

    expect(output).not.toContain(secret);
  });

  it('still logs the surrounding non-secret context', () => {
    // Redaction must not be so broad that logs stop being useful.
    const output = captureLog({ requestId: 'req-123', password: secret });

    expect(output).toContain('req-123');
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain(secret);
  });
});
