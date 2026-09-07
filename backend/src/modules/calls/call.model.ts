import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const CALL_DIRECTIONS = ['inbound', 'outbound'] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

/**
 * Mirrors the provider-neutral status set in `telephony-provider.ts`. There is
 * no "on-hold": in the PSTN-bridge model the agent is on their own handset, so
 * hold is not a state this application can observe or control.
 */
export const CALL_STATUSES = [
  'queued',
  'initiated',
  'ringing',
  'in_progress',
  'completed',
  'no_answer',
  'busy',
  'failed',
  'canceled',
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

/** Statuses that represent a successfully connected conversation. */
export const SUCCESSFUL_CALL_STATUSES: readonly CallStatus[] = ['completed'];

export interface CallAttributes {
  workspaceId: Types.ObjectId;
  ownerId: Types.ObjectId;
  contactId: Types.ObjectId | null;
  /** Denormalized so history renders without a join when a contact is deleted. */
  contactName: string;
  phoneNumber: string;
  direction: CallDirection;
  status: CallStatus;
  durationSeconds: number;
  /** Identifier issued by the telephony provider, set in the calling phase. */
  providerCallId: string | null;
  provider: string | null;
  /** Number the agent was reached on. Stored for support and audit. */
  agentNumber: string | null;
  /** Virtual number shown to the contact as caller ID. */
  callerId: string | null;
  /** Destination country code, so analytics can split by geography. */
  countryCode: string | null;
  startedAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  failureReason: string | null;
  failureCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CallDocument = HydratedDocument<CallAttributes>;

/**
 * Call records.
 *
 * There is no recording reference: call recording was dropped from the product,
 * which removes the consent-logging and retention obligations it would carry.
 */
const callSchema = new Schema<CallAttributes>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', default: null },
    contactName: { type: String, required: true, trim: true, maxlength: 160 },
    phoneNumber: { type: String, required: true, trim: true, maxlength: 32 },
    direction: { type: String, enum: CALL_DIRECTIONS, required: true },
    status: { type: String, enum: CALL_STATUSES, required: true },
    durationSeconds: { type: Number, default: 0, min: 0 },
    providerCallId: { type: String, default: null },
    provider: { type: String, default: null },
    agentNumber: { type: String, default: null, trim: true, maxlength: 32 },
    callerId: { type: String, default: null, trim: true, maxlength: 32 },
    countryCode: { type: String, default: null, trim: true, maxlength: 4 },
    startedAt: { type: Date, required: true },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    failureReason: { type: String, default: null, maxlength: 500 },
    failureCode: { type: String, default: null, maxlength: 80 },
  },
  { timestamps: true, versionKey: false },
);

// Dashboard and history both read by workspace ordered on time.
callSchema.index({ workspaceId: 1, startedAt: -1 });
callSchema.index({ workspaceId: 1, status: 1, startedAt: -1 });
callSchema.index({ workspaceId: 1, contactId: 1, startedAt: -1 });
// Webhooks are matched on this; unique so a replay cannot fork a second record.
callSchema.index(
  { providerCallId: 1 },
  { unique: true, partialFilterExpression: { providerCallId: { $type: 'string' } } },
);

export const CallModel: Model<CallAttributes> = model<CallAttributes>('Call', callSchema);
