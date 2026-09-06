import { Types } from 'mongoose';

import { logger } from '../../infrastructure/logger/logger';
import { routeCall, type TelephonyProviderName } from '../../infrastructure/telephony/call-routing';
import {
  TelephonyError,
  isTerminalCallStatus,
  type CallEvent,
  type TelephonyProvider,
  type WebhookRequest,
} from '../../infrastructure/telephony/telephony-provider';
import { AppError } from '../../shared/errors/app-error';
import { normalizePhone } from '../../shared/utils/phone';
import { applyTransition, isAnsweredStatus } from './call-state-machine';
import { toCallControls, toCallDto } from './call.mapper';
import type { CallStatus } from './call.model';
import type { CallRepository, CallScope } from './call.repository';
import type { CallDto, CallListQuery, StartCallInput, StartCallResult } from './call.types';

/** Providers keyed by name, so routing can select one per destination. */
export type ProviderRegistry = Readonly<Partial<Record<TelephonyProviderName, TelephonyProvider>>>;

export interface CallerIdResolver {
  /** Virtual number to present for a destination country, or null if none. */
  resolve(countryCode: string): string | null;
}

const RING_TIMEOUT_SECONDS = 45;
const MAX_CALL_SECONDS = 3600;

/**
 * Outbound calling.
 *
 * The provider is chosen per call from the destination country, because the
 * lawful route differs by country. Nothing here ever falls back to `tel:` or
 * simulates a call: if no provider can lawfully reach the number, the request
 * fails with a clear reason.
 */
export class CallService {
  constructor(
    private readonly repository: CallRepository,
    private readonly providers: ProviderRegistry,
    private readonly callerIds: CallerIdResolver,
  ) {}

  private get availableProviders(): TelephonyProviderName[] {
    return Object.keys(this.providers) as TelephonyProviderName[];
  }

  public async startCall(
    scope: CallScope,
    ownerId: Types.ObjectId,
    input: StartCallInput,
  ): Promise<StartCallResult> {
    const contact = await this.repository.findContactById(scope, input.contactId);

    if (!contact) {
      throw new AppError('Contact not found', 404, 'CONTACT_NOT_FOUND');
    }

    const destination = normalizePhone(contact.phone);

    if (!destination) {
      throw new AppError(
        'This contact does not have a valid phone number',
        400,
        'CONTACT_PHONE_INVALID',
      );
    }

    const agent = normalizePhone(input.agentNumber);

    if (!agent) {
      throw new AppError(
        'Enter a valid phone number for the provider to reach you on',
        400,
        'AGENT_PHONE_INVALID',
      );
    }

    // Refuses rather than guessing when no lawful route exists.
    const route = this.route(destination.e164);
    const provider = this.providers[route.provider]!;
    const callerId = this.callerIds.resolve(route.countryCode);

    if (!callerId) {
      throw new AppError(
        'No caller ID is configured for this destination',
        409,
        'CALLER_ID_NOT_CONFIGURED',
      );
    }

    // The record exists before the provider is called, so a webhook that
    // arrives before the API response still has something to attach to.
    const reference = new Types.ObjectId().toString();

    let placed;
    try {
      placed = await provider.placeCall({
        agentNumber: agent.e164,
        customerNumber: destination.e164,
        callerId,
        reference,
        ringTimeoutSeconds: RING_TIMEOUT_SECONDS,
        maxDurationSeconds: MAX_CALL_SECONDS,
      });
    } catch (error) {
      throw this.toAppError(error);
    }

    const call = await this.repository.create(scope, ownerId, {
      contactId: contact._id as Types.ObjectId,
      contactName: contact.name,
      phoneNumber: destination.e164,
      agentNumber: agent.e164,
      callerId,
      countryCode: route.countryCode,
      provider: provider.name,
      providerCallId: placed.providerCallId,
      status: placed.status as CallStatus,
    });

    return {
      call: toCallDto(call),
      controls: toCallControls(provider.capabilities),
      instruction: provider.capabilities.inAppVoice
        ? 'Connecting audio in the app.'
        : `Your phone (${agent.e164}) will ring first. Answer it, and we will then connect ${contact.name}.`,
    };
  }

  /**
   * Handles a provider webhook.
   *
   * The signature is verified before the body is trusted, and the resulting
   * status is run through the state machine so a late or duplicate event
   * cannot rewrite a finished call.
   */
  public async handleWebhook(
    providerName: string,
    request: WebhookRequest,
  ): Promise<{ accepted: boolean; reason: string }> {
    const provider = this.providers[providerName as TelephonyProviderName];

    if (!provider) {
      // Do not reveal which providers are configured.
      throw new AppError('Unknown webhook endpoint', 404, 'WEBHOOK_UNKNOWN_PROVIDER');
    }

    const verification = provider.verifyWebhook(request);

    if (!verification.verified) {
      logger.warn(
        { provider: providerName, reason: verification.reason },
        'Rejected an unverified telephony webhook',
      );
      throw new AppError('The webhook could not be verified', 401, 'WEBHOOK_INVALID_SIGNATURE');
    }

    return this.applyEvent(verification.event);
  }

