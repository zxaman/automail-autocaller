import { TelephonyError } from './telephony-provider';

/**
 * Destination-based provider routing.
 *
 * The provider is not a global setting: it is resolved per call from the
 * destination country, because the lawful way to reach a number differs by
 * country. An Indian number must go through a UL-VNO licensed operator using
 * PSTN bridging; a US number can use a general CPaaS. Picking one provider
 * globally would either break India compliance or give up the rest of the world.
 *
 * See telephony-evaluation.md.
 */

export const TELEPHONY_PROVIDER_NAMES = ['exotel', 'twilio'] as const;
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
 * Countries where domestic VoIP-to-PSTN dial-out is prohibited, so a call must
 * be bridged over the PSTN by a locally licensed operator.
 *
 * India is the case this product is built around. Others are listed only where
 * we have a licensed provider; an unlisted restricted country is safer to
 * refuse than to attempt.
 */
const PSTN_BRIDGE_ONLY_COUNTRIES: Readonly<Record<string, TelephonyProviderName>> = {
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
 * Chooses how to place a call to the given number.
 *
 * Refusing is a valid outcome. If the destination requires a licensed local
 * operator we do not have, the call must not fall back to a provider that
 * cannot lawfully complete it.
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

  const requiredProvider = PSTN_BRIDGE_ONLY_COUNTRIES[countryCode];

  if (requiredProvider) {
    if (!options.availableProviders.includes(requiredProvider)) {
      throw new TelephonyError(
        'Calling this country is not available on this workspace yet',
        'CALL_DESTINATION_UNSUPPORTED',
        false,
      );
    }

    return {
      provider: requiredProvider,
      transport: 'pstn_bridge',
      countryCode,
      reason: `Domestic VoIP-to-PSTN dial-out is restricted for +${countryCode}; bridging via ${requiredProvider}`,
    };
  }

  // Everywhere else, a general CPaaS can carry the call.
  if (options.availableProviders.includes('twilio')) {
    return {
      provider: 'twilio',
      transport: 'pstn_bridge',
      countryCode,
      reason: `No local restriction recorded for +${countryCode}; using twilio`,
    };
  }

  // Exotel can place international calls, so it is a usable last resort.
  if (options.availableProviders.includes('exotel')) {
    return {
      provider: 'exotel',
      transport: 'pstn_bridge',
      countryCode,
      reason: `Twilio unavailable; falling back to exotel for +${countryCode}`,
    };
  }

  throw new TelephonyError(
    'No telephony provider is configured on this server',
    'TELEPHONY_NOT_CONFIGURED',
    false,
  );
}
