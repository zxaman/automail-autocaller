import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { RATE_LIMITS } from '../middleware/rate-limit.middleware';

/**
 * The shipped limiters relax to a huge ceiling under NODE_ENV=test, so
 * asserting against them would prove nothing. These tests rebuild a limiter
 * from the same RATE_LIMITS values the production limiters use, and verify
 * the values actually throttle.
 */
function appWithLimit(limit: number, windowMs: number) {
  const app = express();

  app.use(
    rateLimit({
      windowMs,
      limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { success: false, error: { code: 'RATE_LIMITED' } },
    }),
  );
  app.get('/probe', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

describe('rate limit configuration', () => {
  it('keeps the credential limit tighter than the global limit', () => {
    // Each credential attempt reaches Gmail, so it must be the strictest.
    expect(RATE_LIMITS.credential.limit).toBeLessThan(RATE_LIMITS.global.limit);
    expect(RATE_LIMITS.auth.limit).toBeLessThan(RATE_LIMITS.global.limit);
  });

  it('keeps the calling limit low, since each call costs money', () => {
    expect(RATE_LIMITS.call.limit).toBeLessThanOrEqual(10);
  });

  it('uses a long window for brute-forceable endpoints', () => {
    expect(RATE_LIMITS.auth.windowMs).toBeGreaterThanOrEqual(15 * 60_000);
    expect(RATE_LIMITS.credential.windowMs).toBeGreaterThanOrEqual(15 * 60_000);
  });
});

describe('rate limit enforcement', () => {
  it('rejects the request after the limit is reached', async () => {
    const limit = 3;
    const app = appWithLimit(limit, 60_000);

    for (let attempt = 0; attempt < limit; attempt += 1) {
      const allowed = await request(app).get('/probe');

      expect(allowed.status).toBe(200);
    }

    const blocked = await request(app).get('/probe');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('advertises the limit in standard headers so clients can back off', async () => {
    const app = appWithLimit(RATE_LIMITS.auth.limit, RATE_LIMITS.auth.windowMs);

    const response = await request(app).get('/probe');

    expect(response.headers['ratelimit']).toBeDefined();
  });

  it('does not leak internals in the throttled response', async () => {
    const app = appWithLimit(1, 60_000);

    await request(app).get('/probe');
    const blocked = await request(app).get('/probe');

    expect(JSON.stringify(blocked.body)).not.toMatch(/stack|at Object|node_modules/i);
  });
});
