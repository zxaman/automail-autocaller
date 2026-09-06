import { describe, expect, it } from 'vitest';

import { extractCountryCode, routeCall } from './call-routing';

const both = { availableProviders: ['exotel', 'twilio'] as const };

describe('extractCountryCode', () => {
  it('reads a single-digit country code', () => {
    expect(extractCountryCode('+14155552671')).toBe('1');
  });

  it('reads a two-digit country code', () => {
    expect(extractCountryCode('+919876543210')).toBe('91');
  });

  it('reads a three-digit country code', () => {
    expect(extractCountryCode('+971501234567')).toBe('971');
  });

  it('prefers the longer code when one is a prefix of another', () => {
    // +880 is Bangladesh; a naive match would read it as +88.
    expect(extractCountryCode('+8801712345678')).toBe('880');
  });

  it('rejects a number too short to be dialable', () => {
    expect(extractCountryCode('+12345')).toBeNull();
  });
});

describe('routeCall', () => {
  it('routes an Indian number to the licensed bridging provider', () => {
    const decision = routeCall('+919876543210', both);

    expect(decision.provider).toBe('exotel');
    expect(decision.transport).toBe('pstn_bridge');
  });

  it('routes a US number to the general provider', () => {
    expect(routeCall('+14155552671', both).provider).toBe('twilio');
  });

  it('routes a UK number to the general provider', () => {
    expect(routeCall('+447700900123', both).provider).toBe('twilio');
  });

  it('never carries an Indian call over in-app voice', () => {
    // Domestic VoIP-to-PSTN dial-out is prohibited in India.
    expect(routeCall('+919876543210', both).transport).not.toBe('in_app_voice');
  });

  it('refuses an Indian call when the licensed provider is not configured', () => {
    expect(() =>
      routeCall('+919876543210', { availableProviders: ['twilio'] }),
    ).toThrow(/not available on this workspace/);
  });

  it('does not silently substitute a provider that cannot lawfully complete the call', () => {
    try {
      routeCall('+919876543210', { availableProviders: ['twilio'] });
      expect.unreachable('should have refused');
    } catch (error) {
      expect((error as { code: string }).code).toBe('CALL_DESTINATION_UNSUPPORTED');
    }
  });

  it('falls back to exotel for international when twilio is absent', () => {
    expect(routeCall('+14155552671', { availableProviders: ['exotel'] }).provider).toBe('exotel');
  });

  it('rejects an unparseable destination', () => {
    expect(() => routeCall('+12', both)).toThrow(/not a valid international number/);
  });

  it('fails clearly when no provider is configured', () => {
    expect(() => routeCall('+14155552671', { availableProviders: [] })).toThrow(
      /No telephony provider is configured/,
    );
  });

  it('explains why a route was chosen', () => {
    expect(routeCall('+919876543210', both).reason).toContain('restricted');
  });
});
