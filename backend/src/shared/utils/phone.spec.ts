import { describe, expect, it } from 'vitest';

import { isValidPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('keeps an existing E.164 value', () => {
    expect(normalizePhone('+919876543210')?.e164).toBe('+919876543210');
  });

  it('strips formatting characters', () => {
    expect(normalizePhone('+91 98765-43210')?.e164).toBe('+919876543210');
    expect(normalizePhone('(987) 654-3210')?.e164).toBe('+919876543210');
  });

  it('adds the default country code to a local number', () => {
    expect(normalizePhone('9876543210')?.e164).toBe('+919876543210');
  });

  it('removes a trunk zero before adding the country code', () => {
    expect(normalizePhone('09876543210')?.e164).toBe('+919876543210');
  });

  it('handles the 00 international prefix', () => {
    expect(normalizePhone('00919876543210')?.e164).toBe('+919876543210');
  });

  it('does not double the country code', () => {
    expect(normalizePhone('919876543210')?.e164).toBe('+919876543210');
  });

  it('normalizes differently formatted inputs to the same value', () => {
    const variants = ['+91 98765 43210', '09876543210', '9876543210', '+919876543210'];
    const results = variants.map((value) => normalizePhone(value)?.e164);
    expect(new Set(results).size).toBe(1);
  });

  it('rejects values that are too short, too long, or empty', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('1'.repeat(16))).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
  });

  it('reports validity', () => {
    expect(isValidPhone('+919876543210')).toBe(true);
    expect(isValidPhone('abc')).toBe(false);
  });
});
