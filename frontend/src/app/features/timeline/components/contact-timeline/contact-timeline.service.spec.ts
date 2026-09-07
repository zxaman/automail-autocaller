import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TimelineEntry } from '../../models/timeline.model';
import { ContactTimelineStateService } from './contact-timeline.service';

const ok = <T>(data: T) => ({ success: true, message: 'ok', data });

const entry = (overrides: Partial<TimelineEntry> = {}): TimelineEntry => ({
  id: 'call:1',
  kind: 'call',
  title: 'Outgoing call completed',
  description: null,
  status: 'Completed',
  occurredAt: new Date().toISOString(),
  durationSeconds: 90,
  attachments: [],
  canFollowUp: true,
  sourceId: '1',
  ...overrides,
});

describe('ContactTimelineStateService', () => {
  let service: ContactTimelineStateService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ContactTimelineStateService],
    });
    service = TestBed.inject(ContactTimelineStateService);
    http = TestBed.inject(HttpTestingController);
  });

  const load = (entries: TimelineEntry[]) => {
    const promise = service.load('contact-1');
    http
      .expectOne((req) => req.url === '/api/v1/contacts/contact-1/timeline')
      .flush(ok({ contactId: 'contact-1', contactName: 'Rahul', entries }));
    return promise;
  };

  it('groups todays entries under a Today heading', async () => {
    await load([entry()]);

    expect(service.groups()).toHaveLength(1);
    expect(service.groups()[0]?.label).toBe('Today');
  });

  it('separates entries from different days', async () => {
    const older = new Date();
    older.setDate(older.getDate() - 5);

    await load([entry(), entry({ id: 'note:2', kind: 'note', occurredAt: older.toISOString() })]);

    expect(service.groups()).toHaveLength(2);
    expect(service.groups()[0]?.label).toBe('Today');
  });

  it('filters by kind without issuing another request', async () => {
    await load([entry(), entry({ id: 'note:2', kind: 'note' })]);

    service.toggleKind('note');

    expect(service.visibleEntries()).toHaveLength(1);
    expect(service.visibleEntries()[0]?.kind).toBe('note');
    http.verify();
  });

  it('shows everything again when the filter is cleared', async () => {
    await load([entry(), entry({ id: 'note:2', kind: 'note' })]);

    service.toggleKind('note');
    service.clearFilters();

    expect(service.visibleEntries()).toHaveLength(2);
  });

  it('reports an empty timeline distinctly from an empty filter result', async () => {
    await load([entry()]);

    service.toggleKind('import');

    // There is history, it just does not match: not the same as no history.
    expect(service.isEmpty()).toBe(false);
    expect(service.visibleEntries()).toHaveLength(0);
  });

  it('adds a note to the top of the timeline', async () => {
    await load([entry({ occurredAt: new Date(Date.now() - 60_000).toISOString() })]);

    const saving = service.addNote('  Call back Monday  ');
    const request = http.expectOne(
      (req) => req.method === 'POST' && req.url === '/api/v1/contacts/contact-1/notes',
    );

    expect(request.request.body).toEqual({ body: 'Call back Monday', callId: null });
    request.flush(
      ok(entry({ id: 'note:9', kind: 'note', sourceId: '9', occurredAt: new Date().toISOString() })),
    );
    await saving;

    expect(service.entries()[0]?.kind).toBe('note');
  });

  it('does not send an empty note', async () => {
    await load([]);

    const saved = await service.addNote('   ');

    expect(saved).toBe(false);
    http.expectNone((req) => req.method === 'POST');
  });

  it('surfaces a load failure instead of showing an empty history', async () => {
    const promise = service.load('contact-1');
    http
      .expectOne((req) => req.url === '/api/v1/contacts/contact-1/timeline')
      .flush(
        { success: false, message: 'Contact not found', errorCode: 'CONTACT_NOT_FOUND' },
        { status: 404, statusText: 'Not Found' },
      );
    await promise;

    expect(service.errorMessage()).toBe('Contact not found');
    expect(service.isEmpty()).toBe(false);
  });
});
