import type { CallStatus } from './call.model';

export interface CallDto {
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
 * What the client may do during a call, derived from the provider's declared
 * capabilities. The UI renders controls from this instead of assuming.
 */
export interface CallControls {
  readonly canCancel: boolean;
  readonly canMute: boolean;
  readonly canHold: boolean;
  readonly canSendDtmf: boolean;
  /**
   * True when the conversation happens on the agent's own handset rather than
   * in the app, so the UI can say so plainly.
   */
  readonly audioOnHandset: boolean;
}

export interface StartCallInput {
  readonly contactId: string;
  /** Agent's phone number. The provider rings this first. */
  readonly agentNumber: string;
}

export interface StartCallResult {
  readonly call: CallDto;
  readonly controls: CallControls;
  /** Plain-language explanation of what is about to happen on the phone. */
  readonly instruction: string;
}

export interface CallListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: CallStatus;
  readonly contactId?: string;
}
