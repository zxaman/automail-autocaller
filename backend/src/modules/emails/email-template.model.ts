import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface EmailTemplateAttributes {
  workspaceId: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  subject: string;
  bodyHtml: string;
  /** Variables detected at save time, so the UI can list them without parsing. */
  variables: string[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailTemplateDocument = HydratedDocument<EmailTemplateAttributes>;

const emailTemplateSchema = new Schema<EmailTemplateAttributes>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    subject: { type: String, required: true, trim: true, maxlength: 500 },
    // Stored already sanitized; sanitizing again on render is defence in depth.
    bodyHtml: { type: String, required: true, maxlength: 100_000 },
    variables: { type: [String], default: [] },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

emailTemplateSchema.index({ workspaceId: 1, createdAt: -1 });
emailTemplateSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export const EmailTemplateModel: Model<EmailTemplateAttributes> =
  model<EmailTemplateAttributes>('EmailTemplate', emailTemplateSchema);
