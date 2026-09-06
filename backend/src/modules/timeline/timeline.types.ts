/** What produced a timeline entry. */
export type TimelineEntryKind = 'call' | 'email' | 'note' | 'import';

/**
 * One event in a contact's history.
 *
 * Entries from different sources are normalized into this single shape so the
 * timeline can order them by time alone, without the UI having to know which
 * collection each came from.
 */
export interface TimelineEntryDto {
  readonly id: string;
  readonly kind: TimelineEntryKind;
  /** Short headline, e.g. "Call completed" or the email subject. */
  readonly title: string;
  readonly description: string | null;
  /** Outcome label used for the status badge, when the source has one. */
  readonly status: string | null;
  readonly occurredAt: string;
  /** Call duration in seconds; null for every other kind. */
  readonly durationSeconds: number | null;
  readonly attachments: readonly TimelineAttachmentDto[];
  /** Whether this entry can seed a prefilled follow-up email. */
  readonly canFollowUp: boolean;
  /** Source record id, so the UI can deep-link back to it. */
  readonly sourceId: string;
}

export interface TimelineAttachmentDto {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
}

export interface TimelineQuery {
  readonly limit?: number;
  readonly kinds?: readonly TimelineEntryKind[];
}

export interface CreateNoteInput {
  readonly body: string;
  readonly callId?: string | null;
}

/** Contact data used to prefill a follow-up email after a call. */
export interface FollowUpDraftDto {
  readonly contactId: string;
  readonly contactName: string;
  readonly email: string | null;
  readonly subject: string;
  readonly body: string;
  /** False when the contact has no email address to send to. */
  readonly canSend: boolean;
  readonly reason: string | null;
}
