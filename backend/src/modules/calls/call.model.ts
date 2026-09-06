import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const CALL_DIRECTIONS = ['inbound', 'outbound'] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

export const CALL_STATUSES = [
  'initiating',
  'ringing',
  'connected',
  'on-hold',
  'completed',
  'missed',
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
  recordingId: Types.ObjectId | null;
  startedAt: Date;
  endedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CallDocument = HydratedDocument<CallAttributes>;

/**
 * Call records. The schema is introduced here because the dashboard aggregates
 * over it; call creation and provider integration arrive in the calling phase.
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
    recordingId: { type: Schema.Types.ObjectId, ref: 'CallRecording', default: null },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    failureReason: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true, versionKey: false },
);

// Dashboard and history both read by workspace ordered on time.
callSchema.index({ workspaceId: 1, startedAt: -1 });
callSchema.index({ workspaceId: 1, status: 1, startedAt: -1 });
callSchema.index({ workspaceId: 1, contactId: 1, startedAt: -1 });

export const CallModel: Model<CallAttributes> = model<CallAttributes>('Call', callSchema);
