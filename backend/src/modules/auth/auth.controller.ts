import type { RequestHandler } from 'express';

import { sendSuccess } from '../../shared/http/api-response';
import { AppError } from '../../shared/errors/app-error';
import { SESSION_COOKIE_NAME, clearSessionCookie, setSessionCookie } from './auth.cookie';
import type { AuthService } from './auth.service';
import type { GoogleLoginInput } from './auth.validation';

/**
 * HTTP boundary for authentication. Contains no business logic: it translates
 * requests into service calls and service results into HTTP responses.
 */
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  public loginWithGoogle: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const { idToken } = req.body as GoogleLoginInput;

        const result = await this.authService.loginWithGoogle(idToken, {
          userAgent: req.header('user-agent')?.slice(0, 512) ?? null,
          ipAddress: req.ip ?? null,
        });

        setSessionCookie(res, result.token, result.expiresAt);
        sendSuccess(
          res,
          result.isNewUser ? 201 : 200,
          result.isNewUser ? 'Your workspace is ready' : 'Signed in successfully',
          result.user,
        );
      } catch (error) {
        next(error);
      }
    })();
  };

  public getCurrentUser: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        if (!req.auth) {
          throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
        }
        const user = await this.authService.getCurrentUser(req.auth.userId);
        sendSuccess(res, 200, 'Session is active', user);
      } catch (error) {
        next(error);
      }
    })();
  };

  public logout: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const cookies = req.cookies as Record<string, string | undefined> | undefined;
        const token = cookies?.[SESSION_COOKIE_NAME];
        if (token) {
          await this.authService.logout(token);
        }
        clearSessionCookie(res);
        sendSuccess(res, 200, 'Signed out successfully', { signedOut: true });
      } catch (error) {
        next(error);
      }
    })();
  };
}
