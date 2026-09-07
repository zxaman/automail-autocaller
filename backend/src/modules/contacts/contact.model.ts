import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const CONTACT_SOURCES = ['manual', 'import', 'api'] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

export interface ContactAttributes {
  /** Owning workspace. Every query MUST be scoped by this field. */
  workspaceId: Types.ObjectId;
  /** User who created the record, for future per-agent ownership reporting. */
  ownerId: Types.ObjectId;
  name: string;
  phone: string | null;
  /** E.164-normalized phone used for duplicate detection and dialing. */
  phoneNormalized: string | null;
  email: string | null;
  company: string | null;
  designation: string | null;
  location: string | null;
  tags: string[];
  notes: string | null;
  source: ContactSource;
  importBatchId: Types.ObjectId | null;
  lastContactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ContactDocument = HydratedDocument<ContactAttributes>;

const contactSchema = new Schema<ContactAttributes>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    phone: { type: String, default: null, trim: true, maxlength: 32 },
    phoneNormalized: { type: String, default: null, trim: true, maxlength: 32 },
    email: { type: String, default: null, trim: true, lowercase: true, maxlength: 320 },
    company: { type: String, default: null, trim: true, maxlength: 160 },
    designation: { type: String, default: null, trim: true, maxlength: 160 },
    location: { type: String, default: null, trim: true, maxlength: 160 },
    tags: { type: [String], default: [] },
    notes: { type: String, default: null, maxlength: 5000 },
    source: { type: String, enum: CONTACT_SOURCES, default: 'manual' },
    importBatchId: { type: Schema.Types.ObjectId, ref: 'ImportBatch', default: null },
    lastContactedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

// Primary list query: newest contacts within a workspace.
contactSchema.index({ workspaceId: 1, createdAt: -1 });
contactSchema.index({ workspaceId: 1, name: 1 });
contactSchema.index({ workspaceId: 1, tags: 1 });
contactSchema.index({ workspaceId: 1, company: 1 });

// Duplicate prevention is per workspace, and only when the value exists.
contactSchema.index(
  { workspaceId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
contactSchema.index(
  { workspaceId: 1, phoneNormalized: 1 },
  { unique: true, partialFilterExpression: { phoneNormalized: { $type: 'string' } } },
);

// Text search across the fields a recruiter actually searches by.
contactSchema.index(
  { name: 'text', email: 'text', company: 'text', designation: 'text' },
  { name: 'contact_text_search', weights: { name: 10, email: 5, company: 3, designation: 1 } },
);

export const ContactModel: Model<ContactAttributes> = model<ContactAttributes>(
  'Contact',
  contactSchema,
);
