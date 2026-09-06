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
  status: EmailStatus;
  templateId: Types.ObjectId | null;
  campaignId: Types.ObjectId | null;
  attachmentIds: Types.ObjectId[];
  queuedAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailDocument = HydratedDocument<EmailAttributes>;

/**
 * Email records. Introduced here for dashboard aggregation; sending, queueing,
 * and templating arrive in the AutoMail phase.
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
    status: { type: String, enum: EMAIL_STATUSES, required: true, default: 'draft' },
    templateId: { type: Schema.Types.ObjectId, ref: 'EmailTemplate', default: null },
    campaignId: { type: Schema.Types.ObjectId, ref: 'EmailCampaign', default: null },
    attachmentIds: { type: [Schema.Types.ObjectId], default: [] },
    queuedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    failureReason: { type: String, default: null, maxlength: 500 },
    attemptCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

emailSchema.index({ workspaceId: 1, createdAt: -1 });
emailSchema.index({ workspaceId: 1, status: 1, createdAt: -1 });
emailSchema.index({ workspaceId: 1, contactId: 1, createdAt: -1 });

export const EmailModel: Model<EmailAttributes> = model<EmailAttributes>('Email', emailSchema);
