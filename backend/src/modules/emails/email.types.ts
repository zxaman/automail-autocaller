export interface EmailTemplateDto {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailSignatureDto {
  id: string;
  name: string;
  bodyHtml: string;
  isDefault: boolean;
  createdAt: string;
}

export interface EmailAttachmentDto {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  usageCount: number;
  createdAt: string;
}

export interface EmailDto {
  id: string;
  contactId: string | null;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  status: string;
  fromAddress: string | null;
  failureReason: string | null;
  failureCode: string | null;
  attemptCount: number;
  queuedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

/** What the composer submits. */
export interface ComposeEmailInput {
  contactIds: string[];
  emailAccountId?: string;
  templateId?: string;
  signatureId?: string;
  subject: string;
  bodyHtml: string;
  attachmentIds: string[];
}

export interface ComposeResult {
  queued: number;
  skipped: { contactId: string; reason: string }[];
  emailIds: string[];
}

export interface PreviewRequest {
  contactId: string;
  subject: string;
  bodyHtml: string;
  signatureId?: string;
}

export interface PreviewResult {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  unresolvedVariables: string[];
}

/** Payload placed on the queue. Only ids — no credentials, no rendered body. */
export interface EmailJobPayload {
  emailId: string;
  workspaceId: string;
}
