import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app';

const app = createApp();

describe('API foundation', () => {
  it('returns a healthy response', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        service: 'automail-autocaller-api',
        status: 'ok',
      },
    });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('returns a consistent not-found error', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
      },
    });
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });

  it('returns a consistent JSON parse error', async () => {
    const response = await request(app)
      .post('/api/v1/health')
      .set('content-type', 'application/json')
      .send('{"invalid"');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_REQUEST_BODY',
      },
    });
  });
});
