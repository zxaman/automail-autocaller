import { TelephonyError } from './telephony-provider';

/**
 * Destination-based provider routing.
 *
 * Calling is DOMESTIC ONLY: the agent and the contact are in the same country.
 * We never place cross-border calls, so no international CPaaS is involved.
 * Each supported country is served by an operator licensed in that country,
 * which is also the only lawful way to reach the PSTN somewhere like India
 * where domestic VoIP-to-PSTN dial-out is prohibited.
 *
 * The provider is resolved per call from the destination country, and an
 * unsupported country is refused rather than routed across a border.
 *
 * See telephony-evaluation.md.
 */

export const TELEPHONY_PROVIDER_NAMES = ['exotel'] as const;
export type TelephonyProviderName = (typeof TELEPHONY_PROVIDER_NAMES)[number];

/** How the voice path is carried, which decides what the UI may offer. */
export type CallTransport = 'pstn_bridge' | 'in_app_voice';

export interface RouteDecision {
  readonly provider: TelephonyProviderName;
  readonly transport: CallTransport;
  readonly countryCode: string;
  /** Why this route was chosen. Surfaced in diagnostics, never to end users. */
  readonly reason: string;
}

/**
 * Country dialing codes, longest first so that a longer code is matched before
 * a shorter one that is its prefix (e.g. +1868 Trinidad before +1 US).
 */
const COUNTRY_DIAL_CODES: readonly string[] = [
  // 3-digit
  '971', '972', '966', '965', '968', '974', '973', '880', '977', '994', '998',
  '212', '213', '216', '218', '220', '221', '234', '254', '255', '256', '260',
  '263', '264', '265', '266', '267', '268', '269', '351', '352', '353', '354',
  '355', '356', '357', '358', '359', '370', '371', '372', '373', '374', '375',
  '376', '377', '378', '380', '381', '382', '383', '385', '386', '387', '389',
  '420', '421', '423', '501', '502', '503', '504', '505', '506', '507', '509',
  '590', '591', '592', '593', '595', '598', '673', '674', '675', '676', '677',
  '679', '680', '685', '852', '853', '855', '856', '870', '960', '961', '962',
  '963', '964', '967', '970', '975', '976', '992', '993', '995', '996',
  // 2-digit
  '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44',
  '45', '46', '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58',
  '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91',
  '92', '93', '94', '95', '98',
  // 1-digit
  '1', '7',
];

const SORTED_DIAL_CODES = [...COUNTRY_DIAL_CODES].sort((a, b) => b.length - a.length);

/**
 * Country dialing code -> the operator licensed to place domestic calls there.
 *
 * A country absent from this map is not callable. That is deliberate: telecom
 * licensing is per-country, so serving a new country means onboarding an
 * operator there, never reusing an existing one across a border.
 */
const DOMESTIC_PROVIDERS: Readonly<Record<string, TelephonyProviderName>> = {
  '91': 'exotel',
};

/** Extracts the country dialing code from an E.164 number. */
export function extractCountryCode(e164: string): string | null {
  const digits = e164.replace(/\D/g, '');

  if (digits.length < 7) {
    return null;
  }

  return SORTED_DIAL_CODES.find((code) => digits.startsWith(code)) ?? null;
}

export interface RoutingOptions {
  /** Providers actually configured with credentials on this deployment. */
  readonly availableProviders: readonly TelephonyProviderName[];
}

/**
 * Chooses how to place a domestic call to the given number.
 *
 * Refusing is a valid outcome, and the expected one for an unsupported
 * country. There is no cross-border fallback.
 */
export function routeCall(destinationE164: string, options: RoutingOptions): RouteDecision {
  const countryCode = extractCountryCode(destinationE164);

  if (!countryCode) {
    throw new TelephonyError(
      'The destination number is not a valid international number',
      'CALL_DESTINATION_INVALID',
      false,
    );
  }

  const provider = DOMESTIC_PROVIDERS[countryCode];

  // An unsupported country is refused. There is no cross-border fallback.
  if (!provider || !options.availableProviders.includes(provider)) {
    throw new TelephonyError(
      'Calling this country is not available on this workspace yet',
      'CALL_DESTINATION_UNSUPPORTED',
      false,
    );
  }

  return {
    provider,
    transport: 'pstn_bridge',
    countryCode,
    reason: `Domestic call to +${countryCode} bridged via ${provider}`,
  };
}
