import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { map, of } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Blocks protected routes until a valid session is confirmed by the backend.
 *
 * The session is normally already resolved by the app initializer, so this
 * usually decides synchronously without an extra request.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const deny = () =>
    router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });

  if (auth.isAuthenticated()) {
    return of(true);
  }

  if (auth.isResolved()) {
    return of(deny());
  }

  return auth.loadSession().pipe(map((user) => (user ? true : deny())));
};
