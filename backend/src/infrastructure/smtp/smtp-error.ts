/**
 * Maps raw SMTP/Nodemailer failures onto a small set of safe, actionable codes.
 *
 * Raw SMTP responses are never surfaced: they can echo the submitted username,
 * reveal whether an address exists, and vary in ways that invite credential
 * probing. Everything collapses to a fixed vocabulary with user-facing guidance.
 */

export type SmtpFailureCode =
  | 'SMTP_AUTH_FAILED'
  | 'SMTP_CONNECTION_FAILED'
  | 'SMTP_TIMEOUT'
  | 'SMTP_RATE_LIMITED'
  | 'SMTP_UNAVAILABLE';

export interface SmtpFailure {
  code: SmtpFailureCode;
  message: string;
  /** Whether retrying the same credential could plausibly succeed later. */
  retryable: boolean;
}

interface NodemailerLikeError {
  code?: string;
  responseCode?: number;
  command?: string;
  message?: string;
}

const AUTH_MESSAGE =
  'Gmail rejected those credentials. Check the email address, and make sure you used a ' +
  '16-character App Password generated for this app rather than your normal Gmail password. ' +
  'App Passwords require 2-Step Verification to be enabled on the Google account.';

export function classifySmtpError(error: unknown): SmtpFailure {
  const candidate = (error ?? {}) as NodemailerLikeError;
  const code = candidate.code ?? '';
  const responseCode = candidate.responseCode ?? 0;

  // 535 is Gmail's "username and password not accepted".
  if (code === 'EAUTH' || responseCode === 535 || responseCode === 534) {
    return { code: 'SMTP_AUTH_FAILED', message: AUTH_MESSAGE, retryable: false };
  }

  if (code === 'ETIMEDOUT' || code === 'ESOCKET' && /timed?\s*out/i.test(candidate.message ?? '')) {
    return {
      code: 'SMTP_TIMEOUT',
      message: 'Gmail did not respond in time. Please try again in a moment.',
      retryable: true,
    };
  }

  // 421/450/452 are Gmail throttling or temporary capacity limits.
  if (responseCode === 421 || responseCode === 450 || responseCode === 452) {
    return {
      code: 'SMTP_RATE_LIMITED',
      message:
        'Gmail is temporarily rate limiting this account. Wait a few minutes before trying again.',
      retryable: true,
    };
  }

  if (code === 'ECONNECTION' || code === 'ECONNREFUSED' || code === 'EDNS' || code === 'ESOCKET') {
    return {
      code: 'SMTP_CONNECTION_FAILED',
      message: 'Could not reach Gmail. Check the server connection and try again.',
      retryable: true,
    };
  }

  return {
    code: 'SMTP_UNAVAILABLE',
    message: 'Gmail could not be reached right now. Please try again.',
    retryable: true,
  };
}
