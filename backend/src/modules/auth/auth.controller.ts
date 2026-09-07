import type { RequestHandler } from 'express';

import { sendSuccess } from '../../shared/http/api-response';
import { AppError } from '../../shared/errors/app-error';
import { SESSION_COOKIE_NAME, clearSessionCookie, setSessionCookie } from './auth.cookie';
import type { AuthService } from './auth.service';
import type { RegisterInput, LoginInput } from './auth.validation';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  public register: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const input = req.body as RegisterInput;
        const result = await this.authService.register(input, {
          userAgent: req.header('user-agent')?.slice(0, 512) ?? null,
          ipAddress: req.ip ?? null,
        });

        setSessionCookie(res, result.token, result.expiresAt);
        sendSuccess(res, 201, 'Your workspace is ready', result.user);
      } catch (error) {
        next(error);
      }
    })();
  };

  public login: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const input = req.body as LoginInput;
        const result = await this.authService.login(input, {
          userAgent: req.header('user-agent')?.slice(0, 512) ?? null,
          ipAddress: req.ip ?? null,
        });

        setSessionCookie(res, result.token, result.expiresAt);
        sendSuccess(res, 200, 'Signed in successfully', result.user);
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
