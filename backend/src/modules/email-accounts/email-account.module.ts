import { env } from '../../config/environment';
import { CredentialCipher } from '../../infrastructure/crypto/credential-cipher';
import { SmtpVerifier } from '../../infrastructure/smtp/smtp-verifier';
import { logger } from '../../infrastructure/logger/logger';
import { EmailAccountController } from './email-account.controller';
import { EmailAccountRepository } from './email-account.repository';
import { EmailAccountService } from './email-account.service';

/**
 * Composition root for email accounts.
 *
 * A missing or malformed encryption key disables the feature rather than
 * crashing the API or, worse, falling back to storing secrets in the clear.
 */
export function createEmailAccountModule() {
  let cipher: CredentialCipher | null = null;

  if (env.CREDENTIAL_ENCRYPTION_KEY) {
    try {
      cipher = new CredentialCipher(env.CREDENTIAL_ENCRYPTION_KEY);
    } catch (error) {
      // The message describes the key's shape, never its value.
      logger.error(
        { reason: error instanceof Error ? error.message : 'unknown' },
        'CREDENTIAL_ENCRYPTION_KEY is invalid; Gmail connection is disabled',
      );
      cipher = null;
    }
  } else {
    logger.warn('CREDENTIAL_ENCRYPTION_KEY is not set; Gmail connection is disabled');
  }

  const accountRepository = new EmailAccountRepository();
  const accountService = new EmailAccountService(accountRepository, cipher, new SmtpVerifier());

  return {
    emailAccountController: new EmailAccountController(accountService),
    accountService,
    accountRepository,
  };
}

export type EmailAccountModule = ReturnType<typeof createEmailAccountModule>;
