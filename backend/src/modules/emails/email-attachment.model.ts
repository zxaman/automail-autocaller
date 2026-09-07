import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface EmailAttachmentAttributes {
  workspaceId: Types.ObjectId;
  ownerId: Types.ObjectId;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /**
   * Opaque key in private object storage. The bytes are never stored in
   * MongoDB, and the key is never a public URL.
   */
  storageKey: string;
  checksum: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailAttachmentDocument = HydratedDocument<EmailAttachmentAttributes>;

const emailAttachmentSchema = new Schema<EmailAttachmentAttributes>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true, trim: true, maxlength: 260 },
    mimeType: { type: String, required: true, trim: true, maxlength: 160 },
    sizeBytes: { type: Number, required: true, min: 0 },
    storageKey: { type: String, required: true, trim: true, maxlength: 512 },
    checksum: { type: String, required: true, maxlength: 128 },
    usageCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

emailAttachmentSchema.index({ workspaceId: 1, createdAt: -1 });
// Identical content uploaded twice in a workspace reuses one stored object.
emailAttachmentSchema.index({ workspaceId: 1, checksum: 1 });

export const EmailAttachmentModel: Model<EmailAttachmentAttributes> =
  model<EmailAttachmentAttributes>('EmailAttachment', emailAttachmentSchema);
