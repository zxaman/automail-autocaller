import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { map, of } from 'rxjs';

import { AuthService } from '../services/auth.service';

/** Keeps authenticated users out of the login screen. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return of(router.createUrlTree(['/dashboard']));
  }

  return auth.loadSession().pipe(map((user) => (user ? router.createUrlTree(['/dashboard']) : true)));
};
