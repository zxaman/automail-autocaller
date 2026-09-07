import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * Ensures cookie-based session credentials are sent with API requests and marks
 * requests as XHR so the backend can apply CSRF-safe handling.
 *
 * The path test allows an absolute URL as well as a relative one: a native
 * build calls the API on a configured origin, so matching only `/api` would
 * silently drop credentials on mobile and log the user out on every request.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isApiRequest(request.url)) {
    return next(request);
  }

  return next(
    request.clone({
      withCredentials: true,
      setHeaders: { 'X-Requested-With': 'XMLHttpRequest' },
    }),
  );
};

function isApiRequest(url: string): boolean {
  if (url.startsWith('/api')) {
    return true;
  }

  // Absolute URL: match on the path so an unrelated third-party host that
  // happens to contain "/api" in its query string is not treated as ours.
  try {
    return new URL(url).pathname.startsWith('/api');
  } catch {
    return false;
  }
}
