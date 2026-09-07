import { describe, expect, it } from 'vitest';

import { findMissingProductionSettings } from './environment';

/**
 * A production container must refuse to start rather than boot half-configured
 * and fail later, in front of a user. These tests exercise the pure checker so
 * they do not depend on the module-level guard, which runs once at import.
 */
type Config = Parameters<typeof findMissingProductionSettings>[0];

/** A fully configured production deployment. */
function validConfig(overrides: Partial<Config> = {}): Config {
  return {
    GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
    CREDENTIAL_ENCRYPTION_KEY: 'a'.repeat(64),
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/automail',
    COOKIE_SECURE: true,
    EMAIL_QUEUE_DRIVER: 'redis',
    EXOTEL_ACCOUNT_SID: 'sid',
    EXOTEL_API_KEY: 'key',
    EXOTEL_API_TOKEN: 'token',
    TELEPHONY_WEBHOOK_SECRET: 'secret',
    ...overrides,
  } as Config;
}

function missingKeys(config: Config): string[] {
  return findMissingProductionSettings(config).map((item) => item.key);
}

describe('production configuration guard', () => {
  it('accepts a fully configured deployment', () => {
    expect(findMissingProductionSettings(validConfig())).toEqual([]);
  });

  it('rejects a deployment with no Google client id', () => {
    // Nobody could sign in, so the app would be unusable.
    expect(missingKeys(validConfig({ GOOGLE_CLIENT_ID: undefined }))).toContain(
      'GOOGLE_CLIENT_ID',
    );
  });

  it('rejects a deployment with no credential encryption key', () => {
    expect(
      missingKeys(validConfig({ CREDENTIAL_ENCRYPTION_KEY: undefined })),
    ).toContain('CREDENTIAL_ENCRYPTION_KEY');
  });

  it('rejects a MongoDB URI still pointing at localhost', () => {
    // In a container localhost is the container itself, not the database.
    expect(
      missingKeys(validConfig({ MONGODB_URI: 'mongodb://localhost:27017/automail' })),
    ).toContain('MONGODB_URI');
  });

  it('rejects insecure session cookies', () => {
    expect(missingKeys(validConfig({ COOKIE_SECURE: false }))).toContain('COOKIE_SECURE');
  });

  it('rejects the in-process queue, which loses jobs on restart', () => {
    expect(missingKeys(validConfig({ EMAIL_QUEUE_DRIVER: 'memory' }))).toContain(
      'EMAIL_QUEUE_DRIVER',
    );
  });

  it('allows telephony to be left entirely unconfigured', () => {
    // A deployment that only uses AutoMail is legitimate.
    const withoutTelephony = validConfig({
      EXOTEL_ACCOUNT_SID: undefined,
      EXOTEL_API_KEY: undefined,
      EXOTEL_API_TOKEN: undefined,
      TELEPHONY_WEBHOOK_SECRET: undefined,
    });

    expect(findMissingProductionSettings(withoutTelephony)).toEqual([]);
  });

  it('rejects partially configured telephony', () => {
    // Half-configured telephony fails at dial time, in front of a user.
    const partial = validConfig({ TELEPHONY_WEBHOOK_SECRET: undefined });

    expect(missingKeys(partial)).toContain('TELEPHONY_WEBHOOK_SECRET');
  });

  it('explains why each missing setting matters', () => {
    const findings = findMissingProductionSettings(
      validConfig({ GOOGLE_CLIENT_ID: undefined }),
    );

    // The operator reading a failed deploy needs the reason, not just a name.
    expect(findings[0]?.why).toMatch(/sign-in|authenticate/i);
  });
});
