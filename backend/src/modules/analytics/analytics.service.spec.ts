import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { AnalyticsService } from './analytics.service';

const workspaceId = new Types.ObjectId();
const scope = { workspaceId };

const emptyCalls = {
  totalCalls: 0,
  connectedCalls: 0,
  missedCalls: 0,
  failedCalls: 0,
  totalDurationSeconds: 0,
  longestCallSeconds: 0,
};

describe('AnalyticsService', () => {
  let repository: {
    callAnalytics: Mock;
    callStatusBreakdown: Mock;
    emailAnalytics: Mock;
    emailStatusBreakdown: Mock;
    importAnalytics: Mock;
    callBuckets: Mock;
    emailBuckets: Mock;
    mostContacted: Mock;
    findContactsByIds: Mock;
  };
  let service: AnalyticsService;

  beforeEach(() => {
    repository = {
      callAnalytics: vi.fn().mockResolvedValue(emptyCalls),
      callStatusBreakdown: vi.fn().mockResolvedValue([]),
      emailAnalytics: vi
        .fn()
        .mockResolvedValue({ totalEmails: 0, sentEmails: 0, failedEmails: 0 }),
      emailStatusBreakdown: vi.fn().mockResolvedValue([]),
      importAnalytics: vi.fn().mockResolvedValue({
        totalBatches: 0,
        totalRows: 0,
        successfulRows: 0,
        duplicateRows: 0,
        failedRows: 0,
      }),
      callBuckets: vi.fn().mockResolvedValue([]),
      emailBuckets: vi.fn().mockResolvedValue([]),
      mostContacted: vi.fn().mockResolvedValue([]),
      findContactsByIds: vi.fn().mockResolvedValue([]),
    };
    service = new AnalyticsService(repository as never);
  });

  const summary = (overrides: Record<string, unknown> = {}) =>
    service.getSummary(scope, {
      preset: 'week',
      timezone: 'Asia/Kolkata',
      now: new Date('2026-03-10T12:00:00.000Z'),
      ...overrides,
    });

  describe('rates', () => {
    it('averages call duration over connected calls, not all calls', async () => {
      // 600s across 4 connected calls; 6 more rang out with no conversation.
      repository.callAnalytics.mockResolvedValue({
        ...emptyCalls,
        totalCalls: 10,
        connectedCalls: 4,
        missedCalls: 6,
        totalDurationSeconds: 600,
        longestCallSeconds: 300,
      });

      const result = await summary();

      expect(result.calls.averageDurationSeconds).toBe(150);
      expect(result.calls.successRate).toBe(40);
    });

    it('excludes drafts from the email success rate', async () => {
      // 10 created, but only 6 were ever attempted (5 sent + 1 failed).
      repository.emailAnalytics.mockResolvedValue({
        totalEmails: 10,
        sentEmails: 5,
        failedEmails: 1,
      });

      const result = await summary();

      expect(result.emails.successRate).toBeCloseTo(83.3, 1);
      expect(result.emails.pendingEmails).toBe(4);
    });

    it('reports zero rather than NaN when nothing happened', async () => {
      const result = await summary();

      expect(result.calls.successRate).toBe(0);
      expect(result.calls.averageDurationSeconds).toBe(0);
      expect(result.emails.successRate).toBe(0);
      expect(result.imports.successRate).toBe(0);
    });

    it('rounds a rate to one decimal place', async () => {
      repository.callAnalytics.mockResolvedValue({
        ...emptyCalls,
        totalCalls: 3,
        connectedCalls: 1,
      });

      const result = await summary();

      expect(result.calls.successRate).toBe(33.3);
    });
  });

  describe('activity series', () => {
    it('emits one point per day including days with no activity', async () => {
      const result = await summary({ preset: 'week' });

      // A rolling week is 7 local days, all present even though empty.
      expect(result.activity).toHaveLength(7);
      expect(result.activity.every((point) => point.calls === 0)).toBe(true);
    });

    it('fills a quiet day with an explicit zero instead of omitting it', async () => {
      repository.callBuckets.mockResolvedValue([
        { _id: '2026-03-10', total: 4, successful: 3 },
      ]);

      const result = await summary({ preset: 'week' });
      const busy = result.activity.find((point) => point.label === '2026-03-10');

      expect(busy?.calls).toBe(4);
      expect(busy?.connectedCalls).toBe(3);
      expect(result.activity.filter((point) => point.calls === 0)).toHaveLength(6);
    });

    it('buckets by the user timezone, not the server one', async () => {
      // 22:30 UTC on Mar 9 is 04:00 IST on Mar 10.
      const result = await service.getSummary(scope, {
        preset: 'today',
        timezone: 'Asia/Kolkata',
        now: new Date('2026-03-09T22:30:00.000Z'),
      });

      expect(result.activity).toHaveLength(1);
      expect(result.activity[0]?.date).toBe('2026-03-10');
      expect(result.range.timezone).toBe('Asia/Kolkata');
    });

    it('rolls long ranges up so the chart stays readable', async () => {
      const result = await summary({
        preset: 'custom',
        from: '2025-01-01',
        to: '2025-12-31',
      });

      expect(result.range.granularity).toBe('month');
      expect(result.activity.length).toBeLessThanOrEqual(12);
    });

    it('uses weekly buckets for a mid-length range', async () => {
      const result = await summary({
        preset: 'custom',
        from: '2026-01-01',
        to: '2026-03-01',
      });

      expect(result.range.granularity).toBe('week');
    });

    it('honours an explicit granularity over the default', async () => {
      const result = await summary({ preset: 'week', granularity: 'month' });

      expect(result.range.granularity).toBe('month');
    });

    it('matches Mongo ISO week keys so buckets line up', async () => {
      repository.callBuckets.mockResolvedValue([
        { _id: '2026-W11', total: 9, successful: 9 },
      ]);

      const result = await summary({ preset: 'week', granularity: 'week' });

      expect(result.activity.some((point) => point.calls === 9)).toBe(true);
    });
  });

  describe('custom ranges', () => {
    it('rejects a custom range missing a bound', async () => {
      await expect(summary({ preset: 'custom', from: '2026-01-01' })).rejects.toMatchObject({
        code: 'ANALYTICS_RANGE_INCOMPLETE',
      });
    });

    it('rejects an inverted range', async () => {
      await expect(
        summary({ preset: 'custom', from: '2026-03-01', to: '2026-01-01' }),
      ).rejects.toMatchObject({ code: 'ANALYTICS_RANGE_INVERTED' });
    });

    it('refuses a range large enough to scan the whole collection', async () => {
      await expect(
        summary({ preset: 'custom', from: '2020-01-01', to: '2026-01-01' }),
      ).rejects.toMatchObject({ code: 'ANALYTICS_RANGE_TOO_LARGE' });

      expect(repository.callAnalytics).not.toHaveBeenCalled();
    });
  });

  describe('most contacted', () => {
    it('ranks by calls plus emails combined', async () => {
      const first = new Types.ObjectId();
      const second = new Types.ObjectId();

      repository.mostContacted.mockResolvedValue([
        { contactId: first, callCount: 3, emailCount: 4, lastInteractionAt: new Date() },
        { contactId: second, callCount: 5, emailCount: 0, lastInteractionAt: new Date() },
      ]);
      repository.findContactsByIds.mockResolvedValue([
        { _id: first, name: 'Rahul', company: 'Acme' },
        { _id: second, name: 'Priya', company: null },
      ]);

      const result = await summary();

      expect(result.mostContacted[0]?.contactName).toBe('Rahul');
      expect(result.mostContacted[0]?.totalInteractions).toBe(7);
    });

    it('drops a contact deleted since the interaction', async () => {
      const missing = new Types.ObjectId();
      repository.mostContacted.mockResolvedValue([
        { contactId: missing, callCount: 2, emailCount: 0, lastInteractionAt: new Date() },
      ]);
      repository.findContactsByIds.mockResolvedValue([]);

      const result = await summary();

      expect(result.mostContacted).toEqual([]);
    });

    it('resolves names only within the workspace', async () => {
      const id = new Types.ObjectId();
      repository.mostContacted.mockResolvedValue([
        { contactId: id, callCount: 1, emailCount: 0, lastInteractionAt: null },
      ]);
      repository.findContactsByIds.mockResolvedValue([
        { _id: id, name: 'Rahul', company: null },
      ]);

      await summary();

      expect(repository.findContactsByIds).toHaveBeenCalledWith(scope, [expect.anything()]);
      const [passedScope] = repository.findContactsByIds.mock.calls[0] as [
        { workspaceId: Types.ObjectId },
      ];
      expect(passedScope.workspaceId).toBe(workspaceId);
    });
  });

  describe('scoping', () => {
    it('passes the workspace scope to every aggregation', async () => {
      await summary();

      for (const call of [
        repository.callAnalytics,
        repository.emailAnalytics,
        repository.importAnalytics,
        repository.callBuckets,
        repository.emailBuckets,
        repository.mostContacted,
      ]) {
        expect(call.mock.calls[0]?.[0]).toBe(scope);
      }
    });
  });
});
