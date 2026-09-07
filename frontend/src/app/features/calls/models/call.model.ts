export type CallStatus =
  | 'queued'
  | 'initiated'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'no_answer'
  | 'busy'
  | 'failed'
  | 'canceled';

/** Statuses after which nothing further happens. */
export const TERMINAL_CALL_STATUSES: readonly CallStatus[] = [
  'completed',
  'no_answer',
  'busy',
  'failed',
  'canceled',
];

export function isTerminalCallStatus(status: CallStatus): boolean {
  return TERMINAL_CALL_STATUSES.includes(status);
}

export interface CallRecord {
  readonly id: string;
  readonly contactId: string | null;
  readonly contactName: string;
  readonly phoneNumber: string;
  readonly direction: 'inbound' | 'outbound';
  readonly status: CallStatus;
  readonly durationSeconds: number;
  readonly provider: string | null;
  readonly countryCode: string | null;
  readonly startedAt: string;
  readonly answeredAt: string | null;
  readonly endedAt: string | null;
  readonly failureReason: string | null;
  readonly createdAt: string;
}

/**
 * What the UI may offer, as reported by the server for the chosen provider.
 *
 * These are not assumptions: a control is rendered only when the provider can
 * genuinely perform it. In the PSTN-bridge model used for India the agent
 * speaks on their own handset, so mute/hold/DTMF are all false.
 */
export interface CallControls {
  readonly canCancel: boolean;
  readonly canMute: boolean;
  readonly canHold: boolean;
  readonly canSendDtmf: boolean;
  readonly audioOnHandset: boolean;
}

export interface StartCallResult {
  readonly call: CallRecord;
  readonly controls: CallControls;
  readonly instruction: string;
}

/** Human-readable status text. Colour alone never conveys the state. */
export const CALL_STATUS_LABELS: Readonly<Record<CallStatus, string>> = {
  queued: 'Queued',
  initiated: 'Starting',
  ringing: 'Ringing',
  in_progress: 'In progress',
  completed: 'Completed',
  no_answer: 'No answer',
  busy: 'Busy',
  failed: 'Failed',
  canceled: 'Canceled',
};
