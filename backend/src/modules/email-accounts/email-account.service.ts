import type { Types } from 'mongoose';

import type { CredentialCipher } from '../../infrastructure/crypto/credential-cipher';
import type { SmtpVerifier } from '../../infrastructure/smtp/smtp-verifier';
import { AppError } from '../../shared/errors/app-error';
import { toEmailAccountDto } from './email-account.mapper';
import type { EmailAccountDocument } from './email-account.model';
import type { EmailAccountRepository, EmailAccountScope } from './email-account.repository';
import type { ConnectAccountInput, EmailAccountDto } from './email-account.types';

/** Hard cap per workspace; connecting is cheap but not unbounded. */
const MAX_ACCOUNTS_PER_WORKSPACE = 5;

/**
 * Gmail account connection.
 *
 * The central rule: a credential is verified against Gmail *before* it is
 * stored, encrypted the moment it is accepted, and decrypted only inside the
 * narrow window where SMTP needs it. It is never returned, never logged, and
 * never held on a long-lived object.
 */
export class EmailAccountService {
  constructor(
    private readonly accountRepository: EmailAccountRepository,
    private readonly cipher: CredentialCipher | null,
    private readonly smtpVerifier: SmtpVerifier,
  ) {}

  public async list(scope: EmailAccountScope): Promise<EmailAccountDto[]> {
    const accounts = await this.accountRepository.list(scope);
    return accounts.map(toEmailAccountDto);
  }

  public async connect(
    scope: EmailAccountScope,
    ownerId: Types.ObjectId,
    input: ConnectAccountInput,
  ): Promise<EmailAccountDto> {
    const cipher = this.requireCipher();

    const existing = await this.accountRepository.findByEmail(scope, input.email);
    if (!existing) {
      const count = await this.accountRepository.countForWorkspace(scope);
      if (count >= MAX_ACCOUNTS_PER_WORKSPACE) {
        throw new AppError(
          `A workspace can connect at most ${MAX_ACCOUNTS_PER_WORKSPACE} email accounts`,
          409,
          'EMAIL_ACCOUNT_LIMIT_REACHED',
        );
      }
    }

    // Verify first. An unusable credential is never written to the database.
    const verification = await this.smtpVerifier.verify({
      email: input.email,
      appPassword: input.appPassword,
    });

    if (!verification.success) {
      const failure = verification.failure!;
      throw new AppError(failure.message, failure.code === 'SMTP_AUTH_FAILED' ? 400 : 502, failure.code);
    }

    const credential = cipher.encrypt(input.appPassword);

    // The first account connected becomes the default automatically.
    const isFirstAccount = (await this.accountRepository.countForWorkspace(scope)) === 0;
    const shouldBeDefault = input.makeDefault || isFirstAccount;

    const account = await this.accountRepository.upsert(scope, ownerId, {
      email: input.email,
      displayName: input.displayName,
      credential,
      isDefault: shouldBeDefault,
    });

    if (shouldBeDefault) {
      await this.accountRepository.clearDefaultExcept(scope, account._id);
    }

    return toEmailAccountDto(account);
  }

  /**
   * Re-checks a stored credential. Used by the UI's "verify" action and before
   * a large send, so a revoked App Password surfaces as a clear status rather
   * than a wall of failed messages.
   */
  public async verifyStored(
    scope: EmailAccountScope,
    accountId: string,
  ): Promise<EmailAccountDto> {
    const cipher = this.requireCipher();
    const account = await this.loadWithCredential(scope, accountId);

    const appPassword = cipher.decrypt(account.credential);
    const verification = await this.smtpVerifier.verify({
      email: account.email,
      appPassword,
    });

    if (!verification.success) {
      const failure = verification.failure!;
      const updated = await this.accountRepository.recordVerificationFailure(
        scope,
        account._id,
        failure.code,
      );

      throw new AppError(failure.message, failure.code === 'SMTP_AUTH_FAILED' ? 400 : 502, failure.code, {
        details: { accountId: updated?._id.toString() ?? accountId },
      });
    }

    const updated = await this.accountRepository.recordVerificationSuccess(scope, account._id);
    return toEmailAccountDto(updated ?? account);
  }

  public async sendTestEmail(
    scope: EmailAccountScope,
    accountId: string,
    to?: string,
  ): Promise<{ sentTo: string }> {
    const cipher = this.requireCipher();
    const account = await this.loadWithCredential(scope, accountId);

    // Default to sending to the connected address itself, which proves the
    // path end to end without involving a third party.
    const recipient = to ?? account.email;
    const appPassword = cipher.decrypt(account.credential);

    const result = await this.smtpVerifier.sendTestEmail({
      email: account.email,
      appPassword,
      fromName: account.displayName,
      to: recipient,
    });

    if (!result.success) {
      const failure = result.failure!;
      await this.accountRepository.recordVerificationFailure(scope, account._id, failure.code);
      throw new AppError(failure.message, failure.code === 'SMTP_AUTH_FAILED' ? 400 : 502, failure.code);
    }

    await this.accountRepository.recordVerificationSuccess(scope, account._id);
    return { sentTo: recipient };
  }

  public async setDefault(scope: EmailAccountScope, accountId: string): Promise<EmailAccountDto> {
    const account = await this.accountRepository.findById(scope, accountId);
    if (!account) {
      throw this.notFound();
    }

    // Clear the old default first: the partial unique index permits only one.
    await this.accountRepository.clearDefaultExcept(scope, account._id);
    const updated = await this.accountRepository.setDefault(scope, account._id);

    return toEmailAccountDto(updated ?? account);
  }

  /** Deletes the record, and with it the encrypted credential. */
  public async disconnect(scope: EmailAccountScope, accountId: string): Promise<void> {
    const account = await this.accountRepository.findById(scope, accountId);
    if (!account) {
      throw this.notFound();
    }

    const wasDefault = account.isDefault;
    const deleted = await this.accountRepository.delete(scope, accountId);

    if (!deleted) {
      throw this.notFound();
    }

    // Promote another account so the workspace is not left without a default.
    if (wasDefault) {
      const replacement = await this.accountRepository.findOldestRemaining(scope);
      if (replacement) {
        await this.accountRepository.setDefault(scope, replacement._id);
      }
    }
  }

  private async loadWithCredential(
    scope: EmailAccountScope,
    accountId: string,
  ): Promise<EmailAccountDocument> {
    const account = await this.accountRepository.findByIdWithCredential(scope, accountId);
    if (!account) {
      throw this.notFound();
    }
    return account;
  }

  /**
   * Without a key the API refuses to accept credentials at all. Storing an App
   * Password unencrypted, even temporarily, is not an acceptable fallback.
   *
   * The injected cipher is the single source of truth: the module builds it
   * only when a valid key is present, so re-reading the environment here would
   * just be a second, drift-prone copy of that decision.
   */
  private requireCipher(): CredentialCipher {
    if (!this.cipher) {
      throw new AppError(
        'Gmail sending is not configured on this server. Set CREDENTIAL_ENCRYPTION_KEY to enable it.',
        503,
        'GMAIL_ENCRYPTION_NOT_CONFIGURED',
      );
    }
    return this.cipher;
  }

  /** Cross-workspace access is indistinguishable from a missing record. */
  private notFound(): AppError {
    return new AppError('The email account was not found', 404, 'EMAIL_ACCOUNT_NOT_FOUND');
  }
}
