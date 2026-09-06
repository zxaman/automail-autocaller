import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { ExotelProvider, mapExotelStatus } from './exotel-provider';

const SECRET = 'test-webhook-secret';

const provider = new ExotelProvider({
  accountSid: 'sid',
  apiKey: 'key',
  apiToken: 'token',
  subdomain: 'api.in.exotel.com',
  webhookSecret: SECRET,
});

function sign(body: string): string {
  return createHmac('sha256', SECRET).update(body, 'utf8').digest('hex');
}

function request(body: string, signature?: string) {
  return {
    rawBody: body,
    headers: { 'x-exotel-signature': signature ?? sign(body) },
    url: 'https://app.example.com/api/v1/webhooks/telephony/exotel',
  };
}

describe('ExotelProvider capabilities', () => {
  it('declares that audio is not carried in the app', () => {
    // Domestic VoIP-to-PSTN dial-out is prohibited in India.
    expect(provider.capabilities.inAppVoice).toBe(false);
    expect(provider.capabilities.bridgedCalling).toBe(true);
  });

  it('does not claim controls that belong to the agent handset', () => {
    expect(provider.capabilities.mute).toBe(false);
    expect(provider.capabilities.hold).toBe(false);
    expect(provider.capabilities.dtmf).toBe(false);
  });
});

describe('ExotelProvider.verifyWebhook', () => {
  const body = JSON.stringify({
    CallSid: 'abc123',
    Status: 'completed',
    ConversationDuration: 42,
    CustomField: 'ref-1',
  });

  it('accepts a correctly signed webhook', () => {
    const result = provider.verifyWebhook(request(body));

    expect(result.verified).toBe(true);
    if (result.verified) {
      expect(result.event.providerCallId).toBe('abc123');
      expect(result.event.status).toBe('completed');
      expect(result.event.durationSeconds).toBe(42);
    }
  });

  it('rejects a webhook with no signature', () => {
    const result = provider.verifyWebhook({
      rawBody: body,
      headers: {},
      url: 'https://app.example.com/hook',
    });

    expect(result.verified).toBe(false);
  });

  it('rejects a forged signature', () => {
    const result = provider.verifyWebhook(request(body, 'deadbeef'));
    expect(result.verified).toBe(false);
  });

  it('rejects a body that was tampered with after signing', () => {
    const signature = sign(body);
    const tampered = JSON.stringify({ CallSid: 'abc123', Status: 'completed', ConversationDuration: 9999 });

    expect(provider.verifyWebhook(request(tampered, signature)).verified).toBe(false);
  });

  it('rejects a signature for a different secret', () => {
    const wrong = createHmac('sha256', 'other-secret').update(body).digest('hex');
    expect(provider.verifyWebhook(request(body, wrong)).verified).toBe(false);
  });

  it('rejects a signed body that is not JSON', () => {
    expect(provider.verifyWebhook(request('not json')).verified).toBe(false);
  });

  it('rejects a signed body with no call identifier', () => {
    const noSid = JSON.stringify({ Status: 'completed' });
    expect(provider.verifyWebhook(request(noSid)).verified).toBe(false);
  });
});

describe('mapExotelStatus', () => {
  it('maps the provider vocabulary onto our own', () => {
    expect(mapExotelStatus('no-answer')).toBe('no_answer');
    expect(mapExotelStatus('in-progress')).toBe('in_progress');
    expect(mapExotelStatus('busy')).toBe('busy');
    expect(mapExotelStatus('completed')).toBe('completed');
  });

  it('never treats an unknown status as a completed call', () => {
    // Guessing "completed" would fabricate a conversation that never happened.
    expect(mapExotelStatus('something-new')).toBe('initiated');
    expect(mapExotelStatus(undefined)).toBe('initiated');
  });
});
