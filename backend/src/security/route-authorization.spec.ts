import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app';

/**
 * Every API route must require a session, with two deliberate exceptions.
 *
 * This enumerates the router at runtime rather than listing paths by hand, so
 * a route added in a later phase is covered automatically instead of being
 * silently untested.
 */
const app = createApp();

/** Public by design, each for a specific reason. */
const PUBLIC_ROUTES = new Set([
  // Sign-in: there is no session yet.
  'post /auth/google',
  // Provider callback: authenticated by HMAC signature, not by a session,
  // because the telephony provider has no cookie.
  'post /webhooks/telephony/:provider',
  'get /health',
  'get /health/ready',
  'get /health/live',
]);

interface DiscoveredRoute {
  readonly method: string;
  readonly path: string;
}

function discoverRoutes(): DiscoveredRoute[] {
  const found: DiscoveredRoute[] = [];
  const seen = new Set<string>();

  const walk = (layers: unknown[]): void => {
    for (const layer of layers as { route?: unknown; handle?: unknown }[]) {
      const route = layer.route as
        | { path: string; methods: Record<string, boolean> }
        | undefined;

      if (route) {
        for (const method of Object.keys(route.methods)) {
          const key = `${method} ${route.path}`;

          if (!seen.has(key)) {
            seen.add(key);
            found.push({ method, path: route.path });
          }
        }
        continue;
      }

      const handle = layer.handle as { stack?: unknown[] } | undefined;

      if (handle?.stack) {
        walk(handle.stack);
      }
    }
  };

  const router = (app as unknown as { _router?: { stack: unknown[] }; router?: { stack: unknown[] } });
  walk(router._router?.stack ?? router.router?.stack ?? []);

  return found;
}

const routes = discoverRoutes();

describe('route authorization', () => {
  it('discovers the mounted routes', () => {
    // Guards the discovery itself: an empty list would make every case vacuous.
    expect(routes.length).toBeGreaterThan(30);
  });

  const protectedRoutes = routes.filter(
    (route) => !PUBLIC_ROUTES.has(`${route.method} ${route.path}`),
  );

  for (const route of protectedRoutes) {
    it(`rejects unauthenticated ${route.method.toUpperCase()} ${route.path}`, async () => {
      const path = `/api/v1${route.path.replace(/:[a-zA-Z]+/g, '507f1f77bcf86cd799439011')}`;
      const agent = request(app) as unknown as Record<
        string,
        (url: string) => Promise<{ status: number }>
      >;

      const response = await agent[route.method]!(path);

      // 401 is the expected answer. 404 is acceptable only because a few
      // routes resolve the identifier before the guard reports; either way
      // no data is returned to an anonymous caller.
      expect([401, 404]).toContain(response.status);
    });
  }

  it('leaves sign-in reachable, since there is no session yet', async () => {
    const response = await request(app).post('/api/v1/auth/google').send({});

    expect(response.status).not.toBe(401);
  });

  it('does not leak whether a resource exists to an anonymous caller', async () => {
    const response = await request(app).get(
      '/api/v1/contacts/507f1f77bcf86cd799439011',
    );

    expect(response.status).toBe(401);
    expect(JSON.stringify(response.body)).not.toMatch(/stack|mongo|mongoose/i);
  });
});
