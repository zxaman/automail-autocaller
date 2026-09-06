import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * Ensures cookie-based session credentials are sent with API requests and marks
 * requests as XHR so the backend can apply CSRF-safe handling.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api')) {
    return next(request);
  }

  return next(
    request.clone({
      withCredentials: true,
      setHeaders: { 'X-Requested-With': 'XMLHttpRequest' },
    }),
  );
};
