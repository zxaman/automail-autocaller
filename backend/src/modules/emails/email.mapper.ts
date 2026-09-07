import type { Types } from 'mongoose';

import type { EmailAttachmentDocument } from './email-attachment.model';
import type { EmailSignatureDocument } from './email-signature.model';
import type { EmailTemplateDocument } from './email-template.model';
import type { EmailDocument } from './email.model';
import type {
  EmailAttachmentDto,
  EmailDto,
  EmailSignatureDto,
  EmailTemplateDto,
} from './email.types';

const toId = (value: unknown): string => String(value);
const toIso = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

/** DTOs never expose workspaceId, ownerId, or storage keys. */
export function toTemplateDto(template: EmailTemplateDocument): EmailTemplateDto {
  return {
    id: toId(template._id),
    name: template.name,
    subject: template.subject,
    bodyHtml: template.bodyHtml,
    variables: [...template.variables],
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export function toSignatureDto(signature: EmailSignatureDocument): EmailSignatureDto {
  return {
    id: toId(signature._id),
    name: signature.name,
    bodyHtml: signature.bodyHtml,
    isDefault: signature.isDefault,
    createdAt: signature.createdAt.toISOString(),
  };
}

export function toAttachmentDto(attachment: EmailAttachmentDocument): EmailAttachmentDto {
  return {
    id: toId(attachment._id),
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    usageCount: attachment.usageCount,
    createdAt: attachment.createdAt.toISOString(),
  };
}

export function toEmailDto(email: EmailDocument): EmailDto {
  return {
    id: toId(email._id),
    contactId: email.contactId ? toId(email.contactId as Types.ObjectId) : null,
    recipientEmail: email.recipientEmail,
    recipientName: email.recipientName,
    subject: email.subject,
    status: email.status,
    fromAddress: email.fromAddress,
    failureReason: email.failureReason,
    failureCode: email.failureCode,
    attemptCount: email.attemptCount,
    queuedAt: toIso(email.queuedAt),
    sentAt: toIso(email.sentAt),
    failedAt: toIso(email.failedAt),
    createdAt: email.createdAt.toISOString(),
  };
}
