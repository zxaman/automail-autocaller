import pino from 'pino';
import { describe, expect, it } from 'vitest';

/**
 * The logger is configured to silent under NODE_ENV=test, so these tests
 * rebuild a logger with the same redaction config and a capture stream. What
 * is being verified is the redaction policy itself, not pino.
 */
const REDACT_PATHS = [
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
];

const APP_PASSWORD = 'abcdefghijklmnop';

function captureLog(payload: Record<string, unknown>): string {
  const lines: string[] = [];
  const stream = {
    write: (line: string) => {
      lines.push(line);
    },
  };

  const testLogger = pino(
    { level: 'info', redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } },
    stream as never,
  );

  testLogger.info(payload, 'test message');
  return lines.join('');
}

describe('logger redaction', () => {
  it('redacts a top-level App Password', () => {
    const output = captureLog({ appPassword: APP_PASSWORD });

    expect(output).not.toContain(APP_PASSWORD);
    expect(output).toContain('[REDACTED]');
  });

  it('redacts an App Password inside a request body', () => {
    const output = captureLog({
      req: { body: { email: 'user@gmail.com', appPassword: APP_PASSWORD } },
    });

    expect(output).not.toContain(APP_PASSWORD);
  });

  it('redacts an App Password nested one level deep', () => {
    const output = captureLog({ input: { appPassword: APP_PASSWORD } });

    expect(output).not.toContain(APP_PASSWORD);
  });

  it('redacts the encrypted credential envelope as well as the plaintext', () => {
    const output = captureLog({
      account: { credential: { ciphertext: 'AAAABBBBCCCC', iv: 'x', authTag: 'y' } },
    });

    expect(output).not.toContain('AAAABBBBCCCC');
  });

  it('still logs the surrounding non-secret context', () => {
    const output = captureLog({ email: 'user@gmail.com', appPassword: APP_PASSWORD });

    expect(output).toContain('user@gmail.com');
    expect(output).not.toContain(APP_PASSWORD);
  });

  it('redacts authorization and cookie headers', () => {
    const output = captureLog({
      req: { headers: { authorization: 'Bearer secret-token', cookie: 'sid=abc123' } },
    });

    expect(output).not.toContain('secret-token');
    expect(output).not.toContain('sid=abc123');
  });
});
