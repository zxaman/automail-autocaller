import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app';

const app = createApp();

describe('health endpoints', () => {
  it('reports liveness without consulting dependencies', async () => {
    // No database is reachable in this suite, yet liveness must still pass:
    // a dependency blip must not cause an orchestrator restart loop.
    const response = await request(app).get('/api/v1/health/live');

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
  });

  it('keeps the original /health path working', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
  });

  it('fails readiness when the database is not connected', async () => {
    const response = await request(app).get('/api/v1/health/ready');

    // 503 takes the instance out of the load balancer rotation.
    expect(response.status).toBe(503);
    expect(response.body.data.dependencies.database.status).toBe('not-ready');
  });

  it('includes queue depth and version for operators', async () => {
    const response = await request(app).get('/api/v1/health/ready');

    expect(response.body.data).toHaveProperty('queueDepth');
    expect(response.body.data).toHaveProperty('version');
    expect(response.body.data).toHaveProperty('uptimeSeconds');
  });

  it('disables metrics when no token is configured', async () => {
    const response = await request(app).get('/api/v1/metrics');

    expect(response.status).toBe(404);
  });
});
