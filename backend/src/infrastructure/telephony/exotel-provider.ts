import { createHmac, timingSafeEqual } from 'node:crypto';

import { logger } from '../logger/logger';
import {
  TelephonyError,
  type CallDetails,
  type CallEvent,
  type CallLeg,
  type CallStatus,
  type PlaceCallInput,
  type PlaceCallResult,
  type TelephonyCapabilities,
  type TelephonyProvider,
  type WebhookRequest,
  type WebhookVerification,
} from './telephony-provider';

export interface ExotelConfig {
  readonly accountSid: string;
  readonly apiKey: string;
  readonly apiToken: string;
  /** api.in.exotel.com (Mumbai) or api.exotel.com (Singapore). */
  readonly subdomain: string;
  readonly webhookSecret: string;
  readonly requestTimeoutMs?: number;
}

/**
 * Exotel adapter — PSTN-to-PSTN bridging.
 *
 * Exotel dials the agent first and the customer only once the agent answers,
 * then patches the legs. Voice never touches our infrastructure or the user's
 * browser, which is what makes this lawful for domestic Indian calling.
 *
 * Consequently the agent talks on their own handset, so mute, hold, DTMF, and
 * audio routing are not ours to offer. `capabilities` says so explicitly and
 * the UI reads it, rather than rendering buttons that would do nothing.
 */
export class ExotelProvider implements TelephonyProvider {
  public readonly name = 'exotel';

  public readonly capabilities: TelephonyCapabilities = {
    bridgedCalling: true,
    // Domestic VoIP-to-PSTN dial-out is prohibited in India.
    inAppVoice: false,
    // The conversation happens on the agent's handset; these belong to it.
    mute: false,
    hold: false,
    dtmf: false,
    cancelWhileRinging: true,
    statusWebhooks: true,
  };

  private readonly timeoutMs: number;

  constructor(private readonly config: ExotelConfig) {
    this.timeoutMs = config.requestTimeoutMs ?? 10_000;
  }

  public async placeCall(input: PlaceCallInput): Promise<PlaceCallResult> {
    const body = new URLSearchParams({
      From: input.agentNumber,
      To: input.customerNumber,
      CallerId: input.callerId,
      CustomField: input.reference,
      StatusCallbackContentType: 'application/json',
    });

    if (input.ringTimeoutSeconds !== undefined) {
      body.set('TimeLimit', String(input.maxDurationSeconds ?? 3600));
      body.set('TimeOut', String(input.ringTimeoutSeconds));
    }

    const payload = await this.request<ExotelCallResponse>(
      'POST',
      `/v1/Accounts/${this.config.accountSid}/Calls/connect.json`,
      body,
    );

    const call = payload.Call;

    if (!call?.Sid) {
      throw new TelephonyError(
        'The telephony provider did not return a call identifier',
        'CALL_PROVIDER_INVALID_RESPONSE',
        true,
      );
    }

    return {
      providerCallId: call.Sid,
      status: mapExotelStatus(call.Status),
      createdAt: new Date(),
    };
  }

  public async cancelCall(providerCallId: string): Promise<void> {
    // Exotel treats hangup as a status update to "completed".
    await this.request(
      'POST',
      `/v1/Accounts/${this.config.accountSid}/Calls/${providerCallId}.json`,
      new URLSearchParams({ Status: 'completed' }),
    );
  }

