import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const EMAIL_ACCOUNT_STATUSES = ['active', 'verification_failed', 'disabled'] as const;
export type EmailAccountStatus = (typeof EMAIL_ACCOUNT_STATUSES)[number];

/** The encrypted App Password. Never leaves the server. */
export interface StoredCredential {
  version: number;
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface EmailAccountAttributes {
  workspaceId: Types.ObjectId;
  ownerId: Types.ObjectId;
  email: string;
  displayName: string;
  provider: 'gmail';
  status: EmailAccountStatus;
  isDefault: boolean;
  credential: StoredCredential;
  lastVerifiedAt: Date | null;
  lastFailureCode: string | null;
  lastFailureAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type EmailAccountDocument = HydratedDocument<EmailAccountAttributes>;

const credentialSchema = new Schema<StoredCredential>(
  {
    version: { type: Number, required: true },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  { _id: false },
);

const emailAccountSchema = new Schema<EmailAccountAttributes>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    provider: { type: String, enum: ['gmail'], default: 'gmail' },
    status: { type: String, enum: EMAIL_ACCOUNT_STATUSES, default: 'active' },
    isDefault: { type: Boolean, default: false },
    /**
     * `select: false` means the ciphertext is excluded from every query unless
     * explicitly requested. Read paths that build DTOs therefore cannot leak it
     * even by accident.
     */
    credential: { type: credentialSchema, required: true, select: false },
    lastVerifiedAt: { type: Date, default: null },
    lastFailureCode: { type: String, default: null },
    lastFailureAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

// One connection per address per workspace; reconnecting replaces the credential.
emailAccountSchema.index({ workspaceId: 1, email: 1 }, { unique: true });
emailAccountSchema.index({ workspaceId: 1, createdAt: -1 });
// At most one default per workspace, enforced by the database rather than by
// application logic alone.
emailAccountSchema.index(
  { workspaceId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);

/** Defence in depth: the credential can never ride along in a JSON response. */
function stripCredential(_document: unknown, record: EmailAccountAttributes): unknown {
  delete (record as Partial<EmailAccountAttributes>).credential;
  return record;
}

emailAccountSchema.set('toJSON', { transform: stripCredential });
emailAccountSchema.set('toObject', { transform: stripCredential });

export const EmailAccountModel: Model<EmailAccountAttributes> = model<EmailAccountAttributes>(
  'EmailAccount',
  emailAccountSchema,
);
