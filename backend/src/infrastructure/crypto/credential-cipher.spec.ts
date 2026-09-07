import { describe, expect, it } from 'vitest';

import { CredentialCipher } from './credential-cipher';

const HEX_KEY = 'a'.repeat(64);
const cipher = new CredentialCipher(HEX_KEY);

describe('CredentialCipher', () => {
  describe('key handling', () => {
    it('accepts a 64-character hex key', () => {
      expect(() => new CredentialCipher(HEX_KEY)).not.toThrow();
    });

    it('accepts a base64 key of the right length', () => {
      const base64 = Buffer.alloc(32, 7).toString('base64');
      expect(() => new CredentialCipher(base64)).not.toThrow();
    });

    it('rejects a key that is too short instead of padding it', () => {
      expect(() => new CredentialCipher('abc123')).toThrow(/32 bytes/);
    });

    it('rejects an empty key', () => {
      expect(() => new CredentialCipher('   ')).toThrow(/not set/);
    });

    it('generates a valid 256-bit key', () => {
      const generated = CredentialCipher.generateKey();
      expect(generated).toHaveLength(64);
      expect(() => new CredentialCipher(generated)).not.toThrow();
    });
  });

  describe('round trip', () => {
    it('decrypts back to the original App Password', () => {
      const secret = 'abcd efgh ijkl mnop';
      const envelope = cipher.encrypt(secret);

      expect(cipher.decrypt(envelope)).toBe(secret);
    });

    it('never leaves the plaintext visible in the envelope', () => {
      const secret = 'abcdefghijklmnop';
      const envelope = cipher.encrypt(secret);
      const serialized = JSON.stringify(envelope);

      expect(serialized).not.toContain(secret);
      expect(envelope.ciphertext).not.toContain(secret);
    });

    it('produces a different ciphertext each time, via a fresh IV', () => {
      const first = cipher.encrypt('same-secret');
      const second = cipher.encrypt('same-secret');

      expect(first.iv).not.toBe(second.iv);
      expect(first.ciphertext).not.toBe(second.ciphertext);
      // Both must still decrypt correctly.
      expect(cipher.decrypt(first)).toBe('same-secret');
      expect(cipher.decrypt(second)).toBe('same-secret');
    });

    it('handles unicode and long credentials', () => {
      const secret = 'påsswörd-✓-' + 'x'.repeat(200);
      expect(cipher.decrypt(cipher.encrypt(secret))).toBe(secret);
    });
  });

  describe('tamper resistance', () => {
    it('refuses to decrypt when the ciphertext was altered', () => {
      const envelope = cipher.encrypt('abcdefghijklmnop');
      const bytes = Buffer.from(envelope.ciphertext, 'base64');
      bytes[0] = (bytes[0] ?? 0) ^ 0xff;

      expect(() =>
        cipher.decrypt({ ...envelope, ciphertext: bytes.toString('base64') }),
      ).toThrow(/could not be decrypted/);
    });

    it('refuses to decrypt when the auth tag was altered', () => {
      const envelope = cipher.encrypt('abcdefghijklmnop');
      const tag = Buffer.from(envelope.authTag, 'base64');
      tag[0] = (tag[0] ?? 0) ^ 0xff;

      expect(() => cipher.decrypt({ ...envelope, authTag: tag.toString('base64') })).toThrow(
        /could not be decrypted/,
      );
    });

    it('refuses to decrypt with a different key', () => {
      const envelope = cipher.encrypt('abcdefghijklmnop');
      const other = new CredentialCipher('b'.repeat(64));

      expect(() => other.decrypt(envelope)).toThrow(/could not be decrypted/);
    });

    it('rejects an unknown envelope version', () => {
      const envelope = cipher.encrypt('abcdefghijklmnop');

      expect(() => cipher.decrypt({ ...envelope, version: 99 })).toThrow(/unsupported/);
    });

    it('rejects a malformed IV', () => {
      const envelope = cipher.encrypt('abcdefghijklmnop');

      expect(() => cipher.decrypt({ ...envelope, iv: 'AAAA' })).toThrow(/could not be decrypted/);
    });
  });

  describe('safeEquals', () => {
    it('matches identical strings and rejects different ones', () => {
      expect(CredentialCipher.safeEquals('token', 'token')).toBe(true);
      expect(CredentialCipher.safeEquals('token', 'other')).toBe(false);
      expect(CredentialCipher.safeEquals('token', 'token-longer')).toBe(false);
    });
  });
});
