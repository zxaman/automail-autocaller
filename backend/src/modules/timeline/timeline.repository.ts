import type { Types } from 'mongoose';

import { CallModel, type CallDocument } from '../calls/call.model';
import { ContactModel, type ContactDocument } from '../contacts/contact.model';
import {
  EmailAttachmentModel,
  type EmailAttachmentAttributes,
} from '../emails/email-attachment.model';
import { EmailModel, type EmailDocument } from '../emails/email.model';
import { ImportBatchModel, type ImportBatchDocument } from '../imports/import-batch.model';
import { ContactNoteModel, type ContactNoteDocument } from './contact-note.model';

export interface TimelineScope {
  workspaceId: Types.ObjectId;
}

/**
 * Reads the records that make up a contact's history.
 *
 * Every query is workspace-scoped. The contact id alone is not a permission:
 * an id from another workspace must return nothing rather than another
 * tenant's history.
 */
export class TimelineRepository {
  public async findContact(
    scope: TimelineScope,
    contactId: string,
  ): Promise<ContactDocument | null> {
    return ContactModel.findOne({ _id: contactId, workspaceId: scope.workspaceId }).exec();
  }

  public async findCalls(
    scope: TimelineScope,
    contactId: string,
    limit: number,
  ): Promise<CallDocument[]> {
    return CallModel.find({ workspaceId: scope.workspaceId, contactId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .exec();
  }

  public async findEmails(
    scope: TimelineScope,
    contactId: string,
    limit: number,
  ): Promise<EmailDocument[]> {
    return EmailModel.find({ workspaceId: scope.workspaceId, contactId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  public async findNotes(
    scope: TimelineScope,
    contactId: string,
    limit: number,
  ): Promise<ContactNoteDocument[]> {
    return ContactNoteModel.find({ workspaceId: scope.workspaceId, contactId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * The import batch a contact arrived in, if any.
   *
   * This is a single entry rather than a list: a contact enters the workspace
   * exactly once.
   */
  public async findImportBatch(
    scope: TimelineScope,
    importBatchId: Types.ObjectId | null,
  ): Promise<ImportBatchDocument | null> {
    if (!importBatchId) {
      return null;
    }

    return ImportBatchModel.findOne({
      _id: importBatchId,
      workspaceId: scope.workspaceId,
    }).exec();
  }

  /** Attachment metadata for the emails on the timeline. Bytes stay in storage. */
  public async findAttachments(
    scope: TimelineScope,
    attachmentIds: readonly Types.ObjectId[],
  ): Promise<(EmailAttachmentAttributes & { _id: Types.ObjectId })[]> {
    if (attachmentIds.length === 0) {
      return [];
    }

    return EmailAttachmentModel.find({
      _id: { $in: attachmentIds },
      workspaceId: scope.workspaceId,
    })
      .select('fileName sizeBytes')
      .lean<(EmailAttachmentAttributes & { _id: Types.ObjectId })[]>()
      .exec();
  }

  public async createNote(
    scope: TimelineScope,
    ownerId: Types.ObjectId,
    attributes: { contactId: string; body: string; callId: string | null },
  ): Promise<ContactNoteDocument> {
    return ContactNoteModel.create({
      workspaceId: scope.workspaceId,
      ownerId,
      contactId: attributes.contactId,
      body: attributes.body,
      callId: attributes.callId,
    });
  }

  public async deleteNote(scope: TimelineScope, noteId: string): Promise<boolean> {
    const result = await ContactNoteModel.deleteOne({
      _id: noteId,
      workspaceId: scope.workspaceId,
    }).exec();

    return result.deletedCount === 1;
  }

  public async findCallById(
    scope: TimelineScope,
    callId: string,
  ): Promise<CallDocument | null> {
    return CallModel.findOne({ _id: callId, workspaceId: scope.workspaceId }).exec();
  }
}
