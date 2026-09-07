import type { HttpInterceptorFn } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

/** Centralized handling for expired sessions and unreachable API responses. */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        const isSessionProbe = request.url.includes('/auth/me');
        auth.clearSession();
        if (!isSessionProbe && !router.url.startsWith('/auth')) {
          void router.navigate(['/auth/login'], { queryParams: { reason: 'session-expired' } });
        }
      }
      return throwError(() => error);
    }),
  );
};
