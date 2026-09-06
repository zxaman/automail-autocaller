import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { DashboardRepository, DashboardScope } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

const scope: DashboardScope = { workspaceId: new Types.ObjectId() };

function createRepository(overrides: Partial<Record<keyof DashboardRepository, unknown>> = {}) {
  const repository = {
    countContacts: vi.fn().mockResolvedValue(0),
    callStats: vi.fn().mockResolvedValue({
      totalCalls: 0,
      completedCalls: 0,
      missedCalls: 0,
      failedCalls: 0,
      totalCallDurationSeconds: 0,
    }),
    emailStats: vi
      .fn()
      .mockResolvedValue({ totalEmails: 0, successfulEmails: 0, failedEmails: 0 }),
    activitySeries: vi.fn().mockResolvedValue(new Map()),
    recentCalls: vi.fn().mockResolvedValue([]),
    recentEmails: vi.fn().mockResolvedValue([]),
    recentImports: vi.fn().mockResolvedValue([]),
    ...overrides,
  };

  return repository as unknown as DashboardRepository & typeof repository;
}

describe('DashboardService', () => {
  let repository: ReturnType<typeof createRepository>;
  let service: DashboardService;

  beforeEach(() => {
    repository = createRepository();
    service = new DashboardService(repository);
  });

  it('returns a zeroed overview for a workspace with no activity', async () => {
    const snapshot = await service.getSnapshot(scope, { preset: 'today', timezone: 'UTC' });

    expect(snapshot.overview.totalContacts).toBe(0);
    expect(snapshot.overview.callSuccessRate).toBe(0);
    expect(snapshot.overview.averageCallDurationSeconds).toBe(0);
    expect(snapshot.recentCalls).toEqual([]);
  });

  it('derives success rates and averages from the raw counters', async () => {
    repository.callStats = vi.fn().mockResolvedValue({
      totalCalls: 8,
      completedCalls: 6,
      missedCalls: 1,
      failedCalls: 1,
      totalCallDurationSeconds: 900,
    });
    repository.emailStats = vi
      .fn()
      .mockResolvedValue({ totalEmails: 4, successfulEmails: 3, failedEmails: 1 });

    const snapshot = await service.getSnapshot(scope, { preset: 'today', timezone: 'UTC' });

    expect(snapshot.overview.callSuccessRate).toBe(75);
    expect(snapshot.overview.emailSuccessRate).toBe(75);
    expect(snapshot.overview.averageCallDurationSeconds).toBe(150);
    expect(snapshot.overview.totalCommunicationActivity).toBe(12);
  });

  it('keeps the today cards scoped to today even when a wider range is selected', async () => {
    const now = new Date('2026-03-10T12:00:00.000Z');
    await service.getSnapshot(scope, { preset: 'month', timezone: 'UTC' }, now);

    const callStatsMock = repository.callStats as unknown as Mock;
    const rangesUsed = callStatsMock.mock.calls.map((call: unknown[]) => call[1] as
      | { from: Date; to: Date }
      | undefined);
    expect(rangesUsed[0]).toBeUndefined();

    const todayRange = rangesUsed.find((range) => range !== undefined);
    expect(todayRange?.from.toISOString()).toBe('2026-03-10T00:00:00.000Z');
    expect(todayRange?.to.toISOString()).toBe('2026-03-11T00:00:00.000Z');
  });

  it('emits one activity point per day, filling gaps with zeroes', async () => {
    repository.activitySeries = vi
      .fn()
      .mockResolvedValue(new Map([['2026-03-10', { calls: 3, emails: 2 }]]));

    const snapshot = await service.getSnapshot(
      scope,
      { preset: 'week', timezone: 'UTC' },
      new Date('2026-03-10T12:00:00.000Z'),
    );

    expect(snapshot.activity).toHaveLength(7);
    expect(snapshot.activity[0]?.date).toBe('2026-03-04');
    expect(snapshot.activity[6]).toEqual({ date: '2026-03-10', calls: 3, emails: 2 });
    expect(snapshot.activity[5]).toEqual({ date: '2026-03-09', calls: 0, emails: 0 });
  });

  it('buckets activity days using the caller timezone, not UTC', async () => {
    const snapshot = await service.getSnapshot(
      scope,
      { preset: 'today', timezone: 'Asia/Kolkata' },
      new Date('2026-03-10T20:00:00.000Z'),
    );

    // 20:00Z is already 2026-03-11 in India.
    expect(snapshot.activity).toEqual([{ date: '2026-03-11', calls: 0, emails: 0 }]);
    expect(snapshot.range.timezone).toBe('Asia/Kolkata');
  });

  it('passes the same workspace scope to every repository query', async () => {
    await service.getSnapshot(scope, { preset: 'today', timezone: 'UTC' });

    for (const spy of [
      repository.countContacts,
      repository.recentCalls,
      repository.recentEmails,
      repository.recentImports,
    ]) {
      expect(spy).toHaveBeenCalledWith(scope);
    }
  });

  it('falls back to UTC when the timezone is not a real IANA zone', async () => {
    const snapshot = await service.getSnapshot(scope, {
      preset: 'today',
      timezone: 'Mars/Olympus',
    });

    expect(snapshot.range.timezone).toBe('UTC');
  });
});
