import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { ApiClientService } from '../../../core/services/api-client.service';
import type {
  ContactTimeline,
  FollowUpDraft,
  TimelineEntry,
  TimelineEntryKind,
} from '../models/timeline.model';

/** Transport-level access to the contact timeline API. */
@Injectable({ providedIn: 'root' })
export class TimelineService {
  private readonly api = inject(ApiClientService);

  public getContactTimeline(
    contactId: string,
    options: { limit?: number; kinds?: readonly TimelineEntryKind[] } = {},
  ): Observable<ContactTimeline> {
    return this.api.get<ContactTimeline>(`/contacts/${contactId}/timeline`, {
      limit: options.limit ?? null,
      kinds: options.kinds?.length ? options.kinds.join(',') : null,
    });
  }

  public addNote(
    contactId: string,
    body: string,
    callId: string | null = null,
  ): Observable<TimelineEntry> {
    return this.api.post<TimelineEntry, { body: string; callId: string | null }>(
      `/contacts/${contactId}/notes`,
      { body, callId },
    );
  }

  public deleteNote(noteId: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/notes/${noteId}`);
  }

  /** Fetches contact-prefilled copy for a follow-up email after a call. */
  public getFollowUpDraft(contactId: string, callId?: string): Observable<FollowUpDraft> {
    return this.api.get<FollowUpDraft>(`/contacts/${contactId}/follow-up-draft`, {
      callId: callId ?? null,
    });
  }
}
