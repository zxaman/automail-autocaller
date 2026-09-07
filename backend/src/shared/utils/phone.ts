/**
 * Phone normalization for duplicate detection and dialing.
 *
 * A deliberately small, dependency-free normalizer: it produces a stable E.164
 * value for the common cases (already-E.164 input, local numbers in the default
 * country) and returns null when the input cannot be trusted. Full carrier-grade
 * parsing is deferred to `libphonenumber-js` in the telephony phase, where real
 * dialing correctness actually matters.
 */

const DEFAULT_COUNTRY_CODE = '91'; // India, the primary launch geography.
const NATIONAL_LENGTHS: Readonly<Record<string, number>> = { '91': 10, '1': 10, '44': 10 };

export interface NormalizedPhone {
  /** E.164 value, e.g. +919876543210. */
  e164: string;
  /** Digits only, without the plus. */
  digits: string;
}

export function normalizePhone(
  input: string | null | undefined,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE,
): NormalizedPhone | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return null;
  }

  if (hasPlus) {
    return { e164: `+${digits}`, digits };
  }

  // 00 is the international prefix used across much of the world.
  if (digits.startsWith('00') && digits.length > 9) {
    const withoutPrefix = digits.slice(2);
    return { e164: `+${withoutPrefix}`, digits: withoutPrefix };
  }

  const nationalLength = NATIONAL_LENGTHS[defaultCountryCode];

  // Already carries the country code without a plus.
  if (digits.startsWith(defaultCountryCode) && nationalLength !== undefined) {
    const remainder = digits.length - defaultCountryCode.length;
    if (remainder === nationalLength) {
      return { e164: `+${digits}`, digits };
    }
  }

  // A local number: prefix the default country code.
  if (nationalLength !== undefined && digits.length === nationalLength) {
    const full = `${defaultCountryCode}${digits}`;
    return { e164: `+${full}`, digits: full };
  }

  // Trailing national number with a leading trunk zero, e.g. 09876543210.
  if (nationalLength !== undefined && digits.length === nationalLength + 1 && digits.startsWith('0')) {
    const full = `${defaultCountryCode}${digits.slice(1)}`;
    return { e164: `+${full}`, digits: full };
  }

  return { e164: `+${digits}`, digits };
}

/** True when the value can be normalized to a dialable number. */
export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}
