import { describe, expect, it } from 'vitest';

import { MINIMUM_MONGODB_VERSION, isVersionAtLeast } from './server-version';

describe('isVersionAtLeast', () => {
  it('accepts the exact minimum', () => {
    expect(isVersionAtLeast('4.4.0', MINIMUM_MONGODB_VERSION)).toBe(true);
  });

  it('accepts a newer major version', () => {
    expect(isVersionAtLeast('7.0.2', MINIMUM_MONGODB_VERSION)).toBe(true);
  });

  it('rejects an older version that lacks $unionWith', () => {
    expect(isVersionAtLeast('4.2.9', MINIMUM_MONGODB_VERSION)).toBe(false);
  });

  it('compares numerically rather than lexically', () => {
    // A string comparison would wrongly rank 4.10 below 4.9.
    expect(isVersionAtLeast('4.10.0', '4.9.0')).toBe(true);
  });

  it('treats a missing patch segment as zero', () => {
    expect(isVersionAtLeast('4.4', '4.4.0')).toBe(true);
    expect(isVersionAtLeast('4.3', '4.4.0')).toBe(false);
  });

  it('does not crash on a malformed version', () => {
    expect(isVersionAtLeast('not-a-version', MINIMUM_MONGODB_VERSION)).toBe(false);
  });
});
