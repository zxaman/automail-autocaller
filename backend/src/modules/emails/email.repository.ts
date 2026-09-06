import type { Types } from 'mongoose';

import { ContactModel, type ContactDocument } from '../contacts/contact.model';
import { EmailAttachmentModel, type EmailAttachmentDocument } from './email-attachment.model';
import { EmailSignatureModel, type EmailSignatureDocument } from './email-signature.model';
import { EmailTemplateModel, type EmailTemplateDocument } from './email-template.model';
import { EmailModel, type EmailAttributes, type EmailDocument, type EmailStatus } from './email.model';

export interface EmailScope {
  workspaceId: Types.ObjectId;
}

export interface CreateEmailAttributes {
  contactId: Types.ObjectId | null;
  recipientEmail: string;
  recipientName: string | null;
  emailAccountId: Types.ObjectId;
  fromAddress: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  templateId: Types.ObjectId | null;
  attachmentIds: Types.ObjectId[];
  maxAttempts: number;
}

/** Every query is workspace-scoped, as with contacts and imports. */
export class EmailRepository {
  // --- messages ------------------------------------------------------------

  public async createMany(
    scope: EmailScope,
    ownerId: Types.ObjectId,
    records: readonly CreateEmailAttributes[],
  ): Promise<EmailDocument[]> {
    if (records.length === 0) {
      return [];
    }

    const documents = records.map((record) => ({
      ...record,
      workspaceId: scope.workspaceId,
      ownerId,
      status: 'queued' satisfies EmailStatus,
      queuedAt: new Date(),
    }));

    // insertMany widens the enum-typed fields, so the concrete document type
    // is reasserted here rather than loosening EmailAttributes.
    const inserted = await EmailModel.insertMany(documents);
    return inserted as unknown as EmailDocument[];
  }

  public async findById(scope: EmailScope, emailId: string): Promise<EmailDocument | null> {
    return EmailModel.findOne({ _id: emailId, workspaceId: scope.workspaceId }).exec();
  }

  public async listPaged(
    scope: EmailScope,
    query: { page: number; pageSize: number; status?: string; contactId?: string },
  ): Promise<{ items: EmailDocument[]; totalItems: number }> {
    const filter: Record<string, unknown> = { workspaceId: scope.workspaceId };
    if (query.status) {
      filter['status'] = query.status;
    }
    if (query.contactId) {
      filter['contactId'] = query.contactId;
    }

    const [items, totalItems] = await Promise.all([
      EmailModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .exec(),
      EmailModel.countDocuments(filter).exec(),
    ]);

    return { items, totalItems };
  }

  public async markSending(emailId: string): Promise<EmailDocument | null> {
    return EmailModel.findByIdAndUpdate(
      emailId,
      { $set: { status: 'sending' satisfies EmailStatus }, $inc: { attemptCount: 1 } },
      { new: true },
    ).exec();
  }

  public async markSent(emailId: string, providerMessageId: string): Promise<void> {
    await EmailModel.findByIdAndUpdate(emailId, {
      $set: {
        status: 'sent' satisfies EmailStatus,
        sentAt: new Date(),
        providerMessageId,
        failureReason: null,
        failureCode: null,
      },
    }).exec();
  }

  public async markFailed(
    emailId: string,
    failureCode: string,
    failureReason: string,
  ): Promise<void> {
    await EmailModel.findByIdAndUpdate(emailId, {
      $set: {
        status: 'failed' satisfies EmailStatus,
        failedAt: new Date(),
        failureCode,
        failureReason,
      },
    }).exec();
  }

  /** Returns messages left mid-flight, e.g. by a restart, so they can requeue. */
  public async findResumable(scope: EmailScope): Promise<EmailDocument[]> {
    return EmailModel.find({
      workspaceId: scope.workspaceId,
      status: { $in: ['queued', 'sending'] satisfies EmailStatus[] },
    })
      .sort({ createdAt: 1 })
      .limit(500)
      .exec();
  }

  public async findFailedById(scope: EmailScope, emailId: string): Promise<EmailDocument | null> {
    return EmailModel.findOne({
      _id: emailId,
      workspaceId: scope.workspaceId,
      status: 'failed' satisfies EmailStatus,
    }).exec();
  }

  public async resetForRetry(emailId: string): Promise<EmailDocument | null> {
    return EmailModel.findByIdAndUpdate(
      emailId,
      {
        $set: {
          status: 'queued' satisfies EmailStatus,
          queuedAt: new Date(),
          failedAt: null,
          failureCode: null,
          failureReason: null,
        },
      },
      { new: true },
    ).exec();
  }

  // --- contacts ------------------------------------------------------------

  public async findContactsByIds(
    scope: EmailScope,
    contactIds: readonly string[],
  ): Promise<ContactDocument[]> {
    return ContactModel.find({
      _id: { $in: contactIds },
      workspaceId: scope.workspaceId,
    }).exec();
  }

  // --- templates -----------------------------------------------------------

  public async listTemplates(scope: EmailScope): Promise<EmailTemplateDocument[]> {
    return EmailTemplateModel.find({ workspaceId: scope.workspaceId, isArchived: false })
      .sort({ updatedAt: -1 })
      .exec();
  }

