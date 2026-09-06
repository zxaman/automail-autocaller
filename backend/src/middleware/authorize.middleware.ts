import type { RequestHandler } from 'express';

import type { UserRole } from '../modules/users/user.model';
import { AppError } from '../shared/errors/app-error';

/**
 * Role gate for future team features. Authentication must run first.
 */
export function authorize(...allowedRoles: readonly UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new AppError('Authentication is required', 401, 'UNAUTHENTICATED'));
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.auth.role)) {
      next(new AppError('You do not have access to this resource', 403, 'FORBIDDEN'));
      return;
    }

    next();
  };
}
