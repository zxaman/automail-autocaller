/** What produced a timeline entry. */
export type TimelineEntryKind = 'call' | 'email' | 'note' | 'import';

export interface TimelineAttachment {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
}

/**
 * One event in a contact's history, already normalized by the API so the view
 * does not need to know which collection it came from.
 */
export interface TimelineEntry {
  readonly id: string;
  readonly kind: TimelineEntryKind;
  readonly title: string;
  readonly description: string | null;
  readonly status: string | null;
  readonly occurredAt: string;
  readonly durationSeconds: number | null;
  readonly attachments: readonly TimelineAttachment[];
  readonly canFollowUp: boolean;
  readonly sourceId: string;
}

export interface ContactTimeline {
  readonly contactId: string;
  readonly contactName: string;
  readonly entries: readonly TimelineEntry[];
}

/** Entries under a single day heading. */
export interface TimelineDayGroup {
  readonly label: string;
  readonly entries: readonly TimelineEntry[];
}

export interface FollowUpDraft {
  readonly contactId: string;
  readonly contactName: string;
  readonly email: string | null;
  readonly subject: string;
  readonly body: string;
  readonly canSend: boolean;
  readonly reason: string | null;
}

/** Icon per source, so each kind is distinguishable without reading the text. */
export const TIMELINE_KIND_ICONS: Readonly<Record<TimelineEntryKind, string>> = {
  call: 'calls',
  email: 'emails',
  note: 'inbox',
  import: 'imports',
};

export const TIMELINE_KIND_LABELS: Readonly<Record<TimelineEntryKind, string>> = {
  call: 'Call',
  email: 'Email',
  note: 'Note',
  import: 'Import',
};
