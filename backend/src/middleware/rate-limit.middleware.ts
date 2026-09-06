import rateLimit from 'express-rate-limit';

import { env } from '../config/environment';

const isTest = env.NODE_ENV === 'test';

/**
 * Production limits, kept in one place so they can be asserted on.
 *
 * The limiters below relax to a very high ceiling under NODE_ENV=test so the
 * functional suites are not throttled. That relaxation means the limiters are
 * never exercised by those suites, so the security suite builds its own
 * limiters from these values instead.
 */
export const RATE_LIMITS = {
  global: { windowMs: 60_000, limit: 300 },
  auth: { windowMs: 15 * 60_000, limit: 20 },
  credential: { windowMs: 15 * 60_000, limit: 10 },
  send: { windowMs: 60_000, limit: 20 },
  call: { windowMs: 60_000, limit: 10 },
} as const;

/** Test builds relax the ceiling; production uses the real value. */
function limitFor(limit: number): number {
  return isTest ? 100_000 : limit;
}

function jsonLimitResponse(code: string, message: string) {
  return {
    success: false,
    message,
    error: { code },
  };
}

/** Broad protection for the whole API surface. */
export const globalRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.global.windowMs,
  limit: limitFor(RATE_LIMITS.global.limit),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonLimitResponse('RATE_LIMITED', 'Too many requests. Please retry shortly.'),
});

/** Tighter limit on credential endpoints to blunt brute-force and token replay. */
export const authRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.auth.windowMs,
  limit: limitFor(RATE_LIMITS.auth.limit),
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
  windowMs: RATE_LIMITS.credential.windowMs,
  limit: limitFor(RATE_LIMITS.credential.limit),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonLimitResponse(
    'CREDENTIAL_RATE_LIMITED',
    'Too many attempts. Please wait a few minutes before trying again.',
  ),
});

/**
 * Sending is expensive and irreversible, and Gmail enforces a daily cap.
 * This limits how fast a client can request sends; it is a guard against
 * runaway scripts, not a substitute for the queue's own pacing.
 */
export const sendRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.send.windowMs,
  limit: limitFor(RATE_LIMITS.send.limit),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonLimitResponse(
    'EMAIL_SEND_RATE_LIMITED',
    'Too many send requests. Please wait a moment before sending again.',
  ),
});

/**
 * Each accepted request dials a real phone and costs money. This is a guard
 * against a runaway client, and it also enforces that calling stays a manual,
 * one-at-a-time action rather than an auto-dialler.
 */
export const callRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.call.windowMs,
  limit: limitFor(RATE_LIMITS.call.limit),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: jsonLimitResponse(
    'CALL_RATE_LIMITED',
    'Too many call attempts. Please wait a moment before dialing again.',
  ),
});
