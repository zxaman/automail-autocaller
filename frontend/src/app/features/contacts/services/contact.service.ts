import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_ENDPOINTS } from '../../../core/config/api-endpoints.config';
import type { PagedData } from '../../../core/models/api-response.model';
import { ApiClientService, type QueryParams } from '../../../core/services/api-client.service';
import type { Contact, ContactPayload } from '../models/contact.model';
import type { ContactQuery } from '../models/contact-query.model';

/** Transport-level access to the contacts API. Holds no view state. */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly api = inject(ApiClientService);

  public list(query: ContactQuery): Observable<PagedData<Contact>> {
    return this.api.get<PagedData<Contact>>(API_ENDPOINTS.contacts, this.toParams(query));
  }

  public getById(contactId: string): Observable<Contact> {
    return this.api.get<Contact>(`${API_ENDPOINTS.contacts}/${contactId}`);
  }

  public create(payload: ContactPayload): Observable<Contact> {
    return this.api.post<Contact, ContactPayload>(API_ENDPOINTS.contacts, payload);
  }

  public update(contactId: string, payload: ContactPayload): Observable<Contact> {
    return this.api.put<Contact, ContactPayload>(
      `${API_ENDPOINTS.contacts}/${contactId}`,
      payload,
    );
  }

  public delete(contactId: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`${API_ENDPOINTS.contacts}/${contactId}`);
  }

  public listTags(): Observable<{ tags: string[] }> {
    return this.api.get<{ tags: string[] }>(`${API_ENDPOINTS.contacts}/tags`);
  }

  /** Empty values are dropped by the API client, keeping URLs clean. */
  private toParams(query: ContactQuery): QueryParams {
    return {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search.trim() || undefined,
      tag: query.tag ?? undefined,
      source: query.source ?? undefined,
      hasEmail: query.hasEmail === null ? undefined : query.hasEmail,
      hasPhone: query.hasPhone === null ? undefined : query.hasPhone,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    };
  }
}
