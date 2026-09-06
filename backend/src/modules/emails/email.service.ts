import { Types } from 'mongoose';

import type { ObjectStorage } from '../../infrastructure/storage/object-storage';
import { AppError } from '../../shared/errors/app-error';
import type { EmailAccountService } from '../email-accounts/email-account.service';
import type { EmailAttachmentDocument } from './email-attachment.model';
import type { EmailRepository, EmailScope } from './email.repository';
import {
  toAttachmentDto,
  toEmailDto,
  toSignatureDto,
  toTemplateDto,
} from './email.mapper';
import type {
  ComposeEmailInput,
  ComposeResult,
  EmailAttachmentDto,
  EmailDto,
  EmailSignatureDto,
  EmailTemplateDto,
  PreviewRequest,
  PreviewResult,
} from './email.types';
import {
  buildRenderContext,
  extractVariables,
  htmlToPlainText,
  renderHtml,
  renderSubject,
  sanitize,
  templateRenderer,
} from './template-renderer';

export const MAX_RECIPIENTS_PER_SEND = 200;
export const MAX_ATTACHMENTS_PER_EMAIL = 5;
export const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_WORKSPACE = 100;
const DEFAULT_MAX_ATTEMPTS = 3;

export interface EmailJobEnqueuer {
  enqueue(payload: { emailId: string; workspaceId: string }): Promise<void>;
}

/**
 * Composer and library service.
 *
 * Rendering happens here, once per recipient, and the result is frozen onto
 * the email record. The worker therefore never re-renders and never needs the
 * template, so editing a template cannot change what an already-queued message
 * will say.
 */
export class EmailService {
  constructor(
    private readonly repository: EmailRepository,
    private readonly emailAccountService: EmailAccountService,
    private readonly storage: ObjectStorage,
    private readonly enqueuer: EmailJobEnqueuer,
  ) {}

  // --- templates -----------------------------------------------------------

  public async listTemplates(scope: EmailScope): Promise<EmailTemplateDto[]> {
    const templates = await this.repository.listTemplates(scope);
    return templates.map(toTemplateDto);
  }

  public async createTemplate(
    scope: EmailScope,
    ownerId: Types.ObjectId,
    input: { name: string; subject: string; bodyHtml: string },
  ): Promise<EmailTemplateDto> {
    const bodyHtml = sanitize(input.bodyHtml);
    const variables = extractVariables(`${input.subject} ${bodyHtml}`);

    try {
      const created = await this.repository.createTemplate(scope, ownerId, {
        name: input.name,
        subject: input.subject,
        bodyHtml,
        variables,
      });

      return toTemplateDto(created);
    } catch (error) {
      throw this.translateDuplicate(error, 'A template with this name already exists');
    }
  }

  public async updateTemplate(
    scope: EmailScope,
    templateId: string,
    input: { name: string; subject: string; bodyHtml: string },
  ): Promise<EmailTemplateDto> {
    const bodyHtml = sanitize(input.bodyHtml);

    let updated;
    try {
      updated = await this.repository.updateTemplate(scope, templateId, {
        name: input.name,
        subject: input.subject,
        bodyHtml,
        variables: extractVariables(`${input.subject} ${bodyHtml}`),
      });
    } catch (error) {
      throw this.translateDuplicate(error, 'A template with this name already exists');
    }

    if (!updated) {
      throw new AppError('Template not found', 404, 'EMAIL_TEMPLATE_NOT_FOUND');
    }

    return toTemplateDto(updated);
  }

  public async deleteTemplate(scope: EmailScope, templateId: string): Promise<void> {
    const deleted = await this.repository.deleteTemplate(scope, templateId);

    if (!deleted) {
      throw new AppError('Template not found', 404, 'EMAIL_TEMPLATE_NOT_FOUND');
    }
  }

  // --- signatures ----------------------------------------------------------

  public async listSignatures(scope: EmailScope): Promise<EmailSignatureDto[]> {
    const signatures = await this.repository.listSignatures(scope);
    return signatures.map(toSignatureDto);
  }

  public async createSignature(
    scope: EmailScope,
    ownerId: Types.ObjectId,
    input: { name: string; bodyHtml: string; isDefault?: boolean },
  ): Promise<EmailSignatureDto> {
    const existing = await this.repository.listSignatures(scope);
    // The first signature becomes the default so composing always has one.
    const isDefault = input.isDefault === true || existing.length === 0;

    if (isDefault) {
      // Clear first: the partial unique index rejects a second default.
      await this.repository.clearDefaultSignatureExcept(scope, new Types.ObjectId());
    }

    const created = await this.repository.createSignature(scope, ownerId, {
      name: input.name,
      bodyHtml: sanitize(input.bodyHtml),
      isDefault,
    });

    return toSignatureDto(created);
  }

