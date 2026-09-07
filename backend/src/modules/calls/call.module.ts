import { env } from '../../config/environment';
import { logger } from '../../infrastructure/logger/logger';
import { ExotelProvider } from '../../infrastructure/telephony/exotel-provider';
import type { TelephonyProviderName } from '../../infrastructure/telephony/call-routing';
import type { TelephonyProvider } from '../../infrastructure/telephony/telephony-provider';
import { CallController } from './call.controller';
import { CallRepository } from './call.repository';
import { CallService, type CallerIdResolver, type ProviderRegistry } from './call.service';

/**
 * Composition root for calling.
 *
 * Providers are registered only when fully configured. A half-configured
 * provider is left out rather than being registered and failing at call time,
 * so routing can report honestly that a destination is unavailable.
 */
export function createCallModule() {
  const providers: Partial<Record<TelephonyProviderName, TelephonyProvider>> = {};

  if (env.EXOTEL_ACCOUNT_SID && env.EXOTEL_API_KEY && env.EXOTEL_API_TOKEN) {
    if (!env.TELEPHONY_WEBHOOK_SECRET) {
      // Without a secret, call outcomes could be forged by anyone.
      logger.error('TELEPHONY_WEBHOOK_SECRET is not set; Exotel is disabled');
    } else {
      providers.exotel = new ExotelProvider({
        accountSid: env.EXOTEL_ACCOUNT_SID,
        apiKey: env.EXOTEL_API_KEY,
        apiToken: env.EXOTEL_API_TOKEN,
        subdomain: env.EXOTEL_SUBDOMAIN,
        webhookSecret: env.TELEPHONY_WEBHOOK_SECRET,
      });
    }
  }

  if (Object.keys(providers).length === 0) {
    logger.warn('No telephony provider is configured; calling is disabled');
  }

  /**
   * Caller ID per destination country. Falls back to the default virtual
   * number, which is correct for the single-country case and leaves room for
   * per-country numbers as the product expands.
   */
  const callerIds: CallerIdResolver = {
    resolve: (countryCode: string): string | null => {
      if (countryCode === '91' && env.EXOTEL_CALLER_ID) {
        return env.EXOTEL_CALLER_ID;
      }
      return env.DEFAULT_CALLER_ID ?? env.EXOTEL_CALLER_ID ?? null;
    },
  };

  const repository = new CallRepository();
  const callService = new CallService(repository, providers as ProviderRegistry, callerIds);

  return {
    callController: new CallController(callService),
    callService,
    repository,
  };
}

export type CallModule = ReturnType<typeof createCallModule>;
