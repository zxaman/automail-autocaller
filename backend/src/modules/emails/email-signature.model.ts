import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface EmailSignatureAttributes {
  workspaceId: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  bodyHtml: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailSignatureDocument = HydratedDocument<EmailSignatureAttributes>;

const emailSignatureSchema = new Schema<EmailSignatureAttributes>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    bodyHtml: { type: String, required: true, maxlength: 20_000 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

emailSignatureSchema.index({ workspaceId: 1, createdAt: -1 });
// One default signature per workspace, enforced by the database.
emailSignatureSchema.index(
  { workspaceId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);

export const EmailSignatureModel: Model<EmailSignatureAttributes> =
  model<EmailSignatureAttributes>('EmailSignature', emailSignatureSchema);
