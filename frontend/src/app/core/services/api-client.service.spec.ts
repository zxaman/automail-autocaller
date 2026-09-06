import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '../models/api-error.model';
import { ApiClientService } from './api-client.service';

describe('ApiClientService', () => {
  let service: ApiClientService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiClientService);
    http = TestBed.inject(HttpTestingController);
  });

  it('unwraps the success envelope', () => {
    let data: unknown;
    service.get<{ total: number }>('/dashboard').subscribe((value) => (data = value));

    const request = http.expectOne('/api/v1/dashboard');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ success: true, message: 'ok', data: { total: 3 } });

    expect(data).toEqual({ total: 3 });
  });

  it('skips empty query parameters', () => {
    service.get('/contacts', { page: 1, search: '', tag: undefined }).subscribe();
    const request = http.expectOne((req) => req.url === '/api/v1/contacts');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.has('search')).toBe(false);
    expect(request.request.params.has('tag')).toBe(false);
    request.flush({ success: true, message: 'ok', data: [] });
  });

  it('normalizes backend error envelopes', () => {
    let error: unknown;
    service.post('/contacts', {}).subscribe({ error: (value: unknown) => (error = value) });

    http.expectOne('/api/v1/contacts').flush(
      { success: false, message: 'Unable to create contact', error: { code: 'CONTACT_CREATE_FAILED' } },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('CONTACT_CREATE_FAILED');
    expect((error as AppError).message).toBe('Unable to create contact');
  });

  it('produces a safe message for unexpected server failures', () => {
    let error: unknown;
    service.get('/dashboard').subscribe({ error: (value: unknown) => (error = value) });

    http.expectOne('/api/v1/dashboard').flush('<html>stack trace</html>', {
      status: 500,
      statusText: 'Server Error',
    });

    expect((error as AppError).code).toBe('REQUEST_FAILED');
    expect((error as AppError).message).not.toContain('stack');
  });
});
