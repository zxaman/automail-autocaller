import type { Types } from 'mongoose';

import type { TelephonyCapabilities } from '../../infrastructure/telephony/telephony-provider';
import type { CallDocument } from './call.model';
import type { CallControls, CallDto } from './call.types';

const toIso = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

export function toCallDto(call: CallDocument): CallDto {
  return {
    id: String(call._id),
    contactId: call.contactId ? String(call.contactId as Types.ObjectId) : null,
    contactName: call.contactName,
    phoneNumber: call.phoneNumber,
    direction: call.direction,
    status: call.status,
    durationSeconds: call.durationSeconds,
    provider: call.provider,
    countryCode: call.countryCode,
    startedAt: call.startedAt.toISOString(),
    answeredAt: toIso(call.answeredAt),
    endedAt: toIso(call.endedAt),
    failureReason: call.failureReason,
    createdAt: call.createdAt.toISOString(),
  };
}

/**
 * Translates provider capabilities into what the UI may show.
 *
 * A control is offered only when the provider can genuinely perform it. In the
 * PSTN-bridge model that means mute, hold, and DTMF are all false, because the
 * agent is talking on their handset — showing those buttons would be a lie.
 */
export function toCallControls(capabilities: TelephonyCapabilities): CallControls {
  return {
    canCancel: capabilities.cancelWhileRinging,
    canMute: capabilities.mute,
    canHold: capabilities.hold,
    canSendDtmf: capabilities.dtmf,
    audioOnHandset: capabilities.bridgedCalling && !capabilities.inAppVoice,
  };
}
