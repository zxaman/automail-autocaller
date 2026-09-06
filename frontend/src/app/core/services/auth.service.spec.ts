import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  it('starts in an unknown state', () => {
    expect(service.status()).toBe('unknown');
    expect(service.isAuthenticated()).toBe(false);
  });

  it('stores the user after a successful session load', () => {
    service.loadSession().subscribe();

    http.expectOne('/api/v1/auth/me').flush({
      success: true,
      message: 'ok',
      data: {
        id: 'u1',
        name: 'Rahul Sharma',
        email: 'rahul@example.com',
        profileImageUrl: null,
        role: 'owner',
        workspaceId: 'w1',
        preferences: { timezone: 'UTC', locale: 'en', theme: 'light' },
        lastLoginAt: null,
      },
    });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.displayName()).toBe('Rahul Sharma');
    expect(service.initials()).toBe('RS');
  });

  it('falls back to anonymous when the session is rejected', () => {
    let result: unknown = 'unset';
    service.loadSession().subscribe((value) => (result = value));

    http.expectOne('/api/v1/auth/me').flush(
      { success: false, message: 'Unauthenticated', error: { code: 'UNAUTHENTICATED' } },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(result).toBeNull();
    expect(service.status()).toBe('anonymous');
    expect(service.isAuthenticated()).toBe(false);
  });
});
