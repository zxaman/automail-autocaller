import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_ENDPOINTS } from '../../../core/config/api-endpoints.config';
import { ApiClientService } from '../../../core/services/api-client.service';
import type {
  ConnectGmailPayload,
  EmailAccount,
  TestEmailResult,
} from '../models/email-account.model';

/**
 * Transport-level access to the email-account API.
 *
 * The App Password is passed straight through to the request and never stored
 * in a field, a signal, or browser storage.
 */
@Injectable({ providedIn: 'root' })
export class EmailAccountService {
  private readonly api = inject(ApiClientService);

  public list(): Observable<{ items: EmailAccount[] }> {
    return this.api.get<{ items: EmailAccount[] }>(API_ENDPOINTS.emailAccounts);
  }

  public connect(payload: ConnectGmailPayload): Observable<EmailAccount> {
    return this.api.post<EmailAccount, ConnectGmailPayload>(
      API_ENDPOINTS.emailAccounts,
      payload,
    );
  }

  public verify(accountId: string): Observable<EmailAccount> {
    return this.api.post<EmailAccount>(`${API_ENDPOINTS.emailAccounts}/${accountId}/verify`);
  }

  public sendTest(accountId: string, to?: string): Observable<TestEmailResult> {
    return this.api.post<TestEmailResult, { to?: string }>(
      `${API_ENDPOINTS.emailAccounts}/${accountId}/test`,
      to ? { to } : {},
    );
  }

  public setDefault(accountId: string): Observable<EmailAccount> {
    return this.api.patch<EmailAccount, Record<string, never>>(
      `${API_ENDPOINTS.emailAccounts}/${accountId}/default`,
      {} as Record<string, never>,
    );
  }

  public disconnect(accountId: string): Observable<{ disconnected: boolean }> {
    return this.api.delete<{ disconnected: boolean }>(
      `${API_ENDPOINTS.emailAccounts}/${accountId}`,
    );
  }
}
