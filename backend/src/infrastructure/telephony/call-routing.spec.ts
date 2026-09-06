import { describe, expect, it } from 'vitest';

import { extractCountryCode, routeCall } from './call-routing';

const configured = { availableProviders: ['exotel'] as const };

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
    const decision = routeCall('+919876543210', configured);

    expect(decision.provider).toBe('exotel');
    expect(decision.transport).toBe('pstn_bridge');
  });

  it('refuses a US number, because we do not call across borders', () => {
    // Calling is domestic only: an Indian agent does not dial a US contact.
    expect(() => routeCall('+14155552671', configured)).toThrow(
      /not available on this workspace/,
    );
  });

  it('refuses a UK number for the same reason', () => {
    expect(() => routeCall('+447700900123', configured)).toThrow(
      /not available on this workspace/,
    );
  });

  it('never carries an Indian call over in-app voice', () => {
    // Domestic VoIP-to-PSTN dial-out is prohibited in India.
    expect(routeCall('+919876543210', configured).transport).not.toBe('in_app_voice');
  });

  it('refuses an Indian call when the licensed provider is not configured', () => {
    expect(() => routeCall('+919876543210', { availableProviders: [] })).toThrow(
      /not available on this workspace/,
    );
  });

  it('does not silently substitute a provider that cannot lawfully complete the call', () => {
    try {
      routeCall('+919876543210', { availableProviders: [] });
      expect.unreachable('should have refused');
    } catch (error) {
      expect((error as { code: string }).code).toBe('CALL_DESTINATION_UNSUPPORTED');
    }
  });

  it('never routes a foreign destination to the India operator', () => {
    // The old cross-border fallback is gone: an Indian licence does not
    // authorise dialling a US number, and we do not offer cross-border calls.
    expect(() =>
      routeCall('+14155552671', { availableProviders: ['exotel'] }),
    ).toThrow(/not available on this workspace/);
  });

  it('rejects an unparseable destination', () => {
    expect(() => routeCall('+12', configured)).toThrow(/not a valid international number/);
  });

  it('fails clearly when no provider is configured at all', () => {
    expect(() => routeCall('+919876543210', { availableProviders: [] })).toThrow(
      /not available on this workspace/,
    );
  });

  it('explains why a route was chosen', () => {
    expect(routeCall('+919876543210', configured).reason).toContain('exotel');
  });
});
