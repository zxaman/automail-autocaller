import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { EmailAccount } from '../models/email-account.model';
import { EmailAccountsPageService } from './email-accounts-page.service';

const APP_PASSWORD = 'abcdefghijklmnop';

const account: EmailAccount = {
  id: 'a1',
  email: 'sender@gmail.com',
  displayName: 'Sender',
  provider: 'gmail',
  status: 'active',
  isDefault: true,
  lastVerifiedAt: '2026-09-01T10:00:00.000Z',
  lastFailureCode: null,
  lastFailureAt: null,
  createdAt: '2026-09-01T10:00:00.000Z',
};

describe('EmailAccountsPageService', () => {
  let service: EmailAccountsPageService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), EmailAccountsPageService],
    });

    service = TestBed.inject(EmailAccountsPageService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  function flushList(items: EmailAccount[] = [account]): void {
    httpMock
      .expectOne((req) => req.url.endsWith('/email-accounts') && req.method === 'GET')
      .flush({ success: true, message: 'ok', data: { items } });
  }

  it('loads connected accounts', () => {
    service.load();
    flushList();

    expect(service.accounts()).toHaveLength(1);
    expect(service.defaultAccount()?.email).toBe('sender@gmail.com');
  });

  it('sends the App Password only in the connect request body', () => {
    service.connect({
      email: 'sender@gmail.com',
      displayName: 'Sender',
      appPassword: APP_PASSWORD,
      makeDefault: false,
    });

    const request = httpMock.expectOne(
      (req) => req.url.endsWith('/email-accounts') && req.method === 'POST',
    );

    expect(request.request.body.appPassword).toBe(APP_PASSWORD);
    // It must never travel in the URL, where it would land in server logs.
    expect(request.request.urlWithParams).not.toContain(APP_PASSWORD);

    request.flush({ success: true, message: 'ok', data: account });
    flushList();
  });

  it('never keeps the App Password in view state after connecting', () => {
    service.connect({
      email: 'sender@gmail.com',
      displayName: 'Sender',
      appPassword: APP_PASSWORD,
      makeDefault: false,
    });

    httpMock
      .expectOne((req) => req.method === 'POST')
      .flush({ success: true, message: 'ok', data: account });
    flushList();

    const stateSnapshot = JSON.stringify({
      accounts: service.accounts(),
      error: service.errorMessage(),
      connectError: service.connectError(),
    });

    expect(stateSnapshot).not.toContain(APP_PASSWORD);
  });

  it('never writes the App Password to browser storage', () => {
    service.connect({
      email: 'sender@gmail.com',
      displayName: 'Sender',
      appPassword: APP_PASSWORD,
      makeDefault: false,
    });

    httpMock
      .expectOne((req) => req.method === 'POST')
      .flush({ success: true, message: 'ok', data: account });
    flushList();

    expect(JSON.stringify(localStorage)).not.toContain(APP_PASSWORD);
    expect(JSON.stringify(sessionStorage)).not.toContain(APP_PASSWORD);
  });

  it('shows a connect failure inline instead of as a toast', () => {
    service.connect({
      email: 'sender@gmail.com',
      displayName: 'Sender',
      appPassword: APP_PASSWORD,
      makeDefault: false,
    });

    httpMock.expectOne((req) => req.method === 'POST').flush(
      { success: false, message: 'Gmail rejected those credentials.' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(service.connectError()).toMatch(/rejected/);
    expect(service.isFormOpen()).toBe(false);
  });

  it('reloads the list after a successful verify', () => {
    service.load();
    flushList();

    service.verify('a1');
    httpMock
      .expectOne((req) => req.url.endsWith('/email-accounts/a1/verify'))
      .flush({ success: true, message: 'ok', data: account });

    flushList();
    expect(service.busyAccountId()).toBeNull();
  });

  it('reloads after a failed verify so the new status is visible', () => {
    service.load();
    flushList();

    service.verify('a1');
    httpMock
      .expectOne((req) => req.url.endsWith('/email-accounts/a1/verify'))
      .flush({ success: false, message: 'rejected' }, { status: 400, statusText: 'Bad Request' });

    flushList([{ ...account, status: 'verification_failed', lastFailureCode: 'SMTP_AUTH_FAILED' }]);
    expect(service.hasFailingAccount()).toBe(true);
  });

  it('sends a test email and reports the recipient', () => {
    service.sendTest('a1');

    httpMock
      .expectOne((req) => req.url.endsWith('/email-accounts/a1/test'))
      .flush({ success: true, message: 'ok', data: { sentTo: 'sender@gmail.com' } });

    flushList();
    expect(service.busyAccountId()).toBeNull();
  });

  it('disconnects an account and refreshes the list', () => {
    service.disconnect('a1');

    const request = httpMock.expectOne(
      (req) => req.url.endsWith('/email-accounts/a1') && req.method === 'DELETE',
    );
    request.flush({ success: true, message: 'ok', data: { disconnected: true } });

    flushList([]);
    expect(service.hasAccounts()).toBe(false);
  });
});
