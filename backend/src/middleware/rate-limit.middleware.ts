import rateLimit from 'express-rate-limit';

import { env } from '../config/environment';

const isTest = env.NODE_ENV === 'test';

function jsonLimitResponse(code: string, message: string) {
  return {
    success: false,
    message,
    error: { code },
  };
}

/** Broad protection for the whole API surface. */
export const globalRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: isTest ? 100_000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonLimitResponse('RATE_LIMITED', 'Too many requests. Please retry shortly.'),
});

/** Tighter limit on credential endpoints to blunt brute-force and token replay. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: isTest ? 100_000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonLimitResponse('AUTH_RATE_LIMITED', 'Too many sign-in attempts. Please wait and retry.'),
});

/**
 * Guards endpoints that accept or exercise Gmail credentials. Tighter than the
 * global limit because each attempt reaches an external provider and a loose
 * limit here would let an attacker probe App Passwords.
 */
export const credentialRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: isTest ? 100_000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonLimitResponse(
    'CREDENTIAL_RATE_LIMITED',
    'Too many attempts. Please wait a few minutes before trying again.',
  ),
});
