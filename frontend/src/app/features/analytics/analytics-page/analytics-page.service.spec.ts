import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AnalyticsSummary } from '../models/analytics.model';
import { AnalyticsPageService } from './analytics-page.service';

const ok = <T>(data: T) => ({ success: true, message: 'ok', data });

const summary = (overrides: Partial<AnalyticsSummary> = {}): AnalyticsSummary => ({
  range: {
    preset: 'week',
    granularity: 'day',
    timezone: 'Asia/Kolkata',
    from: '2026-03-04T18:30:00.000Z',
    to: '2026-03-11T18:30:00.000Z',
  },
  calls: {
    totalCalls: 10,
    connectedCalls: 4,
    missedCalls: 5,
    failedCalls: 1,
    totalDurationSeconds: 600,
    averageDurationSeconds: 150,
    longestCallSeconds: 300,
    successRate: 40,
    byStatus: [
      { status: 'completed', count: 4 },
      { status: 'no_answer', count: 5 },
      { status: 'failed', count: 1 },
    ],
  },
  emails: {
    totalEmails: 6,
    sentEmails: 5,
    failedEmails: 1,
    pendingEmails: 0,
    successRate: 83.3,
    byStatus: [{ status: 'sent', count: 5 }],
  },
  imports: {
    totalBatches: 1,
    totalRows: 100,
    successfulRows: 90,
    duplicateRows: 8,
    failedRows: 2,
    successRate: 90,
  },
  activity: [
    { date: '2026-03-10', label: '2026-03-10', calls: 4, emails: 2, connectedCalls: 3, sentEmails: 2 },
  ],
  mostContacted: [],
  ...overrides,
});

describe('AnalyticsPageService', () => {
  let service: AnalyticsPageService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AnalyticsPageService],
    });
    service = TestBed.inject(AnalyticsPageService);
    http = TestBed.inject(HttpTestingController);
  });

  const load = (data: AnalyticsSummary = summary()) => {
    const promise = service.load();
    http.expectOne((req) => req.url === '/api/v1/analytics').flush(ok(data));
    return promise;
  };

  it('sends the browser timezone so day boundaries are the users own', async () => {
    const promise = service.load();
    const request = http.expectOne((req) => req.url === '/api/v1/analytics');

    expect(request.request.params.get('timezone')).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    request.flush(ok(summary()));
    await promise;
  });

  it('adopts the granularity the server chose', async () => {
    await load(
      summary({
        range: {
          preset: 'custom',
          granularity: 'month',
          timezone: 'UTC',
          from: '2025-01-01T00:00:00.000Z',
          to: '2026-01-01T00:00:00.000Z',
        },
      }),
    );

    expect(service.granularity()).toBe('month');
  });

  it('converts status counts into proportional bars', async () => {
    await load();

    const bars = service.callStatusBars();
    expect(bars).toHaveLength(3);
    expect(bars[0]).toEqual({ status: 'completed', count: 4, percent: 40 });
  });

  it('produces no bars when nothing happened, rather than a zero-width chart', async () => {
    await load(
      summary({
        calls: { ...summary().calls, byStatus: [] },
      }),
    );

    expect(service.callStatusBars()).toEqual([]);
  });

  it('lets the server re-pick the bucket size when the range changes', async () => {
    await load();

    const changing = service.setRange({ preset: 'month' });
    const request = http.expectOne((req) => req.url === '/api/v1/analytics');

    // No granularity is sent, so the server decides what suits the new range.
    expect(request.request.params.has('granularity')).toBe(false);
    expect(request.request.params.get('preset')).toBe('month');
    request.flush(ok(summary()));
    await changing;
  });

  it('sends an explicitly chosen granularity', async () => {
    await load();

    const changing = service.setGranularity('week');
    const request = http.expectOne((req) => req.url === '/api/v1/analytics');

    expect(request.request.params.get('granularity')).toBe('week');
    request.flush(ok(summary()));
    await changing;
  });

  it('sends both bounds for a custom range', async () => {
    await load();

    const changing = service.setRange({
      preset: 'custom',
      from: '2026-01-01',
      to: '2026-01-31',
    });
    const request = http.expectOne((req) => req.url === '/api/v1/analytics');

    expect(request.request.params.get('from')).toBe('2026-01-01');
    expect(request.request.params.get('to')).toBe('2026-01-31');
    request.flush(ok(summary()));
    await changing;
  });

  it('detects a genuinely empty period', async () => {
    await load(
      summary({
        calls: { ...summary().calls, totalCalls: 0 },
        emails: { ...summary().emails, totalEmails: 0 },
        imports: { ...summary().imports, totalBatches: 0 },
      }),
    );

    expect(service.hasNoActivity()).toBe(true);
  });

  it('surfaces a load failure instead of showing stale zeros', async () => {
    const promise = service.load();
    http
      .expectOne((req) => req.url === '/api/v1/analytics')
      .flush(
        { success: false, message: 'A range cannot be longer than 366 days' },
        { status: 400, statusText: 'Bad Request' },
      );
    await promise;

    expect(service.errorMessage()).toBe('A range cannot be longer than 366 days');
    expect(service.summary()).toBeNull();
  });

  it('keeps working when metric definitions cannot be fetched', async () => {
    const promise = service.loadDefinitions();
    http
      .expectOne((req) => req.url === '/api/v1/analytics/definitions')
      .flush({ success: false, message: 'nope' }, { status: 500, statusText: 'Error' });
    await promise;

    expect(service.definitionFor('callSuccessRate')).toBeNull();
  });
});
