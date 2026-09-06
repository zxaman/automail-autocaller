import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, isObservable, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';
import { guestGuard } from './guest.guard';

const USER = {
  id: 'u1',
  name: 'Rahul Sharma',
  email: 'rahul@example.com',
  profileImageUrl: null,
  role: 'owner',
  workspaceId: 'w1',
  preferences: { timezone: 'Asia/Kolkata', locale: 'en-IN', theme: 'light' },
  lastLoginAt: null,
};

describe('route guards', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  async function runGuard(guard: typeof authGuard, url = '/dashboard'): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() => guard({} as never, { url } as never));
    return isObservable(result)
      ? ((await firstValueFrom(result)) as boolean | UrlTree)
      : (result as boolean | UrlTree);
  }

  function authenticate(): void {
    auth.loadSession().subscribe();
    http.expectOne('/api/v1/auth/me').flush({ success: true, message: 'ok', data: USER });
  }

  function reject(): void {
    auth.loadSession().subscribe();
    http
      .expectOne('/api/v1/auth/me')
      .flush(
        { success: false, message: 'Unauthenticated', error: { code: 'UNAUTHENTICATED' } },
        { status: 401, statusText: 'Unauthorized' },
      );
  }

  it('allows an authenticated user through authGuard', async () => {
    authenticate();
    await expect(runGuard(authGuard)).resolves.toBe(true);
  });

  it('redirects an anonymous user to login with a returnUrl', async () => {
    reject();
    const result = await runGuard(authGuard, '/contacts/42');

    expect(result).toBeInstanceOf(UrlTree);
    const tree = result as UrlTree;
    expect(tree.toString()).toContain('/auth/login');
    expect(tree.queryParams['returnUrl']).toBe('/contacts/42');
  });

  it('does not re-probe the session once it is resolved', async () => {
    reject();
    await runGuard(authGuard);
    http.expectNone('/api/v1/auth/me');
  });

  it('sends an authenticated user away from the login screen', async () => {
    authenticate();
    const result = await runGuard(guestGuard, '/auth/login');

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toContain('/dashboard');
  });

  it('lets an anonymous user reach the login screen', async () => {
    reject();
    await expect(runGuard(guestGuard, '/auth/login')).resolves.toBe(true);
  });

  it('keeps the router available for redirects', () => {
    expect(TestBed.inject(Router).createUrlTree(['/dashboard'])).toBeInstanceOf(UrlTree);
    expect(isObservable(of(true))).toBe(true);
  });
});
