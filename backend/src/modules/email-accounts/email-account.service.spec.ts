import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CredentialCipher } from '../../infrastructure/crypto/credential-cipher';
import type { SmtpVerifier } from '../../infrastructure/smtp/smtp-verifier';
import { EmailAccountService } from './email-account.service';
import type { EmailAccountRepository, EmailAccountScope } from './email-account.repository';

const scope: EmailAccountScope = { workspaceId: new Types.ObjectId() };
const ownerId = new Types.ObjectId();
const accountId = new Types.ObjectId();

const APP_PASSWORD = 'abcdefghijklmnop';
const cipher = new CredentialCipher('a'.repeat(64));

function accountDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: accountId,
    email: 'sender@gmail.com',
    displayName: 'Sender',
    provider: 'gmail',
    status: 'active',
    isDefault: true,
    credential: cipher.encrypt(APP_PASSWORD),
    lastVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    lastFailureCode: null,
    lastFailureAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as never;
}

function createRepository() {
  return {
    list: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    findByIdWithCredential: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    countForWorkspace: vi.fn().mockResolvedValue(0),
    upsert: vi.fn().mockResolvedValue(accountDoc()),
    clearDefaultExcept: vi.fn().mockResolvedValue(undefined),
    setDefault: vi.fn().mockResolvedValue(accountDoc()),
    recordVerificationSuccess: vi.fn().mockResolvedValue(accountDoc()),
    recordVerificationFailure: vi.fn().mockResolvedValue(accountDoc()),
    delete: vi.fn().mockResolvedValue(true),
    findOldestRemaining: vi.fn().mockResolvedValue(null),
  };
}

function createVerifier(success = true) {
  return {
    verify: vi.fn().mockResolvedValue(
      success
        ? { success: true }
        : {
            success: false,
            failure: {
              code: 'SMTP_AUTH_FAILED',
              message: 'Gmail rejected those credentials. Use an App Password.',
              retryable: false,
            },
          },
    ),
    sendTestEmail: vi.fn().mockResolvedValue({ success: true }),
  };
}

