import { AppError } from '../../shared/errors/app-error';
import {
  callToTimelineEntry,
  emailToTimelineEntry,
  importToTimelineEntry,
  noteToTimelineEntry,
  sortByOccurredAtDesc,
  toTimelineAttachment,
} from './timeline.mapper';
import type { TimelineRepository, TimelineScope } from './timeline.repository';
import type {
  CreateNoteInput,
  FollowUpDraftDto,
  TimelineEntryDto,
  TimelineQuery,
} from './timeline.types';

/** Per-source cap, so one noisy source cannot crowd out the others. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface ContactTimelineResult {
  readonly contactId: string;
  readonly contactName: string;
  readonly entries: readonly TimelineEntryDto[];
}

/**
 * Builds a contact's unified history.
 *
 * Calls, emails, notes, and the import that created the contact live in
 * separate collections, so they are read separately, normalized to one shape,
 * and merged in memory. Ownership is checked once by loading the contact
 * within the workspace scope: if that fails, nothing else is read.
 */
export class TimelineService {
  constructor(private readonly repository: TimelineRepository) {}

  public async getContactTimeline(
    scope: TimelineScope,
    contactId: string,
    query: TimelineQuery = {},
  ): Promise<ContactTimelineResult> {
    const contact = await this.requireContact(scope, contactId);
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const kinds = query.kinds && query.kinds.length > 0 ? new Set(query.kinds) : null;
    const wants = (kind: string): boolean => kinds === null || kinds.has(kind as never);

    const [calls, emails, notes, importBatch] = await Promise.all([
      wants('call') ? this.repository.findCalls(scope, contactId, limit) : [],
      wants('email') ? this.repository.findEmails(scope, contactId, limit) : [],
      wants('note') ? this.repository.findNotes(scope, contactId, limit) : [],
      wants('import')
        ? this.repository.findImportBatch(scope, contact.importBatchId)
        : null,
    ]);

    const attachmentIds = emails.flatMap((email) => email.attachmentIds ?? []);
    const attachments = await this.repository.findAttachments(scope, attachmentIds);
    const attachmentsById = new Map(
      attachments.map((attachment) => [attachment._id.toString(), attachment]),
    );

    const entries: TimelineEntryDto[] = [
      ...calls.map(callToTimelineEntry),
      ...emails.map((email) =>
        emailToTimelineEntry(
          email,
          (email.attachmentIds ?? [])
            .map((id) => attachmentsById.get(id.toString()))
            .filter((found) => found !== undefined)
            .map(toTimelineAttachment),
        ),
      ),
      ...notes.map(noteToTimelineEntry),
      ...(importBatch ? [importToTimelineEntry(importBatch)] : []),
    ];

    return {
      contactId: contact.id as string,
      contactName: contact.name,
      entries: sortByOccurredAtDesc(entries).slice(0, limit),
    };
  }

  public async addNote(
    scope: TimelineScope,
    ownerId: Parameters<TimelineRepository['createNote']>[1],
    contactId: string,
    input: CreateNoteInput,
  ): Promise<TimelineEntryDto> {
    await this.requireContact(scope, contactId);

    const body = input.body.trim();

    if (body.length === 0) {
      throw new AppError('A note cannot be empty', 400, 'NOTE_BODY_REQUIRED');
    }

    // A note may reference a call, but only one inside this workspace.
    if (input.callId) {
      const call = await this.repository.findCallById(scope, input.callId);

      if (!call) {
        throw new AppError('Call not found', 404, 'CALL_NOT_FOUND');
      }
    }

    const note = await this.repository.createNote(scope, ownerId, {
      contactId,
      body,
      callId: input.callId ?? null,
    });

    return noteToTimelineEntry(note);
  }

  public async deleteNote(scope: TimelineScope, noteId: string): Promise<void> {
    const deleted = await this.repository.deleteNote(scope, noteId);

    if (!deleted) {
      throw new AppError('Note not found', 404, 'NOTE_NOT_FOUND');
    }
  }

  /**
   * Prefills a follow-up email for a contact just called.
   *
   * The draft is only ever a starting point: it is returned to the composer
   * for the user to edit, and nothing is sent from here. When the contact has
   * no email address we say so plainly instead of returning a draft that
   * cannot be delivered.
   */
  public async buildFollowUpDraft(
    scope: TimelineScope,
    contactId: string,
    callId?: string,
  ): Promise<FollowUpDraftDto> {
    const contact = await this.requireContact(scope, contactId);

    if (callId) {
      const call = await this.repository.findCallById(scope, callId);

      if (!call) {
        throw new AppError('Call not found', 404, 'CALL_NOT_FOUND');
      }

      if (call.contactId?.toString() !== contact.id) {
        throw new AppError(
          'That call does not belong to this contact',
          400,
          'CALL_CONTACT_MISMATCH',
        );
      }
    }

    const firstName = contact.name.split(' ')[0] ?? contact.name;
    const hasEmail = Boolean(contact.email);

    return {
      contactId: contact.id as string,
      contactName: contact.name,
      email: contact.email,
      subject: `Following up on our call`,
      body: [
        `Hi ${firstName},`,
        '',
        'Thank you for taking my call today. As discussed, I am sharing the details below.',
        '',
        '',
        'Best regards,',
      ].join('\n'),
      canSend: hasEmail,
      reason: hasEmail ? null : 'This contact has no email address on file',
    };
  }

  private async requireContact(scope: TimelineScope, contactId: string) {
    const contact = await this.repository.findContact(scope, contactId);

    // A contact in another workspace is reported as not found, never as
    // forbidden, so the API does not confirm that the id exists elsewhere.
    if (!contact) {
      throw new AppError('Contact not found', 404, 'CONTACT_NOT_FOUND');
    }

    return contact;
  }
}
