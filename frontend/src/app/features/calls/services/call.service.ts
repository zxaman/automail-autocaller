import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_ENDPOINTS } from '../../../core/config/api-endpoints.config';
import { ApiClientService } from '../../../core/services/api-client.service';
import type { PagedData } from '../../../core/models/api-response.model';
import type { CallRecord, StartCallResult } from '../models/call.model';

/** Transport-level access to the calling API. */
@Injectable({ providedIn: 'root' })
export class CallService {
  private readonly api = inject(ApiClientService);

  public start(payload: { contactId: string; agentNumber: string }): Observable<StartCallResult> {
    return this.api.post<StartCallResult, typeof payload>(API_ENDPOINTS.calls, payload);
  }

  /** Polled while a call is live, in case a webhook was lost. */
  public refresh(callId: string): Observable<CallRecord> {
    return this.api.post<CallRecord>(`${API_ENDPOINTS.calls}/${callId}/refresh`);
  }

  public cancel(callId: string): Observable<CallRecord> {
    return this.api.post<CallRecord>(`${API_ENDPOINTS.calls}/${callId}/cancel`);
  }

  public list(
    query: { page?: number; pageSize?: number; status?: string } = {},
  ): Observable<PagedData<CallRecord>> {
    return this.api.get<PagedData<CallRecord>>(API_ENDPOINTS.calls, {
      page: query.page ?? null,
      pageSize: query.pageSize ?? null,
      status: query.status ?? null,
    });
  }
}
