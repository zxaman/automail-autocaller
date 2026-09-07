import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

/**
 * Metrics expose business volume, so the endpoint must never be open.
 */
vi.mock('../config/environment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/environment')>();

  return {
    ...actual,
    env: { ...actual.env, METRICS_TOKEN: 'scrape-token' },
  };
});

const { createApp } = await import('../app');

const app = createApp();

describe('metrics endpoint', () => {
  it('rejects a request with no token', async () => {
    const response = await request(app).get('/api/v1/metrics');

    expect(response.status).toBe(401);
  });

  it('rejects a request with the wrong token', async () => {
    const response = await request(app)
      .get('/api/v1/metrics')
      .set('authorization', 'Bearer wrong');

    expect(response.status).toBe(401);
  });

  it('serves metrics to a correctly authenticated scraper', async () => {
    const response = await request(app)
      .get('/api/v1/metrics')
      .set('authorization', 'Bearer scrape-token');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
  });
});