  public async getCall(providerCallId: string): Promise<CallDetails | null> {
    try {
      const payload = await this.request<ExotelCallResponse>(
        'GET',
        `/v1/Accounts/${this.config.accountSid}/Calls/${providerCallId}.json`,
      );

      const call = payload.Call;
      if (!call) {
        return null;
      }

      return {
        providerCallId: call.Sid,
        reference: call.CustomField ?? null,
        status: mapExotelStatus(call.Status),
        leg: null,
        durationSeconds: toDuration(call.ConversationDuration),
        occurredAt: new Date(),
        rawStatus: call.Status ?? null,
        from: call.From ?? null,
        to: call.To ?? null,
      };
    } catch (error) {
      if (error instanceof TelephonyError && error.code === 'CALL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Verifies a webhook before believing a word of it.
   *
   * Without this, anyone who learns the URL could mark calls completed or
   * inject fabricated durations. The signature covers the raw body, so the body
   * is parsed only after the HMAC matches.
   */
  public verifyWebhook(request: WebhookRequest): WebhookVerification {
    const provided = firstHeader(request.headers['x-exotel-signature']);

    if (!provided) {
      return { verified: false, reason: 'Missing signature header' };
    }

    const expected = createHmac('sha256', this.config.webhookSecret)
      .update(request.rawBody, 'utf8')
      .digest('hex');

    if (!safeEquals(provided, expected)) {
      logger.warn('Rejected a telephony webhook with an invalid signature');
      return { verified: false, reason: 'Signature mismatch' };
    }

    let parsed: ExotelWebhookBody;
    try {
      parsed = JSON.parse(request.rawBody) as ExotelWebhookBody;
    } catch {
      return { verified: false, reason: 'Body is not valid JSON' };
    }

    if (!parsed.CallSid) {
      return { verified: false, reason: 'Body is missing CallSid' };
    }

    return {
      verified: true,
      event: {
        providerCallId: parsed.CallSid,
        reference: parsed.CustomField ?? null,
        status: mapExotelStatus(parsed.Status),
        leg: mapLeg(parsed.Legs),
        durationSeconds: toDuration(parsed.ConversationDuration),
        occurredAt: parsed.DateUpdated ? new Date(parsed.DateUpdated) : new Date(),
        rawStatus: parsed.Status ?? null,
      },
    };
  }

  private async request<TResponse>(
    method: 'GET' | 'POST',
    path: string,
    body?: URLSearchParams,
  ): Promise<TResponse> {
    const url = `https://${this.config.subdomain}${path}`;
    const auth = Buffer.from(`${this.config.apiKey}:${this.config.apiToken}`).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          // Credentials go in the header, never in the URL, so they cannot end
          // up in access logs or error messages.
          Authorization: `Basic ${auth}`,
          ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        },
        ...(body ? { body: body.toString() } : {}),
      });

      if (!response.ok) {
        throw this.errorForStatus(response.status);
      }

      return (await response.json()) as TResponse;
    } catch (error) {
      if (error instanceof TelephonyError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new TelephonyError('The telephony provider timed out', 'CALL_PROVIDER_TIMEOUT', true);
      }

      throw new TelephonyError(
        'The telephony provider could not be reached',
        'CALL_PROVIDER_UNREACHABLE',
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Maps HTTP status to a domain error. Provider text is never echoed back. */
  private errorForStatus(status: number): TelephonyError {
    if (status === 401 || status === 403) {
      return new TelephonyError(
        'The telephony credentials were rejected',
        'CALL_PROVIDER_AUTH_FAILED',
        false,
      );
    }

    if (status === 404) {
      return new TelephonyError('The call was not found', 'CALL_NOT_FOUND', false);
    }

    if (status === 429) {
      return new TelephonyError(
        'The telephony provider is rate limiting requests',
        'CALL_PROVIDER_RATE_LIMITED',
        true,
      );
    }

    if (status >= 500) {
      return new TelephonyError(
        'The telephony provider is temporarily unavailable',
        'CALL_PROVIDER_UNAVAILABLE',
        true,
      );
    }

    return new TelephonyError('The call could not be placed', 'CALL_PROVIDER_REJECTED', false);
  }
}

interface ExotelCallResponse {
  Call?: {
    Sid: string;
    Status?: string;
    From?: string;
    To?: string;
    CustomField?: string;
    ConversationDuration?: number | string | null;
  };
}

interface ExotelWebhookBody {
  CallSid?: string;
  Status?: string;
  CustomField?: string;
  DateUpdated?: string;
  ConversationDuration?: number | string | null;
  Legs?: { Status?: string }[];
}

/** Exotel's vocabulary, mapped so the domain never learns a vendor's words. */
export function mapExotelStatus(status: string | undefined): CallStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'completed':
      return 'completed';
    case 'in-progress':
    case 'in_progress':
      return 'in_progress';
    case 'ringing':
      return 'ringing';
    case 'busy':
      return 'busy';
    case 'no-answer':
    case 'no_answer':
      return 'no_answer';
    case 'canceled':
    case 'cancelled':
      return 'canceled';
    case 'failed':
      return 'failed';
    case 'queued':
      return 'queued';
    case 'initiated':
      return 'initiated';
    default:
      // An unrecognized status must not silently become "completed".
      return 'initiated';
  }
}

function mapLeg(legs: { Status?: string }[] | undefined): CallLeg | null {
  if (!legs || legs.length === 0) {
    return null;
  }
  // Leg 1 is the agent, leg 2 the customer.
  return legs.length === 1 ? 'agent' : 'customer';
}

function toDuration(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function firstHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

/** Constant-time compare so a signature cannot be guessed by timing. */
function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
