import { describe, expect, it } from 'vitest';

import { connectAccountSchema } from './email-account.validation';

const base = {
  email: 'sender@gmail.com',
  displayName: 'Sender',
  appPassword: 'abcdefghijklmnop',
};

describe('connectAccountSchema', () => {
  it('accepts a well-formed App Password', () => {
    const result = connectAccountSchema.parse(base);
    expect(result.appPassword).toBe('abcdefghijklmnop');
  });

  it('strips the spaces Google shows in the four-group format', () => {
    const result = connectAccountSchema.parse({ ...base, appPassword: 'abcd efgh ijkl mnop' });
    expect(result.appPassword).toBe('abcdefghijklmnop');
  });

  it('rejects a password of the wrong length, which is usually the account password', () => {
    const result = connectAccountSchema.safeParse({ ...base, appPassword: 'mypassword123' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/16 characters/);
    }
  });

  it('rejects an App Password containing digits or symbols', () => {
    expect(
      connectAccountSchema.safeParse({ ...base, appPassword: 'abcd1234efgh5678' }).success,
    ).toBe(false);
  });

  it('rejects an empty App Password', () => {
    expect(connectAccountSchema.safeParse({ ...base, appPassword: '' }).success).toBe(false);
  });

  it('normalizes the email address to lowercase', () => {
    const result = connectAccountSchema.parse({ ...base, email: 'Sender@Gmail.COM' });
    expect(result.email).toBe('sender@gmail.com');
  });

  it('rejects a malformed email address', () => {
    expect(connectAccountSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });

  it('requires a sender display name', () => {
    expect(connectAccountSchema.safeParse({ ...base, displayName: '  ' }).success).toBe(false);
  });

  it('defaults makeDefault to false', () => {
    expect(connectAccountSchema.parse(base).makeDefault).toBe(false);
  });
});