  private async applyEvent(event: CallEvent): Promise<{ accepted: boolean; reason: string }> {
    const call = await this.repository.findByProviderCallId(event.providerCallId);

    if (!call) {
      // A call we do not know about. Acknowledged so the provider stops
      // retrying, but nothing is created from an event alone.
      logger.warn({ providerCallId: event.providerCallId }, 'Webhook for an unknown call');
      return { accepted: false, reason: 'Unknown call' };
    }

    const transition = applyTransition(call.status, event.status as CallStatus);

    if (!transition.applied) {
      logger.info(
        { callId: String(call._id), reason: transition.reason },
        'Ignored a telephony webhook',
      );
      return { accepted: false, reason: transition.reason };
    }

    const changes: Parameters<CallRepository['applyStatus']>[2] = {};

    if (isAnsweredStatus(transition.status) && !call.answeredAt) {
      changes.answeredAt = event.occurredAt;
    }

    if (isTerminalCallStatus(transition.status)) {
      changes.endedAt = event.occurredAt;
      changes.durationSeconds = event.durationSeconds ?? 0;

      if (transition.status !== 'completed') {
        changes.failureCode = event.rawStatus;
        changes.failureReason = this.describeFailure(transition.status);
      }
    }

    await this.repository.applyStatus(call._id as Types.ObjectId, transition.status, changes);

    // A connected call is a real touchpoint; an unanswered one is not.
    if (isAnsweredStatus(transition.status) && call.contactId) {
      await this.repository.touchContactLastContacted(
        { workspaceId: call.workspaceId },
        call.contactId as Types.ObjectId,
        event.occurredAt,
      );
    }

    return { accepted: true, reason: transition.reason };
  }

  public async cancelCall(scope: CallScope, callId: string): Promise<CallDto> {
    const call = await this.repository.findById(scope, callId);

    if (!call) {
      throw new AppError('Call not found', 404, 'CALL_NOT_FOUND');
    }

    if (isTerminalCallStatus(call.status)) {
      throw new AppError('This call has already ended', 409, 'CALL_ALREADY_ENDED');
    }

    const provider = call.provider
      ? this.providers[call.provider as TelephonyProviderName]
      : undefined;

    if (provider && call.providerCallId) {
      try {
        await provider.cancelCall(call.providerCallId);
      } catch (error) {
        // The provider may already have ended it; record locally regardless.
        logger.warn(
          { callId, reason: error instanceof Error ? error.message : 'unknown' },
          'Provider rejected a cancel request',
        );
      }
    }

    const updated = await this.repository.applyStatus(call._id as Types.ObjectId, 'canceled', {
      endedAt: new Date(),
    });

    return toCallDto(updated ?? call);
  }

  /**
   * Reconciles a call whose webhook never arrived.
   *
   * Webhooks get lost. Without this, a call would sit in "ringing" forever and
   * the history would be wrong.
   */
  public async refreshCall(scope: CallScope, callId: string): Promise<CallDto> {
    const call = await this.repository.findById(scope, callId);

    if (!call) {
      throw new AppError('Call not found', 404, 'CALL_NOT_FOUND');
    }

    if (isTerminalCallStatus(call.status) || !call.providerCallId || !call.provider) {
      return toCallDto(call);
    }

    const provider = this.providers[call.provider as TelephonyProviderName];

    if (!provider) {
      return toCallDto(call);
    }

    const details = await provider.getCall(call.providerCallId);

    if (details) {
      await this.applyEvent(details);
    }

    const refreshed = await this.repository.findById(scope, callId);
    return toCallDto(refreshed ?? call);
  }

  public async getCall(scope: CallScope, callId: string): Promise<CallDto> {
    const call = await this.repository.findById(scope, callId);

    if (!call) {
      throw new AppError('Call not found', 404, 'CALL_NOT_FOUND');
    }

    return toCallDto(call);
  }

  public async listCalls(
    scope: CallScope,
    query: CallListQuery,
  ): Promise<{ items: CallDto[]; pagination: Record<string, number> }> {
    const { items, totalItems } = await this.repository.listPaged(scope, query);

    return {
      items: items.map(toCallDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
      },
    };
  }

  /** Capabilities for the UI, resolved for a specific destination. */
  public capabilitiesFor(destinationE164: string) {
    const route = this.route(destinationE164);
    const provider = this.providers[route.provider]!;

    return {
      provider: provider.name,
      countryCode: route.countryCode,
      controls: toCallControls(provider.capabilities),
    };
  }

  private route(destinationE164: string) {
    try {
      return routeCall(destinationE164, { availableProviders: this.availableProviders });
    } catch (error) {
      throw this.toAppError(error);
    }
  }

  private describeFailure(status: CallStatus): string {
    switch (status) {
      case 'no_answer':
        return 'Nobody answered the call';
      case 'busy':
        return 'The line was busy';
      case 'canceled':
        return 'The call was canceled';
      default:
        return 'The call could not be completed';
    }
  }

  private toAppError(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof TelephonyError) {
      const status = error.code === 'CALL_DESTINATION_UNSUPPORTED' ? 409 : error.retryable ? 503 : 400;
      return new AppError(error.message, status, error.code);
    }

    return new AppError('The call could not be placed', 502, 'CALL_FAILED');
  }
}
