import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';

describe('HTTP interceptors', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  it('attaches credentials to API requests', () => {
    http.get('/api/v1/contacts').subscribe({ error: () => undefined });
    const request = controller.expectOne('/api/v1/contacts');

    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    request.flush({});
  });

  it('leaves non-API requests untouched', () => {
    http.get('/assets/logo.svg').subscribe({ error: () => undefined });
    const request = controller.expectOne('/assets/logo.svg');

    expect(request.request.withCredentials).toBe(false);
    request.flush({});
  });

  it('clears the session and redirects on 401', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get('/api/v1/contacts').subscribe({ error: () => undefined });
    controller
      .expectOne('/api/v1/contacts')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.status()).toBe('anonymous');
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { reason: 'session-expired' },
    });
  });

  it('does not redirect when the session probe itself returns 401', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get('/api/v1/auth/me').subscribe({ error: () => undefined });
    controller.expectOne('/api/v1/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('passes other failures through untouched', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get('/api/v1/contacts').subscribe({ error: () => undefined });
    controller.expectOne('/api/v1/contacts').flush({}, { status: 500, statusText: 'Server Error' });

    expect(navigate).not.toHaveBeenCalled();
  });
});
