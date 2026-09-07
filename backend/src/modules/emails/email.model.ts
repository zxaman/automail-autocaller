import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const EMAIL_STATUSES = ['draft', 'queued', 'sending', 'sent', 'failed'] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export interface EmailAttributes {
  workspaceId: Types.ObjectId;
  ownerId: Types.ObjectId;
  contactId: Types.ObjectId | null;
  /** One record per recipient so recipients are never exposed to each other. */
  recipientEmail: string;
  recipientName: string | null;
  emailAccountId: Types.ObjectId | null;
  fromAddress: string | null;
  subject: string;
  /**
   * Snapshot of exactly what was sent. Stored per recipient so history stays
   * accurate even if the template is later edited or deleted.
   */
  bodyHtml: string;
  bodyText: string;
  status: EmailStatus;
  templateId: Types.ObjectId | null;
  campaignId: Types.ObjectId | null;
  attachmentIds: Types.ObjectId[];
  queuedAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  /** Provider failure code, used to decide whether a retry is worthwhile. */
  failureCode: string | null;
  attemptCount: number;
  maxAttempts: number;
  /** SMTP accepted the message. This is NOT an open or a read. */
  providerMessageId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailDocument = HydratedDocument<EmailAttributes>;

/**
 * One record per recipient. A multi-contact send creates N records and N jobs,
 * so recipients are never placed in a shared To/Cc field and each delivery has
 * its own independent status, retry count, and rendered snapshot.
 */
const emailSchema = new Schema<EmailAttributes>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', default: null },
    recipientEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    recipientName: { type: String, default: null, trim: true, maxlength: 160 },
    emailAccountId: { type: Schema.Types.ObjectId, ref: 'EmailAccount', default: null },
    fromAddress: { type: String, default: null, trim: true, maxlength: 320 },
    subject: { type: String, required: true, trim: true, maxlength: 500 },
    bodyHtml: { type: String, default: '' },
    bodyText: { type: String, default: '' },
    status: { type: String, enum: EMAIL_STATUSES, required: true, default: 'draft' },
    templateId: { type: Schema.Types.ObjectId, ref: 'EmailTemplate', default: null },
    campaignId: { type: Schema.Types.ObjectId, ref: 'EmailCampaign', default: null },
    attachmentIds: { type: [Schema.Types.ObjectId], default: [] },
    queuedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureCode: { type: String, default: null },
    maxAttempts: { type: Number, default: 3, min: 1, max: 10 },
    providerMessageId: { type: String, default: null },
    failureReason: { type: String, default: null, maxlength: 500 },
    attemptCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

emailSchema.index({ workspaceId: 1, createdAt: -1 });
emailSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
emailSchema.index({ workspaceId: 1, contactId: 1, createdAt: -1 });

export const EmailModel: Model<EmailAttributes> = model<EmailAttributes>('Email', emailSchema);
