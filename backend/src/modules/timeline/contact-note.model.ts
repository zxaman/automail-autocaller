import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

/**
 * A free-text note recorded against a contact.
 *
 * Notes are the only timeline entry a user writes directly; calls, emails, and
 * imports are all byproducts of other actions. They exist so that the outcome
 * of a conversation can be captured while it is fresh.
 */
export interface ContactNoteAttributes {
  /** Owning workspace. Every query MUST be scoped by this field. */
  workspaceId: Types.ObjectId;
  ownerId: Types.ObjectId;
  contactId: Types.ObjectId;
  body: string;
  /** Set when the note was written as the follow-up to a specific call. */
  callId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ContactNoteDocument = HydratedDocument<ContactNoteAttributes>;

const contactNoteSchema = new Schema<ContactNoteAttributes>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', required: true },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    callId: { type: Schema.Types.ObjectId, ref: 'Call', default: null },
  },
  { timestamps: true, versionKey: false },
);

// The timeline reads notes for one contact, newest first.
contactNoteSchema.index({ workspaceId: 1, contactId: 1, createdAt: -1 });

export const ContactNoteModel: Model<ContactNoteAttributes> =
  model<ContactNoteAttributes>('ContactNote', contactNoteSchema);
