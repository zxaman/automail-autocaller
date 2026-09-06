import type { RequestHandler } from 'express';

import { SESSION_COOKIE_NAME } from '../modules/auth/auth.cookie';
import type { SessionService } from '../modules/auth/session.service';
import { UserModel } from '../modules/users/user.model';
import { AppError } from '../shared/errors/app-error';

/**
 * Resolves the session cookie into a request-scoped AuthContext.
 *
 * Every protected route depends on this so that downstream queries can be
 * scoped by userId/workspaceId rather than trusting any client-supplied ID.
 */
export function createAuthenticateMiddleware(sessionService: SessionService): RequestHandler {
  return (req, _res, next) => {
    void (async () => {
      try {
        const cookies = req.cookies as Record<string, string | undefined> | undefined;
        const token = cookies?.[SESSION_COOKIE_NAME];

        if (!token) {
          throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
        }

        const session = await sessionService.resolve(token);
        if (!session) {
          throw new AppError('Your session has expired', 401, 'SESSION_EXPIRED');
        }

        const user = await UserModel.findById(session.userId).select('role isActive').exec();
        if (!user || !user.isActive) {
          throw new AppError('Your session is no longer valid', 401, 'SESSION_INVALID');
        }

        req.auth = {
          userId: session.userId,
          workspaceId: session.workspaceId,
          role: user.role,
          sessionId: session._id,
        };

        next();
      } catch (error) {
        next(error);
      }
    })();
  };
}