  public async findTemplateById(
    scope: EmailScope,
    templateId: string,
  ): Promise<EmailTemplateDocument | null> {
    return EmailTemplateModel.findOne({
      _id: templateId,
      workspaceId: scope.workspaceId,
    }).exec();
  }

  public async createTemplate(
    scope: EmailScope,
    ownerId: Types.ObjectId,
    attributes: { name: string; subject: string; bodyHtml: string; variables: string[] },
  ): Promise<EmailTemplateDocument> {
    return EmailTemplateModel.create({
      ...attributes,
      workspaceId: scope.workspaceId,
      ownerId,
    });
  }

  public async updateTemplate(
    scope: EmailScope,
    templateId: string,
    attributes: { name: string; subject: string; bodyHtml: string; variables: string[] },
  ): Promise<EmailTemplateDocument | null> {
    return EmailTemplateModel.findOneAndUpdate(
      { _id: templateId, workspaceId: scope.workspaceId },
      { $set: attributes },
      { new: true, runValidators: true },
    ).exec();
  }

  public async deleteTemplate(scope: EmailScope, templateId: string): Promise<boolean> {
    const result = await EmailTemplateModel.deleteOne({
      _id: templateId,
      workspaceId: scope.workspaceId,
    }).exec();

    return result.deletedCount === 1;
  }

  // --- signatures ----------------------------------------------------------

  public async listSignatures(scope: EmailScope): Promise<EmailSignatureDocument[]> {
    return EmailSignatureModel.find({ workspaceId: scope.workspaceId })
      .sort({ isDefault: -1, createdAt: -1 })
      .exec();
  }

  public async findSignatureById(
    scope: EmailScope,
    signatureId: string,
  ): Promise<EmailSignatureDocument | null> {
    return EmailSignatureModel.findOne({
      _id: signatureId,
      workspaceId: scope.workspaceId,
    }).exec();
  }

  public async findDefaultSignature(scope: EmailScope): Promise<EmailSignatureDocument | null> {
    return EmailSignatureModel.findOne({
      workspaceId: scope.workspaceId,
      isDefault: true,
    }).exec();
  }

  public async createSignature(
    scope: EmailScope,
    ownerId: Types.ObjectId,
    attributes: { name: string; bodyHtml: string; isDefault: boolean },
  ): Promise<EmailSignatureDocument> {
    return EmailSignatureModel.create({
      ...attributes,
      workspaceId: scope.workspaceId,
      ownerId,
    });
  }

  public async clearDefaultSignatureExcept(
    scope: EmailScope,
    signatureId: Types.ObjectId,
  ): Promise<void> {
    await EmailSignatureModel.updateMany(
      { workspaceId: scope.workspaceId, _id: { $ne: signatureId }, isDefault: true },
      { $set: { isDefault: false } },
    ).exec();
  }

  public async deleteSignature(scope: EmailScope, signatureId: string): Promise<boolean> {
    const result = await EmailSignatureModel.deleteOne({
      _id: signatureId,
      workspaceId: scope.workspaceId,
    }).exec();

    return result.deletedCount === 1;
  }

  // --- attachments ---------------------------------------------------------

  public async listAttachments(scope: EmailScope): Promise<EmailAttachmentDocument[]> {
    return EmailAttachmentModel.find({ workspaceId: scope.workspaceId })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findAttachmentsByIds(
    scope: EmailScope,
    attachmentIds: readonly (string | Types.ObjectId)[],
  ): Promise<EmailAttachmentDocument[]> {
    return EmailAttachmentModel.find({
      _id: { $in: attachmentIds },
      workspaceId: scope.workspaceId,
    }).exec();
  }

  public async findAttachmentByChecksum(
    scope: EmailScope,
    checksum: string,
  ): Promise<EmailAttachmentDocument | null> {
    return EmailAttachmentModel.findOne({
      workspaceId: scope.workspaceId,
      checksum,
    }).exec();
  }

  public async createAttachment(
    scope: EmailScope,
    ownerId: Types.ObjectId,
    attributes: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      storageKey: string;
      checksum: string;
    },
  ): Promise<EmailAttachmentDocument> {
    return EmailAttachmentModel.create({
      ...attributes,
      workspaceId: scope.workspaceId,
      ownerId,
    });
  }

  public async findAttachmentById(
    scope: EmailScope,
    attachmentId: string,
  ): Promise<EmailAttachmentDocument | null> {
    return EmailAttachmentModel.findOne({
      _id: attachmentId,
      workspaceId: scope.workspaceId,
    }).exec();
  }

  public async deleteAttachment(scope: EmailScope, attachmentId: string): Promise<boolean> {
    const result = await EmailAttachmentModel.deleteOne({
      _id: attachmentId,
      workspaceId: scope.workspaceId,
    }).exec();

    return result.deletedCount === 1;
  }

  public async incrementAttachmentUsage(
    attachmentIds: readonly Types.ObjectId[],
  ): Promise<void> {
    if (attachmentIds.length === 0) {
      return;
    }

    await EmailAttachmentModel.updateMany(
      { _id: { $in: attachmentIds } },
      { $inc: { usageCount: 1 } },
    ).exec();
  }
}
