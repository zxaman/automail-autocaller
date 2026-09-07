import { describe, expect, it } from 'vitest';

import { APP_ROUTES } from './app.routes';
import { authGuard } from './core/guards/auth.guard';

describe('APP_ROUTES', () => {
  const shellRoute = APP_ROUTES.find((route) => route.path === '');

  it('protects the application shell with the auth guard', () => {
    expect(shellRoute?.canActivate).toContain(authGuard);
  });

  it('lazy loads every feature page', () => {
    const children = shellRoute?.children ?? [];
    const featureRoutes = children.filter((route) => route.path !== '');
    expect(featureRoutes.length).toBeGreaterThanOrEqual(8);
    expect(featureRoutes.every((route) => typeof route.loadComponent === 'function')).toBe(true);
  });

  it('registers a wildcard route', () => {
    expect(APP_ROUTES.some((route) => route.path === '**')).toBe(true);
  });
});
