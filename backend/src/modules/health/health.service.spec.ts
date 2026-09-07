import { describe, expect, it, vi } from 'vitest';

import { HealthService } from './health.service';

vi.mock('../../infrastructure/database/mongoose', () => ({
  isDatabaseReady: () => databaseReady,
}));

let databaseReady = true;

function queue(name: string, size: () => Promise<number>) {
  return { name, size };
}

describe('HealthService', () => {
  it('reports ready when the database and a redis queue are healthy', async () => {
    databaseReady = true;
    const service = new HealthService(queue('redis', async () => 0));

    const report = await service.report();

    expect(report.ready).toBe(true);
    expect(report.dependencies['database']?.status).toBe('ready');
    expect(report.dependencies['queue']?.status).toBe('ready');
  });

  it('is not ready when the database connection is closed', async () => {
    databaseReady = false;
    const service = new HealthService(queue('redis', async () => 0));

    const report = await service.report();

    // A load balancer must stop sending traffic here.
    expect(report.ready).toBe(false);
    expect(report.dependencies['database']?.status).toBe('not-ready');
  });

  it('is not ready when the queue backend is unreachable', async () => {
    databaseReady = true;
    const service = new HealthService(
      queue('redis', async () => {
        throw new Error('ECONNREFUSED');
      }),
    );

    const report = await service.report();

    expect(report.ready).toBe(false);
    expect(report.dependencies['queue']?.detail).toContain('ECONNREFUSED');
  });

  it('flags the in-process queue as degraded but stays ready', async () => {
    databaseReady = true;
    const service = new HealthService(queue('in-process', async () => 3));

    const report = await service.report();

    // The app works, so it must keep serving; the operator still needs to know
    // that a restart would drop queued mail.
    expect(report.ready).toBe(true);
    expect(report.dependencies['queue']?.status).toBe('degraded');
    expect(report.dependencies['queue']?.detail).toMatch(/lost on restart/i);
  });

  it('exposes queue depth so a stalled worker is visible', async () => {
    databaseReady = true;
    const service = new HealthService(queue('redis', async () => 42));

    const report = await service.report();

    expect(report.queueDepth).toBe(42);
  });

  it('reports uptime and version for correlating incidents with deploys', async () => {
    databaseReady = true;
    const service = new HealthService(
      queue('redis', async () => 0),
      Date.now() - 5_000,
      '1.2.3',
    );

    const report = await service.report();

    expect(report.uptimeSeconds).toBeGreaterThanOrEqual(4);
    expect(report.version).toBe('1.2.3');
  });
});
