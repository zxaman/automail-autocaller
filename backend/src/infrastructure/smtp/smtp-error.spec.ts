import { describe, expect, it } from 'vitest';

import { classifySmtpError } from './smtp-error';

describe('classifySmtpError', () => {
  it('classifies a rejected App Password as an auth failure that must not be retried', () => {
    const failure = classifySmtpError({ code: 'EAUTH', responseCode: 535 });

    expect(failure.code).toBe('SMTP_AUTH_FAILED');
    expect(failure.retryable).toBe(false);
  });

  it('tells the user specifically to use an App Password', () => {
    const failure = classifySmtpError({ code: 'EAUTH' });

    expect(failure.message).toMatch(/App Password/);
    expect(failure.message).toMatch(/2-Step Verification/);
  });

  it('classifies Gmail throttling as retryable', () => {
    expect(classifySmtpError({ responseCode: 421 }).code).toBe('SMTP_RATE_LIMITED');
    expect(classifySmtpError({ responseCode: 421 }).retryable).toBe(true);
  });

  it('classifies connection problems as retryable', () => {
    expect(classifySmtpError({ code: 'ECONNREFUSED' }).code).toBe('SMTP_CONNECTION_FAILED');
    expect(classifySmtpError({ code: 'ETIMEDOUT' }).code).toBe('SMTP_TIMEOUT');
  });

  it('falls back to a safe generic failure for anything unrecognised', () => {
    const failure = classifySmtpError(new Error('some internal driver explosion'));

    expect(failure.code).toBe('SMTP_UNAVAILABLE');
    expect(failure.message).not.toContain('driver explosion');
  });

  it('never echoes the raw SMTP response back to the caller', () => {
    const failure = classifySmtpError({
      code: 'EAUTH',
      responseCode: 535,
      message: '535-5.7.8 Username and Password not accepted. user=victim@gmail.com pass=abcd1234',
    });

    expect(failure.message).not.toMatch(/victim@gmail\.com/);
    expect(failure.message).not.toMatch(/abcd1234/);
  });

  it('handles a null or undefined error without throwing', () => {
    expect(classifySmtpError(null).code).toBe('SMTP_UNAVAILABLE');
    expect(classifySmtpError(undefined).code).toBe('SMTP_UNAVAILABLE');
  });
});
