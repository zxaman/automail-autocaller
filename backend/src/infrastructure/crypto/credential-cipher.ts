import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import { AppError } from '../../shared/errors/app-error';

/**
 * Authenticated encryption for Gmail App Passwords.
 *
 * AES-256-GCM is used rather than CBC because it authenticates the ciphertext:
 * a tampered record fails to decrypt instead of yielding attacker-influenced
 * plaintext. Every field of the envelope is stored separately so nothing has to
 * be parsed out of a concatenated blob.
 *
 * The key never leaves this module and is never written to MongoDB. Callers
 * hand over a plaintext string and receive an opaque envelope back.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96-bit nonce, the size GCM is specified for.
const AUTH_TAG_BYTES = 16;

/** Bumped if the scheme ever changes, so old records can still be read. */
export const CIPHER_VERSION = 1;

export interface EncryptedEnvelope {
  version: number;
  ciphertext: string;
  iv: string;
  authTag: string;
}

export class CredentialCipher {
  private readonly key: Buffer;

  constructor(rawKey: string) {
    this.key = CredentialCipher.parseKey(rawKey);
  }

  /**
   * Accepts a 64-character hex or a 44-character base64 key. Anything shorter
   * than 256 bits is rejected outright rather than being padded or hashed into
   * shape, which would silently weaken the cipher.
   */
  public static parseKey(rawKey: string): Buffer {
    const trimmed = rawKey.trim();

    if (trimmed === '') {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY is not set');
    }

    let key: Buffer;
    if (/^[0-9a-f]{64}$/i.test(trimmed)) {
      key = Buffer.from(trimmed, 'hex');
    } else {
      key = Buffer.from(trimmed, 'base64');
    }

    if (key.length !== KEY_BYTES) {
      throw new Error(
        `CREDENTIAL_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). ` +
          'Generate one with: openssl rand -hex 32',
      );
    }

    return key;
  }

  /** Convenience for operators generating a first key. */
  public static generateKey(): string {
    return randomBytes(KEY_BYTES).toString('hex');
  }

  public encrypt(plaintext: string): EncryptedEnvelope {
    if (plaintext === '') {
      throw new AppError('Nothing to encrypt', 500, 'CREDENTIAL_ENCRYPT_FAILED');
    }

    // A fresh random IV per encryption; reusing one under GCM is catastrophic.
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return {
      version: CIPHER_VERSION,
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  public decrypt(envelope: EncryptedEnvelope): string {
    if (envelope.version !== CIPHER_VERSION) {
      throw new AppError(
        'The stored credential uses an unsupported encryption version',
        500,
        'CREDENTIAL_VERSION_UNSUPPORTED',
      );
    }

    try {
      const iv = Buffer.from(envelope.iv, 'base64');
      const authTag = Buffer.from(envelope.authTag, 'base64');

      if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
        throw new Error('malformed envelope');
      }

      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // The underlying error can hint at key material, so it is not surfaced.
      throw new AppError(
        'The stored credential could not be decrypted. It may have been tampered with, ' +
          'or the encryption key may have changed.',
        500,
        'CREDENTIAL_DECRYPT_FAILED',
      );
    }
  }

  /** Constant-time compare, for verifying a credential without leaking timing. */
  public static safeEquals(left: string, right: string): boolean {
    const a = Buffer.from(left, 'utf8');
    const b = Buffer.from(right, 'utf8');

    if (a.length !== b.length) {
      return false;
    }

    return timingSafeEqual(a, b);
  }
}
