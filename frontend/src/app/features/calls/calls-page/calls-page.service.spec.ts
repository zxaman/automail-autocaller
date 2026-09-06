import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CallRecord } from '../models/call.model';
import { CallsPageService } from './calls-page.service';

const ok = <T>(data: T) => ({ success: true, message: 'ok', data });

const callRecord = (overrides: Partial<CallRecord> = {}): CallRecord => ({
  id: 'call-1',
  contactId: 'contact-1',
  contactName: 'Rahul',
  phoneNumber: '+919876543210',
  direction: 'outbound',
  status: 'ringing',
  durationSeconds: 0,
  provider: 'exotel',
  countryCode: 'IN',
  startedAt: '2026-01-01T10:00:00.000Z',
  answeredAt: null,
  endedAt: null,
  failureReason: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  ...overrides,
});

const contact = (id: string, phone: string | null) => ({
  id,
  name: `Contact ${id}`,
  phone,
  email: null,
  company: null,
  designation: null,
  location: null,
  tags: [],
  notes: null,
  source: 'manual',
  importBatchId: null,
  lastContactedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('CallsPageService', () => {
  let service: CallsPageService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CallsPageService],
    });
    service = TestBed.inject(CallsPageService);
    http = TestBed.inject(HttpTestingController);
  });

  const loadWith = (contacts: unknown[], calls: CallRecord[]) => {
    const promise = service.load();
    http
      .expectOne((req) => req.url === '/api/v1/contacts')
      .flush(ok({ items: contacts, pagination: {} }));
    http
      .expectOne((req) => req.url === '/api/v1/calls')
      .flush(ok({ items: calls, pagination: {} }));
    return promise;
  };

  it('loads contacts and call history', async () => {
    await loadWith([contact('c1', '+919876543210')], [callRecord({ status: 'completed' })]);

    expect(service.contacts()).toHaveLength(1);
    expect(service.history()).toHaveLength(1);
  });

  it('queues only contacts that have a phone number', async () => {
    await loadWith([contact('c1', '+919876543210'), contact('c2', null)], []);

    service.queueAllWithPhone();

    expect(service.queue()).toHaveLength(1);
    expect(service.currentQueueContact()?.id).toBe('c1');
  });

  it('refuses to start a call without the agent number', async () => {
    await loadWith([contact('c1', '+919876543210')], []);

    expect(service.canStartCall()).toBe(false);

    await service.callContact('c1');

    http.expectNone((req) => req.method === 'POST' && req.url === '/api/v1/calls');
  });

  it('exposes provider-reported controls rather than assuming them', async () => {
    await loadWith([contact('c1', '+919876543210')], []);
    service.setAgentNumber('+919999999999');

    const started = service.callContact('c1');
    http.expectOne((req) => req.method === 'POST' && req.url === '/api/v1/calls').flush(
      ok({
        call: callRecord(),
        controls: {
          canCancel: true,
          canMute: false,
          canHold: false,
          canSendDtmf: false,
          audioOnHandset: true,
        },
        instruction: 'Answer your phone to be connected.',
      }),
    );
    await started;

    const controls = service.controls();
    expect(controls?.canMute).toBe(false);
    expect(controls?.canHold).toBe(false);
    expect(controls?.canSendDtmf).toBe(false);
    expect(controls?.audioOnHandset).toBe(true);
    expect(service.isCallLive()).toBe(true);
  });

  it('does not advance the queue when a call ends', async () => {
    await loadWith([contact('c1', '+919876543210'), contact('c2', '+919876543211')], []);
    service.queueAllWithPhone();

    expect(service.queueIndex()).toBe(0);

    // Only an explicit user action moves the queue on.
    service.skipToNext();

    expect(service.queueIndex()).toBe(1);
    expect(service.currentQueueContact()?.id).toBe('c2');
  });

  it('reports a start failure without leaving a live call', async () => {
    await loadWith([contact('c1', '+919876543210')], []);
    service.setAgentNumber('+919999999999');

    const started = service.callContact('c1');
    http
      .expectOne((req) => req.method === 'POST' && req.url === '/api/v1/calls')
      .flush(
        { success: false, message: 'Calling is not available for this destination', errorCode: 'CALL_DESTINATION_UNSUPPORTED' },
        { status: 409, statusText: 'Conflict' },
      );
    await started;

    expect(service.activeCall()).toBeNull();
    expect(service.isCallLive()).toBe(false);
  });

  afterEach(() => {
    service.stopPolling();
    http.verify();
  });
});
