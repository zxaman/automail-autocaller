import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_CONTACT_QUERY } from '../models/contact-query.model';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  let service: ContactService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContactService);
    http = TestBed.inject(HttpTestingController);
  });

  it('omits empty filters from the query string', () => {
    service.list(DEFAULT_CONTACT_QUERY).subscribe();

    const request = http.expectOne((req) => req.url === '/api/v1/contacts');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('sortBy')).toBe('createdAt');
    expect(request.request.params.has('search')).toBe(false);
    expect(request.request.params.has('tag')).toBe(false);
    expect(request.request.params.has('hasEmail')).toBe(false);
    request.flush({ success: true, message: 'ok', data: { items: [], pagination: {} } });
  });

  it('sends active filters', () => {
    service
      .list({ ...DEFAULT_CONTACT_QUERY, search: ' rahul ', tag: 'candidate', hasEmail: true })
      .subscribe();

    const request = http.expectOne((req) => req.url === '/api/v1/contacts');
    expect(request.request.params.get('search')).toBe('rahul');
    expect(request.request.params.get('tag')).toBe('candidate');
    expect(request.request.params.get('hasEmail')).toBe('true');
    request.flush({ success: true, message: 'ok', data: { items: [], pagination: {} } });
  });

  it('sends hasEmail=false as an explicit filter', () => {
    service.list({ ...DEFAULT_CONTACT_QUERY, hasEmail: false }).subscribe();

    const request = http.expectOne((req) => req.url === '/api/v1/contacts');
    expect(request.request.params.get('hasEmail')).toBe('false');
    request.flush({ success: true, message: 'ok', data: { items: [], pagination: {} } });
  });

  it('targets the correct URLs for single-record operations', () => {
    service.getById('abc').subscribe();
    http.expectOne('/api/v1/contacts/abc').flush({ success: true, message: 'ok', data: {} });

    service.update('abc', {} as never).subscribe();
    const put = http.expectOne('/api/v1/contacts/abc');
    expect(put.request.method).toBe('PUT');
    put.flush({ success: true, message: 'ok', data: {} });

    service.delete('abc').subscribe();
    const del = http.expectOne('/api/v1/contacts/abc');
    expect(del.request.method).toBe('DELETE');
    del.flush({ success: true, message: 'ok', data: { deleted: true } });

    service.listTags().subscribe();
    http.expectOne('/api/v1/contacts/tags').flush({
      success: true,
      message: 'ok',
      data: { tags: [] },
    });
  });
});