  public async deleteSignature(scope: EmailScope, signatureId: string): Promise<void> {
    const deleted = await this.repository.deleteSignature(scope, signatureId);

    if (!deleted) {
      throw new AppError('Signature not found', 404, 'EMAIL_SIGNATURE_NOT_FOUND');
    }
  }

  // --- attachments ---------------------------------------------------------

  public async listAttachments(scope: EmailScope): Promise<EmailAttachmentDto[]> {
    const attachments = await this.repository.listAttachments(scope);
    return attachments.map(toAttachmentDto);
  }

  public async uploadAttachment(
    scope: EmailScope,
    ownerId: Types.ObjectId,
    file: { originalname: string; mimetype: string; buffer: Buffer },
  ): Promise<EmailAttachmentDto> {
    const existingCount = (await this.repository.listAttachments(scope)).length;

    if (existingCount >= MAX_ATTACHMENTS_PER_WORKSPACE) {
      throw new AppError(
        `A workspace can store at most ${MAX_ATTACHMENTS_PER_WORKSPACE} attachments`,
        409,
        'ATTACHMENT_LIMIT_REACHED',
      );
    }

    if (file.buffer.byteLength > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new AppError('The attachment is too large', 413, 'ATTACHMENT_TOO_LARGE');
    }

    const stored = await this.storage.put({
      workspaceId: scope.workspaceId.toString(),
      fileName: file.originalname,
      mimeType: file.mimetype,
      content: file.buffer,
    });

    // Identical bytes already in the library: reuse the record, drop the copy.
    const duplicate = await this.repository.findAttachmentByChecksum(scope, stored.checksum);
    if (duplicate) {
      await this.storage.delete(stored.key);
      return toAttachmentDto(duplicate);
    }

    const created = await this.repository.createAttachment(scope, ownerId, {
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: stored.sizeBytes,
      storageKey: stored.key,
      checksum: stored.checksum,
    });

    return toAttachmentDto(created);
  }

  public async deleteAttachment(scope: EmailScope, attachmentId: string): Promise<void> {
    const attachment = await this.repository.findAttachmentById(scope, attachmentId);

    if (!attachment) {
      throw new AppError('Attachment not found', 404, 'ATTACHMENT_NOT_FOUND');
    }

    await this.repository.deleteAttachment(scope, attachmentId);
    await this.storage.delete(attachment.storageKey);
  }

  // --- preview -------------------------------------------------------------

  public async preview(scope: EmailScope, request: PreviewRequest): Promise<PreviewResult> {
    const [contact] = await this.repository.findContactsByIds(scope, [request.contactId]);

    if (!contact) {
      throw new AppError('Contact not found', 404, 'CONTACT_NOT_FOUND');
    }

    const account = await this.emailAccountService.getDefaultAccountOrThrow(scope);
    const signatureHtml = await this.resolveSignatureHtml(scope, request.signatureId);
    const context = buildRenderContext(contact, {
      name: account.displayName,
      email: account.email,
    });
    const composed = `${request.bodyHtml}${signatureHtml}`;
    const bodyHtml = renderHtml(composed, context);

    return {
      recipientEmail: contact.email ?? '',
      recipientName: contact.name,
      subject: renderSubject(request.subject, context),
      bodyHtml,
      bodyText: htmlToPlainText(bodyHtml),
      unresolvedVariables: templateRenderer.findUnresolved(
        `${request.subject} ${composed}`,
        context,
      ),
    };
  }

  // --- compose -------------------------------------------------------------

