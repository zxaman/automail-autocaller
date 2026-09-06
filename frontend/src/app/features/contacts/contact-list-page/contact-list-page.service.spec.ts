import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContactListPageService } from './contact-list-page.service';

function pagedResponse(items: unknown[], totalItems = items.length) {
  return {
    success: true,
    message: 'ok',
    data: {
      items,
      pagination: { page: 1, pageSize: 25, totalItems, totalPages: 1 },
    },
  };
}

describe('ContactListPageService', () => {
  let service: ContactListPageService;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ContactListPageService],
    });
    service = TestBed.inject(ContactListPageService);
    http = TestBed.inject(HttpTestingController);
  });

  /** Answers the list request and the tags request that `load()` fires. */
  function flushLoad(items: unknown[] = [], totalItems = items.length): void {
    http.expectOne((req) => req.url === '/api/v1/contacts').flush(pagedResponse(items, totalItems));
    http
      .expectOne('/api/v1/contacts/tags')
      .flush({ success: true, message: 'ok', data: { tags: ['candidate'] } });
  }

  it('starts idle and loads on demand', () => {
    expect(service.contacts()).toEqual([]);
    service.load();
    expect(service.isLoading()).toBe(true);

    flushLoad([{ id: '1', name: 'Rahul', tags: [] }]);

    expect(service.isLoading()).toBe(false);
    expect(service.contacts()).toHaveLength(1);
    expect(service.tags()).toEqual(['candidate']);
  });

  it('debounces search input into a single request', () => {
    service.load();
    flushLoad();

    service.search('r');
    service.search('ra');
    service.search('rah');
    // No request until the debounce window elapses.
    http.expectNone((req) => req.url === '/api/v1/contacts');

    vi.advanceTimersByTime(300);

    const request = http.expectOne((req) => req.url === '/api/v1/contacts');
    expect(request.request.params.get('search')).toBe('rah');
    request.flush(pagedResponse([]));
  });

  it('resets to the first page when a filter changes', () => {
    service.load();
    flushLoad([], 100);

    service.goToPage(3);
    http.expectOne((req) => req.url === '/api/v1/contacts').flush(pagedResponse([], 100));
    expect(service.query().page).toBe(3);

    service.patchQuery({ tag: 'client', page: 1 });
    const request = http.expectOne((req) => req.url === '/api/v1/contacts');
    expect(request.request.params.get('page')).toBe('1');
    request.flush(pagedResponse([], 100));
  });

  it('reports an error state without clearing the query', () => {
    service.load();
    http
      .expectOne((req) => req.url === '/api/v1/contacts')
      .flush(
        { success: false, message: 'Contacts unavailable', error: { code: 'REQUEST_FAILED' } },
        { status: 500, statusText: 'Server Error' },
      );
    http.expectOne('/api/v1/contacts/tags').flush({ success: true, message: 'ok', data: { tags: [] } });

    expect(service.hasError()).toBe(true);
    expect(service.errorMessage()).toBe('Contacts unavailable');
  });

  it('distinguishes an empty workspace from empty filter results', () => {
    service.load();
    flushLoad([]);

    expect(service.isEmpty()).toBe(true);
    expect(service.hasActiveFilters()).toBe(false);

    service.patchQuery({ tag: 'client' });
    http.expectOne((req) => req.url === '/api/v1/contacts').flush(pagedResponse([]));

    expect(service.isEmpty()).toBe(true);
    expect(service.hasActiveFilters()).toBe(true);
  });

  it('clears every filter on reset', () => {
    service.load();
    flushLoad();

    service.patchQuery({ tag: 'client', hasEmail: true, page: 4 });
    http.expectOne((req) => req.url === '/api/v1/contacts').flush(pagedResponse([]));

    service.resetFilters();
    const request = http.expectOne((req) => req.url === '/api/v1/contacts');
    expect(request.request.params.has('tag')).toBe(false);
    expect(request.request.params.get('page')).toBe('1');
    expect(service.hasActiveFilters()).toBe(false);
    request.flush(pagedResponse([]));
  });
});
