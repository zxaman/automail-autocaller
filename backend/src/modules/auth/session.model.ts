import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface SessionAttributes {
  /** SHA-256 hash of the opaque session token. The raw token is never stored. */
  tokenHash: string;
  userId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SessionDocument = HydratedDocument<SessionAttributes>;

const sessionSchema = new Schema<SessionAttributes>(
  {
    tokenHash: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userAgent: { type: String, default: null, maxlength: 512 },
    ipAddress: { type: String, default: null, maxlength: 64 },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, versionKey: false },
);

sessionSchema.index({ tokenHash: 1 }, { unique: true });
// MongoDB removes expired sessions automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel: Model<SessionAttributes> = model<SessionAttributes>(
  'Session',
  sessionSchema,
);
