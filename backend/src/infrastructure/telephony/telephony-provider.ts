/**
 * Telephony provider contract.
 *
 * The domain codes against this interface, never against a vendor SDK, because
 * the lawful calling model differs by country: India requires PSTN-to-PSTN
 * bridging through a licensed operator, while a WebRTC softphone is normal
 * elsewhere. Both must fit behind one contract.
 *
 * See telephony-evaluation.md for why bridging is the India-domestic model.
 *
 * Call recording is deliberately absent. It was dropped from the product, which
 * removes the DPDP consent-logging, retention, and secure-playback obligations
 * entirely rather than leaving them half-implemented.
 */

/**
 * Normalized call status. Provider vocabularies ("no-answer", "terminal",
 * "failed-to-create") are mapped at the adapter edge so nothing downstream
 * learns a vendor's words.
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

/** Statuses after which no further transition can occur. */
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

/**
 * Which party a status refers to.
 *
 * Two legs are modelled explicitly because the agent leg can answer while the
 * customer leg fails — the single most common real-world outcome, and one a
 * single-"call" model silently hides.
 */
export type CallLeg = 'agent' | 'customer';

/**
 * What a provider can actually do.
 *
 * The UI reads this to decide which controls to render. A control the provider
 * cannot perform must not appear: a dead mute button is fake calling UI.
 * In the PSTN-bridge model the agent talks on their own handset, so mute,
 * hold, DTMF, and audio routing belong to the handset and are all false.
 */
export interface TelephonyCapabilities {
  /** Provider dials both parties and bridges them (agent's handset rings). */
  readonly bridgedCalling: boolean;
  /** In-app voice via a client SDK (WebRTC). Unlawful for India domestic. */
  readonly inAppVoice: boolean;
  readonly mute: boolean;
  readonly hold: boolean;
  readonly dtmf: boolean;
  /** Call can be cancelled through the API, typically only while ringing. */
  readonly cancelWhileRinging: boolean;
  /** Provider posts call lifecycle events to a webhook. */
  readonly statusWebhooks: boolean;
}

export interface PlaceCallInput {
  /** Agent's own phone number in E.164. This handset rings first. */
  readonly agentNumber: string;
  /** Contact's number in E.164. Dialled only once the agent leg answers. */
  readonly customerNumber: string;
  /** Virtual number shown as caller ID. Must belong to the provider account. */
  readonly callerId: string;
  /** Correlates provider events back to our call record. */
  readonly reference: string;
  /** Seconds to ring before giving up. */
  readonly ringTimeoutSeconds?: number;
  /** Hard cap on conversation length, as a cost guard. */
  readonly maxDurationSeconds?: number;
}

export interface PlaceCallResult {
  /** Provider's identifier. Stored so webhooks can be matched to a record. */
  readonly providerCallId: string;
  readonly status: CallStatus;
  readonly createdAt: Date;
}

/** A provider event, already normalized and verified. */
export interface CallEvent {
  readonly providerCallId: string;
  readonly reference: string | null;
  readonly status: CallStatus;
  readonly leg: CallLeg | null;
  /** Conversation seconds, present only once the call is terminal. */
  readonly durationSeconds: number | null;
  readonly occurredAt: Date;
  /** Vendor's own status text, kept only for diagnostics. */
  readonly rawStatus: string | null;
}

export interface CallDetails extends CallEvent {
  readonly from: string | null;
  readonly to: string | null;
}

/**
 * Result of checking a webhook's authenticity.
 *
 * An unverified webhook endpoint lets anyone forge call outcomes — marking
 * calls completed or injecting false durations. Verification is therefore part of
 * the interface rather than left to each adapter's discretion.
 */
export type WebhookVerification =
  | { readonly verified: true; readonly event: CallEvent }
  | { readonly verified: false; readonly reason: string };

export interface WebhookRequest {
  readonly rawBody: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  /** Full URL the provider posted to; some signature schemes include it. */
  readonly url: string;
}

export interface TelephonyProvider {
  readonly name: string;
  readonly capabilities: TelephonyCapabilities;

  /**
   * Starts a call. Returning successfully means the provider accepted the
   * request — not that anyone answered. Answer state arrives via webhook.
   */
  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;

  /**
   * Cancels a call in progress. Most providers only honour this while the call
   * is still ringing; `capabilities.cancelWhileRinging` says whether it is
   * meaningful at all.
   */
  cancelCall(providerCallId: string): Promise<void>;

  /** Authoritative state, for reconciling calls whose webhook never arrived. */
  getCall(providerCallId: string): Promise<CallDetails | null>;

  /** Verifies a webhook's signature and normalizes it. Never trusts the body. */
  verifyWebhook(request: WebhookRequest): WebhookVerification;
}

/** Thrown when a provider rejects a request. Never carries credentials. */
export class TelephonyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'TelephonyError';
  }
}
