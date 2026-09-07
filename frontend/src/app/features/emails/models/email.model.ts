export type EmailStatus = 'draft' | 'queued' | 'sending' | 'sent' | 'failed';

export interface EmailTemplate {
  readonly id: string;
  readonly name: string;
  readonly subject: string;
  readonly bodyHtml: string;
  readonly variables: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EmailSignature {
  readonly id: string;
  readonly name: string;
  readonly bodyHtml: string;
  readonly isDefault: boolean;
  readonly createdAt: string;
}

export interface EmailAttachment {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly usageCount: number;
  readonly createdAt: string;
}

/** A single delivery. One record exists per recipient. */
export interface EmailRecord {
  readonly id: string;
  readonly contactId: string | null;
  readonly recipientEmail: string;
  readonly recipientName: string | null;
  readonly subject: string;
  readonly status: EmailStatus;
  readonly fromAddress: string | null;
  readonly failureReason: string | null;
  readonly failureCode: string | null;
  readonly attemptCount: number;
  readonly queuedAt: string | null;
  readonly sentAt: string | null;
  readonly failedAt: string | null;
  readonly createdAt: string;
}

export interface ComposeEmailPayload {
  readonly contactIds: readonly string[];
  readonly emailAccountId?: string;
  readonly templateId?: string;
  readonly signatureId?: string;
  readonly subject: string;
  readonly bodyHtml: string;
  readonly attachmentIds: readonly string[];
}

export interface ComposeResult {
  readonly queued: number;
  readonly skipped: readonly { contactId: string; reason: string }[];
  readonly emailIds: readonly string[];
}

export interface EmailPreview {
  readonly recipientEmail: string;
  readonly recipientName: string;
  readonly subject: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
  readonly unresolvedVariables: readonly string[];
}

export interface EmailListResult {
  readonly items: readonly EmailRecord[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

/** Variables the composer offers for insertion. Mirrors the server whitelist. */
export const TEMPLATE_VARIABLES: readonly { token: string; label: string }[] = [
  { token: '{{ contact.name }}', label: 'Full name' },
  { token: '{{ contact.firstName }}', label: 'First name' },
  { token: '{{ contact.email }}', label: 'Email' },
  { token: '{{ contact.phone }}', label: 'Phone' },
  { token: '{{ contact.company }}', label: 'Company' },
  { token: '{{ contact.designation }}', label: 'Designation' },
  { token: '{{ contact.location }}', label: 'Location' },
  { token: '{{ sender.name }}', label: 'Your name' },
  { token: '{{ sender.email }}', label: 'Your email' },
];
