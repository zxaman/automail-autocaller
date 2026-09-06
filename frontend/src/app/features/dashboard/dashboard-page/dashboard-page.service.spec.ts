import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { beforeEach, describe, expect, it } from 'vitest';

import { DashboardPageService } from './dashboard-page.service';
import type { DashboardSnapshot } from './dashboard-page.model';

const snapshot: DashboardSnapshot = {
  range: { preset: 'week', timezone: 'UTC', from: '2026-03-04T00:00:00.000Z', to: '2026-03-11T00:00:00.000Z' },
  overview: {
    totalContacts: 12,
    totalCalls: 8,
    callsToday: 2,
    completedCalls: 6,
    missedCalls: 1,
    failedCalls: 1,
    totalCallDurationSeconds: 5400,
    averageCallDurationSeconds: 900,
    totalEmails: 4,
    emailsToday: 1,
    successfulEmails: 3,
    failedEmails: 1,
    callSuccessRate: 75,
    emailSuccessRate: 75,
    totalCommunicationActivity: 12,
  },
  activity: [{ date: '2026-03-10', calls: 3, emails: 2 }],
  recentCalls: [],
  recentEmails: [],
  recentImports: [],
};

describe('DashboardPageService', () => {
  let service: DashboardPageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), DashboardPageService],
    });

    service = TestBed.inject(DashboardPageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('requests the selected preset and the browser timezone', () => {
    service.load();

    const request = httpMock.expectOne((req) => req.url.endsWith('/dashboard'));
    expect(request.request.params.get('preset')).toBe('week');
    expect(request.request.params.get('timezone')).toBeTruthy();
    request.flush({ success: true, message: 'ok', data: snapshot });
  });

  it('exposes the loaded snapshot and derived metric cards', () => {
    service.load();
    httpMock
      .expectOne((req) => req.url.endsWith('/dashboard'))
      .flush({ success: true, message: 'ok', data: snapshot });

    expect(service.snapshot()?.overview.totalContacts).toBe(12);
    expect(service.isLoading()).toBe(false);

    const metricIds = service.metrics().map((metric) => metric.id);
    expect(metricIds).toContain('call-success');

    const talkTime = service.metrics().find((metric) => metric.id === 'talk-time');
    expect(talkTime?.value).toBe('1h 30m');
  });

  it('sends the custom bounds when a custom range is chosen', () => {
    service.changeRange({ preset: 'custom', from: '2026-01-01', to: '2026-01-31' });

    const request = httpMock.expectOne((req) => req.url.endsWith('/dashboard'));
    expect(request.request.params.get('preset')).toBe('custom');
    expect(request.request.params.get('from')).toBe('2026-01-01');
    expect(request.request.params.get('to')).toBe('2026-01-31');
    request.flush({ success: true, message: 'ok', data: snapshot });
  });

  it('surfaces a readable message when the request fails', () => {
    service.load();
    httpMock
      .expectOne((req) => req.url.endsWith('/dashboard'))
      .flush({ success: false, message: 'Server exploded' }, { status: 500, statusText: 'Error' });

    expect(service.hasError()).toBe(true);
    expect(service.errorMessage()).toBeTruthy();
  });

  it('shows zeroed metric cards before any data arrives', () => {
    expect(service.metrics().every((metric) => metric.value === 0 || typeof metric.value === 'string')).toBe(true);
    expect(service.snapshot() ?? null).toBeNull();
  });
});
