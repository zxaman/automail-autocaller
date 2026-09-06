import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { TelephonyCapabilities } from '../../infrastructure/telephony/telephony-provider';
import { CallService } from './call.service';

const workspaceId = new Types.ObjectId();
const ownerId = new Types.ObjectId();
const scope = { workspaceId };

const BRIDGE_CAPABILITIES: TelephonyCapabilities = {
  bridgedCalling: true,
  inAppVoice: false,
  mute: false,
  hold: false,
  dtmf: false,
  cancelWhileRinging: true,
  statusWebhooks: true,
};

function buildContact(overrides: Record<string, unknown> = {}) {
  const id = new Types.ObjectId();
  return { _id: id, id: id.toString(), name: 'Asha Patel', phone: '+919876543210', ...overrides };
}

function buildCall(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    workspaceId,
    contactId: new Types.ObjectId(),
    status: 'ringing',
    provider: 'exotel',
    providerCallId: 'prov-1',
    answeredAt: null,
    contactName: 'Asha Patel',
    phoneNumber: '+919876543210',
    direction: 'outbound',
    durationSeconds: 0,
    countryCode: '91',
    startedAt: new Date(),
    endedAt: null,
    failureReason: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('CallService', () => {
  let repository: Record<string, Mock>;
  let exotel: {
    name: string;
    capabilities: TelephonyCapabilities;
    placeCall: Mock;
    cancelCall: Mock;
    getCall: Mock;
    verifyWebhook: Mock;
  };
  let service: CallService;

  beforeEach(() => {
    repository = {
      findContactById: vi.fn().mockResolvedValue(buildContact()),
      create: vi.fn().mockImplementation((_s, _o, attrs) => Promise.resolve(buildCall(attrs))),
      findById: vi.fn().mockResolvedValue(null),
      findByProviderCallId: vi.fn().mockResolvedValue(null),
      applyStatus: vi.fn().mockResolvedValue(buildCall()),
      listPaged: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
      touchContactLastContacted: vi.fn().mockResolvedValue(undefined),
    };

    exotel = {
      name: 'exotel',
      capabilities: BRIDGE_CAPABILITIES,
      placeCall: vi.fn().mockResolvedValue({
        providerCallId: 'prov-1',
        status: 'queued',
        createdAt: new Date(),
      }),
      cancelCall: vi.fn().mockResolvedValue(undefined),
      getCall: vi.fn().mockResolvedValue(null),
      verifyWebhook: vi.fn(),
    };

    service = new CallService(repository as never, { exotel: exotel as never }, {
      resolve: () => '+911140000000',
    });
  });

  describe('startCall', () => {
    it('places a bridged call with the agent number first', async () => {
      const result = await service.startCall(scope, ownerId, {
        contactId: new Types.ObjectId().toString(),
        agentNumber: '+919812345678',
      });

      expect(exotel.placeCall).toHaveBeenCalledWith(
        expect.objectContaining({
          agentNumber: '+919812345678',
          customerNumber: '+919876543210',
        }),
      );
      expect(result.call.status).toBe('queued');
    });

    it('tells the user their own phone will ring', async () => {
      const result = await service.startCall(scope, ownerId, {
        contactId: new Types.ObjectId().toString(),
        agentNumber: '+919812345678',
      });

      expect(result.instruction).toContain('will ring first');
    });

    it('never offers controls the provider cannot perform', async () => {
      const result = await service.startCall(scope, ownerId, {
        contactId: new Types.ObjectId().toString(),
        agentNumber: '+919812345678',
      });

      // The agent is on their handset: these would be dead buttons.
      expect(result.controls.canMute).toBe(false);
      expect(result.controls.canHold).toBe(false);
      expect(result.controls.canSendDtmf).toBe(false);
      expect(result.controls.audioOnHandset).toBe(true);
    });

    it('rejects a contact in another workspace', async () => {
      repository['findContactById']!.mockResolvedValue(null);

      await expect(
        service.startCall(scope, ownerId, {
          contactId: new Types.ObjectId().toString(),
          agentNumber: '+919812345678',
        }),
      ).rejects.toMatchObject({ code: 'CONTACT_NOT_FOUND' });
    });

    it('rejects a contact with no usable phone number', async () => {
      repository['findContactById']!.mockResolvedValue(buildContact({ phone: null }));

      await expect(
        service.startCall(scope, ownerId, {
          contactId: new Types.ObjectId().toString(),
          agentNumber: '+919812345678',
        }),
      ).rejects.toMatchObject({ code: 'CONTACT_PHONE_INVALID' });
    });

    it('refuses to dial when no provider is licensed for the country', async () => {
      // Calling is domestic only, so an unsupported country has no route at all.
      const noProviders = new CallService(
        repository as never,
        {},
        { resolve: () => '+14155550000' },
      );

      await expect(
        noProviders.startCall(scope, ownerId, {
          contactId: new Types.ObjectId().toString(),
          agentNumber: '+919812345678',
        }),
      ).rejects.toMatchObject({ code: 'CALL_DESTINATION_UNSUPPORTED' });
    });

    it('does not create a call record when the provider rejects the request', async () => {
      exotel.placeCall.mockRejectedValue(new Error('provider down'));

      await expect(
        service.startCall(scope, ownerId, {
          contactId: new Types.ObjectId().toString(),
          agentNumber: '+919812345678',
        }),
      ).rejects.toBeTruthy();

      expect(repository['create']).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    const request = { rawBody: '{}', headers: {}, url: 'https://x/hook' };

    it('refuses an unverified webhook', async () => {
      exotel.verifyWebhook.mockReturnValue({ verified: false, reason: 'Signature mismatch' });

      await expect(service.handleWebhook('exotel', request)).rejects.toMatchObject({
        code: 'WEBHOOK_INVALID_SIGNATURE',
      });
    });

    it('does not reveal which providers are configured', async () => {
      await expect(service.handleWebhook('unknown-vendor', request)).rejects.toMatchObject({
        code: 'WEBHOOK_UNKNOWN_PROVIDER',
      });
    });

    it('applies a verified status change', async () => {
      repository['findByProviderCallId']!.mockResolvedValue(buildCall({ status: 'ringing' }));
      exotel.verifyWebhook.mockReturnValue({
        verified: true,
        event: {
          providerCallId: 'prov-1',
          reference: null,
          status: 'in_progress',
          leg: 'customer',
          durationSeconds: null,
          occurredAt: new Date(),
          rawStatus: 'in-progress',
        },
      });

      const result = await service.handleWebhook('exotel', request);

      expect(result.accepted).toBe(true);
      expect(repository['applyStatus']).toHaveBeenCalledWith(
        { workspaceId },
        expect.anything(),
        'in_progress',
        expect.objectContaining({ answeredAt: expect.any(Date) }),
      );
    });

    it('ignores a late event for a call that already finished', async () => {
      repository['findByProviderCallId']!.mockResolvedValue(buildCall({ status: 'completed' }));
      exotel.verifyWebhook.mockReturnValue({
        verified: true,
        event: {
          providerCallId: 'prov-1',
          reference: null,
          status: 'ringing',
          leg: null,
          durationSeconds: null,
          occurredAt: new Date(),
          rawStatus: 'ringing',
        },
      });

      const result = await service.handleWebhook('exotel', request);

      expect(result.accepted).toBe(false);
      expect(repository['applyStatus']).not.toHaveBeenCalled();
    });

    it('acknowledges an event for a call it does not know', async () => {
      repository['findByProviderCallId']!.mockResolvedValue(null);
      exotel.verifyWebhook.mockReturnValue({
        verified: true,
        event: {
          providerCallId: 'ghost',
          reference: null,
          status: 'completed',
          leg: null,
          durationSeconds: 10,
          occurredAt: new Date(),
          rawStatus: 'completed',
        },
      });

      // Acknowledged so the provider stops retrying, but nothing is invented.
      await expect(service.handleWebhook('exotel', request)).resolves.toMatchObject({
        accepted: false,
      });
      expect(repository['applyStatus']).not.toHaveBeenCalled();
    });

    it('records the duration and end time when a call completes', async () => {
      repository['findByProviderCallId']!.mockResolvedValue(buildCall({ status: 'in_progress' }));
      exotel.verifyWebhook.mockReturnValue({
        verified: true,
        event: {
          providerCallId: 'prov-1',
          reference: null,
          status: 'completed',
          leg: null,
          durationSeconds: 73,
          occurredAt: new Date(),
          rawStatus: 'completed',
        },
      });

      await service.handleWebhook('exotel', request);

      expect(repository['applyStatus']).toHaveBeenCalledWith(
        { workspaceId },
        expect.anything(),
        'completed',
        expect.objectContaining({ durationSeconds: 73, endedAt: expect.any(Date) }),
      );
    });

    it('marks the contact as contacted only when the call connected', async () => {
      repository['findByProviderCallId']!.mockResolvedValue(buildCall({ status: 'ringing' }));
      exotel.verifyWebhook.mockReturnValue({
        verified: true,
        event: {
          providerCallId: 'prov-1',
          reference: null,
          status: 'no_answer',
          leg: null,
          durationSeconds: 0,
          occurredAt: new Date(),
          rawStatus: 'no-answer',
        },
      });

      await service.handleWebhook('exotel', request);

      // An unanswered call is not a touchpoint.
      expect(repository['touchContactLastContacted']).not.toHaveBeenCalled();
    });
  });

  describe('cancelCall', () => {
    it('refuses to cancel a call that already ended', async () => {
      repository['findById']!.mockResolvedValue(buildCall({ status: 'completed' }));

      await expect(service.cancelCall(scope, 'id')).rejects.toMatchObject({
        code: 'CALL_ALREADY_ENDED',
      });
    });

    it('still records the cancellation when the provider rejects it', async () => {
      repository['findById']!.mockResolvedValue(buildCall({ status: 'ringing' }));
      exotel.cancelCall.mockRejectedValue(new Error('already gone'));

      await service.cancelCall(scope, 'id');

      expect(repository['applyStatus']).toHaveBeenCalledWith(
        { workspaceId },
        expect.anything(),
        'canceled',
        expect.objectContaining({ endedAt: expect.any(Date) }),
      );
    });
  });

  describe('capabilitiesFor', () => {
    it('reports handset audio for an Indian destination', () => {
      const result = service.capabilitiesFor('+919876543210');

      expect(result.provider).toBe('exotel');
      expect(result.controls.audioOnHandset).toBe(true);
    });
  });
});
