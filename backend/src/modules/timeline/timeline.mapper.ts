import type { Types } from 'mongoose';

import type { CallDocument } from '../calls/call.model';
import type { EmailAttachmentAttributes } from '../emails/email-attachment.model';
import type { EmailDocument } from '../emails/email.model';
import type { ImportBatchDocument } from '../imports/import-batch.model';
import type { ContactNoteDocument } from './contact-note.model';
import type { TimelineAttachmentDto, TimelineEntryDto } from './timeline.types';

/** Human wording for a call outcome, reused by the badge and the headline. */
const CALL_OUTCOME_LABELS: Readonly<Record<string, string>> = {
  queued: 'Queued',
  initiated: 'Starting',
  ringing: 'Ringing',
  in_progress: 'In progress',
  completed: 'Completed',
  no_answer: 'No answer',
  busy: 'Busy',
  failed: 'Failed',
  canceled: 'Canceled',
};

const EMAIL_STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: 'Draft',
  queued: 'Queued',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
};

/**
 * A call is worth following up when it actually reached the person, or when it
 * definitively did not and an email is the natural second attempt. A call still
 * in progress is not offered, because the outcome is not known yet.
 */
const FOLLOW_UP_CALL_STATUSES: readonly string[] = [
  'completed',
  'no_answer',
  'busy',
  'failed',
];

export function callToTimelineEntry(call: CallDocument): TimelineEntryDto {
  const status = String(call.status);
  const label = CALL_OUTCOME_LABELS[status] ?? status;

  return {
    id: `call:${call.id}`,
    kind: 'call',
    title: `${call.direction === 'outbound' ? 'Outgoing' : 'Incoming'} call ${label.toLowerCase()}`,
    description: call.failureReason ?? null,
    status: label,
    // A call belongs at the moment it was placed, not when the row was written.
    occurredAt: (call.startedAt ?? call.createdAt).toISOString(),
    durationSeconds: call.durationSeconds ?? 0,
    attachments: [],
    canFollowUp: FOLLOW_UP_CALL_STATUSES.includes(status),
    sourceId: call.id as string,
  };
}

export function emailToTimelineEntry(
  email: EmailDocument,
  attachments: readonly TimelineAttachmentDto[],
): TimelineEntryDto {
  const status = String(email.status);

  return {
    id: `email:${email.id}`,
    kind: 'email',
    title: email.subject,
    description: email.recipientEmail,
    status: EMAIL_STATUS_LABELS[status] ?? status,
    // Sent time when known; an unsent draft falls back to when it was created.
    occurredAt: (email.sentAt ?? email.createdAt).toISOString(),
    durationSeconds: null,
    attachments,
    canFollowUp: false,
    sourceId: email.id as string,
  };
}

export function noteToTimelineEntry(note: ContactNoteDocument): TimelineEntryDto {
  return {
    id: `note:${note.id}`,
    kind: 'note',
    title: 'Note',
    description: note.body,
    status: null,
    occurredAt: note.createdAt.toISOString(),
    durationSeconds: null,
    attachments: [],
    canFollowUp: false,
    sourceId: note.id as string,
  };
}

export function importToTimelineEntry(batch: ImportBatchDocument): TimelineEntryDto {
  return {
    id: `import:${batch.id}`,
    kind: 'import',
    title: 'Added by import',
    description: batch.fileName,
    status: null,
    occurredAt: (batch.importedAt ?? batch.createdAt).toISOString(),
    durationSeconds: null,
    attachments: [],
    canFollowUp: false,
    sourceId: batch.id as string,
  };
}

export function toTimelineAttachment(
  attachment: EmailAttachmentAttributes & { _id: Types.ObjectId },
): TimelineAttachmentDto {
  return {
    id: attachment._id.toString(),
    fileName: attachment.fileName,
    sizeBytes: attachment.sizeBytes,
  };
}

/**
 * Orders entries newest first.
 *
 * Ordering happens here, after normalization, because entries come from four
 * collections and no single database query can sort across them.
 */
export function sortByOccurredAtDesc(
  entries: readonly TimelineEntryDto[],
): TimelineEntryDto[] {
  return [...entries].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}