  /**
   * Renders and queues one message per contact.
   *
   * Contacts without an email address are reported as skipped rather than
   * failing the whole send, so a large selection is not blocked by a few
   * incomplete records.
   */
  public async compose(
    scope: EmailScope,
    ownerId: Types.ObjectId,
    input: ComposeEmailInput,
  ): Promise<ComposeResult> {
    if (input.contactIds.length === 0) {
      throw new AppError('Select at least one recipient', 400, 'EMAIL_NO_RECIPIENTS');
    }

    if (input.contactIds.length > MAX_RECIPIENTS_PER_SEND) {
      throw new AppError(
        `A single send is limited to ${MAX_RECIPIENTS_PER_SEND} recipients`,
        400,
        'EMAIL_TOO_MANY_RECIPIENTS',
      );
    }

    const account = input.emailAccountId
      ? await this.emailAccountService.getActiveAccountOrThrow(scope, input.emailAccountId)
      : await this.emailAccountService.getDefaultAccountOrThrow(scope);

    const attachments = await this.resolveAttachments(scope, input.attachmentIds);
    const signatureHtml = await this.resolveSignatureHtml(scope, input.signatureId);
    const contacts = await this.repository.findContactsByIds(scope, input.contactIds);
    const byId = new Map(contacts.map((contact) => [contact.id as string, contact]));

    const skipped: { contactId: string; reason: string }[] = [];
    const records = [];

    for (const contactId of input.contactIds) {
      const contact = byId.get(contactId);

      if (!contact) {
        // Unknown id, or a contact in another workspace: indistinguishable here.
        skipped.push({ contactId, reason: 'Contact not found' });
        continue;
      }

      if (!contact.email) {
        skipped.push({ contactId, reason: 'Contact has no email address' });
        continue;
      }

      const context = buildRenderContext(contact, {
        name: account.displayName,
        email: account.email,
      });
      const bodyHtml = renderHtml(`${input.bodyHtml}${signatureHtml}`, context);

      records.push({
        contactId: contact._id as Types.ObjectId,
        recipientEmail: contact.email,
        recipientName: contact.name,
        emailAccountId: new Types.ObjectId(account.id),
        fromAddress: account.email,
        subject: renderSubject(input.subject, context),
        bodyHtml,
        bodyText: htmlToPlainText(bodyHtml),
        templateId: input.templateId ? new Types.ObjectId(input.templateId) : null,
        attachmentIds: attachments.map((attachment) => attachment._id as Types.ObjectId),
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
      });
    }

    if (records.length === 0) {
      throw new AppError(
        'None of the selected contacts have an email address',
        400,
        'EMAIL_NO_DELIVERABLE_RECIPIENTS',
      );
    }

    const created = await this.repository.createMany(scope, ownerId, records);
    await this.repository.incrementAttachmentUsage(
      attachments.map((attachment) => attachment._id as Types.ObjectId),
    );

    // Enqueue only after the records exist, so a job never references a
    // message the worker cannot find.
    for (const email of created) {
      await this.enqueuer.enqueue({
        emailId: (email._id as Types.ObjectId).toString(),
        workspaceId: scope.workspaceId.toString(),
      });
    }

    return {
      queued: created.length,
      skipped,
      emailIds: created.map((email) => (email._id as Types.ObjectId).toString()),
    };
  }

  // --- history -------------------------------------------------------------

  public async listEmails(
    scope: EmailScope,
    query: { page: number; pageSize: number; status?: string; contactId?: string },
  ): Promise<{ items: EmailDto[]; pagination: Record<string, number> }> {
    const { items, totalItems } = await this.repository.listPaged(scope, query);

    return {
      items: items.map(toEmailDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
      },
    };
  }

  public async getEmail(scope: EmailScope, emailId: string): Promise<EmailDto> {
    const email = await this.repository.findById(scope, emailId);

    if (!email) {
      throw new AppError('Email not found', 404, 'EMAIL_NOT_FOUND');
    }

    return toEmailDto(email);
  }

  /** Re-queues a failed message. Sent messages are never re-sent. */
  public async retry(scope: EmailScope, emailId: string): Promise<EmailDto> {
    const failed = await this.repository.findFailedById(scope, emailId);

    if (!failed) {
      throw new AppError('No failed email to retry', 404, 'EMAIL_NOT_RETRYABLE');
    }

    const requeued = await this.repository.resetForRetry(emailId);

    if (!requeued) {
      throw new AppError('No failed email to retry', 404, 'EMAIL_NOT_RETRYABLE');
    }

    await this.enqueuer.enqueue({
      emailId,
      workspaceId: scope.workspaceId.toString(),
    });

    return toEmailDto(requeued);
  }

  // --- helpers -------------------------------------------------------------

  private async resolveSignatureHtml(
    scope: EmailScope,
    signatureId: string | undefined,
  ): Promise<string> {
    const signature = signatureId
      ? await this.repository.findSignatureById(scope, signatureId)
      : await this.repository.findDefaultSignature(scope);

    if (signatureId && !signature) {
      throw new AppError('Signature not found', 404, 'EMAIL_SIGNATURE_NOT_FOUND');
    }

    return signature ? `<br/><br/>${signature.bodyHtml}` : '';
  }

  private async resolveAttachments(
    scope: EmailScope,
    attachmentIds: readonly string[],
  ): Promise<EmailAttachmentDocument[]> {
    if (attachmentIds.length === 0) {
      return [];
    }

    if (attachmentIds.length > MAX_ATTACHMENTS_PER_EMAIL) {
      throw new AppError(
        `An email can carry at most ${MAX_ATTACHMENTS_PER_EMAIL} attachments`,
        400,
        'EMAIL_TOO_MANY_ATTACHMENTS',
      );
    }

    const attachments = await this.repository.findAttachmentsByIds(scope, attachmentIds);

    if (attachments.length !== attachmentIds.length) {
      throw new AppError('Attachment not found', 404, 'ATTACHMENT_NOT_FOUND');
    }

    const totalBytes = attachments.reduce((sum, item) => sum + item.sizeBytes, 0);

    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new AppError(
        'The attachments exceed the total size limit',
        413,
        'EMAIL_ATTACHMENTS_TOO_LARGE',
      );
    }

    return attachments;
  }

  private translateDuplicate(error: unknown, message: string): unknown {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return new AppError(message, 409, 'EMAIL_TEMPLATE_DUPLICATE');
    }

    return error;
  }
}
