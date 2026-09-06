import type { CookieOptions, Response } from 'express';

import { env } from '../../config/environment';

export const SESSION_COOKIE_NAME = 'aca_session';

/**
 * HttpOnly so JavaScript (and therefore XSS) cannot read the session.
 * SameSite=Lax blocks cross-site form/navigation CSRF while allowing the normal
 * top-level return from the Google sign-in flow.
 */
function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE_NAME, token, { ...baseCookieOptions(), expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, baseCookieOptions());
}