describe('EmailAccountService', () => {
  let repository: ReturnType<typeof createRepository>;
  let verifier: ReturnType<typeof createVerifier>;
  let service: EmailAccountService;

  beforeEach(() => {
    repository = createRepository();
    verifier = createVerifier();
    service = new EmailAccountService(
      repository as unknown as EmailAccountRepository,
      cipher,
      verifier as unknown as SmtpVerifier,
    );
  });

  const connectInput = {
    email: 'sender@gmail.com',
    displayName: 'Sender',
    appPassword: APP_PASSWORD,
    makeDefault: false,
  };

  describe('connecting an account', () => {
    it('verifies the credential against Gmail before storing anything', async () => {
      await service.connect(scope, ownerId, connectInput);

      expect(verifier.verify).toHaveBeenCalledWith({
        email: 'sender@gmail.com',
        appPassword: APP_PASSWORD,
      });
      // Order matters: verification must precede persistence.
      expect(verifier.verify.mock.invocationCallOrder[0]).toBeLessThan(
        repository.upsert.mock.invocationCallOrder[0]!,
      );
    });

    it('never writes an unverified credential to the database', async () => {
      verifier = createVerifier(false);
      service = new EmailAccountService(
        repository as unknown as EmailAccountRepository,
        cipher,
        verifier as unknown as SmtpVerifier,
      );

      await expect(service.connect(scope, ownerId, connectInput)).rejects.toThrow(
        /App Password/,
      );
      expect(repository.upsert).not.toHaveBeenCalled();
    });

    it('stores the App Password encrypted, never in plaintext', async () => {
      await service.connect(scope, ownerId, connectInput);

      const stored = repository.upsert.mock.calls[0]![2] as { credential: Record<string, string> };
      const serialized = JSON.stringify(stored.credential);

      expect(serialized).not.toContain(APP_PASSWORD);
      expect(stored.credential).toHaveProperty('authTag');
      // And it must be recoverable by the server.
      expect(cipher.decrypt(stored.credential as never)).toBe(APP_PASSWORD);
    });

    it('never returns the credential in the response', async () => {
      const result = await service.connect(scope, ownerId, connectInput);
      const serialized = JSON.stringify(result);

      expect(serialized).not.toContain(APP_PASSWORD);
      expect(serialized).not.toContain('credential');
      expect(result).not.toHaveProperty('credential');
    });

    it('makes the very first connected account the default automatically', async () => {
      await service.connect(scope, ownerId, connectInput);

      const stored = repository.upsert.mock.calls[0]![2] as { isDefault: boolean };
      expect(stored.isDefault).toBe(true);
    });

    it('does not force the default when other accounts already exist', async () => {
      repository.countForWorkspace = vi.fn().mockResolvedValue(2);

      await service.connect(scope, ownerId, connectInput);

      const stored = repository.upsert.mock.calls[0]![2] as { isDefault: boolean };
      expect(stored.isDefault).toBe(false);
    });

    it('replaces the credential when reconnecting an existing address', async () => {
      repository.findByEmail = vi.fn().mockResolvedValue(accountDoc());

      await service.connect(scope, ownerId, { ...connectInput, appPassword: 'ponmlkjihgfedcba' });

      // upsert overwrites in place rather than creating a second record.
      expect(repository.upsert).toHaveBeenCalledTimes(1);
      const stored = repository.upsert.mock.calls[0]![2] as { credential: never };
      expect(cipher.decrypt(stored.credential)).toBe('ponmlkjihgfedcba');
    });

    it('enforces the per-workspace account limit', async () => {
      repository.countForWorkspace = vi.fn().mockResolvedValue(5);

      await expect(service.connect(scope, ownerId, connectInput)).rejects.toThrow(/at most/);
      expect(verifier.verify).not.toHaveBeenCalled();
    });
  });

  describe('when encryption is not configured', () => {
    it('refuses to accept a credential rather than storing it weakly', async () => {
      const unconfigured = new EmailAccountService(
        repository as unknown as EmailAccountRepository,
        null,
        verifier as unknown as SmtpVerifier,
      );

      await expect(unconfigured.connect(scope, ownerId, connectInput)).rejects.toThrow(
        /not configured/,
      );
      expect(repository.upsert).not.toHaveBeenCalled();
      expect(verifier.verify).not.toHaveBeenCalled();
    });
  });

  describe('verifying a stored credential', () => {
    it('decrypts and re-checks it against Gmail', async () => {
      repository.findByIdWithCredential = vi.fn().mockResolvedValue(accountDoc());

      await service.verifyStored(scope, accountId.toString());

      expect(verifier.verify).toHaveBeenCalledWith({
        email: 'sender@gmail.com',
        appPassword: APP_PASSWORD,
      });
      expect(repository.recordVerificationSuccess).toHaveBeenCalled();
    });

    it('records only the failure code, never the SMTP response', async () => {
      repository.findByIdWithCredential = vi.fn().mockResolvedValue(accountDoc());
      verifier.verify = vi.fn().mockResolvedValue({
        success: false,
        failure: { code: 'SMTP_AUTH_FAILED', message: 'rejected', retryable: false },
      });

      await expect(service.verifyStored(scope, accountId.toString())).rejects.toThrow();

      expect(repository.recordVerificationFailure).toHaveBeenCalledWith(
        scope,
        accountId,
        'SMTP_AUTH_FAILED',
      );
    });
  });

  describe('sending a test email', () => {
    it('defaults to the connected address itself', async () => {
      repository.findByIdWithCredential = vi.fn().mockResolvedValue(accountDoc());

      const result = await service.sendTestEmail(scope, accountId.toString());

      expect(result.sentTo).toBe('sender@gmail.com');
      expect(verifier.sendTestEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'sender@gmail.com', appPassword: APP_PASSWORD }),
      );
    });

    it('sends to an explicit recipient when one is given', async () => {
      repository.findByIdWithCredential = vi.fn().mockResolvedValue(accountDoc());

      const result = await service.sendTestEmail(scope, accountId.toString(), 'qa@example.com');

      expect(result.sentTo).toBe('qa@example.com');
    });
  });

  describe('ownership', () => {
    it.each([
      ['verifyStored', () => service.verifyStored(scope, accountId.toString())],
      ['sendTestEmail', () => service.sendTestEmail(scope, accountId.toString())],
      ['setDefault', () => service.setDefault(scope, accountId.toString())],
      ['disconnect', () => service.disconnect(scope, accountId.toString())],
    ])('%s reports a foreign account as not found, never forbidden', async (_name, call) => {
      // Repository returns null because its filter is workspace-scoped.
      await expect(call()).rejects.toMatchObject({
        statusCode: 404,
        code: 'EMAIL_ACCOUNT_NOT_FOUND',
      });
    });
  });

  describe('disconnecting', () => {
    it('deletes the record so the encrypted credential goes with it', async () => {
      repository.findById = vi.fn().mockResolvedValue(accountDoc({ isDefault: false }));

      await service.disconnect(scope, accountId.toString());

      expect(repository.delete).toHaveBeenCalledWith(scope, accountId.toString());
    });

    it('promotes another account when the default is removed', async () => {
      const replacementId = new Types.ObjectId();
      repository.findById = vi.fn().mockResolvedValue(accountDoc({ isDefault: true }));
      repository.findOldestRemaining = vi
        .fn()
        .mockResolvedValue(accountDoc({ _id: replacementId }));

      await service.disconnect(scope, accountId.toString());

      expect(repository.setDefault).toHaveBeenCalledWith(scope, replacementId);
    });

    it('leaves no default when the last account is removed', async () => {
      repository.findById = vi.fn().mockResolvedValue(accountDoc({ isDefault: true }));
      repository.findOldestRemaining = vi.fn().mockResolvedValue(null);

      await service.disconnect(scope, accountId.toString());

      expect(repository.setDefault).not.toHaveBeenCalled();
    });
  });

  describe('setting the default', () => {
    it('clears the previous default before setting the new one', async () => {
      repository.findById = vi.fn().mockResolvedValue(accountDoc());

      await service.setDefault(scope, accountId.toString());

      expect(repository.clearDefaultExcept.mock.invocationCallOrder[0]).toBeLessThan(
        repository.setDefault.mock.invocationCallOrder[0]!,
      );
    });
  });
});
