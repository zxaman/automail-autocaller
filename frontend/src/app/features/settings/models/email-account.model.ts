export type EmailAccountStatus = 'active' | 'verification_failed' | 'disabled';

export interface EmailAccount {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly provider: 'gmail';
  readonly status: EmailAccountStatus;
  readonly isDefault: boolean;
  readonly lastVerifiedAt: string | null;
  readonly lastFailureCode: string | null;
  readonly lastFailureAt: string | null;
  readonly createdAt: string;
}

/**
 * What the connect form sends. The App Password exists only in this payload,
 * in memory, for the duration of one request — it is never persisted anywhere
 * on the client.
 */
export interface ConnectGmailPayload {
  readonly email: string;
  readonly displayName: string;
  readonly appPassword: string;
  readonly makeDefault: boolean;
}

export interface TestEmailResult {
  readonly sentTo: string;
}

export const APP_PASSWORD_LENGTH = 16;

/** Where Google issues App Passwords, linked from the form. */
export const APP_PASSWORD_HELP_URL = 'https://myaccount.google.com/apppasswords';
