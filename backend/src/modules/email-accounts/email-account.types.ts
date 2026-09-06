export interface EmailAccountDto {
  id: string;
  email: string;
  displayName: string;
  provider: 'gmail';
  status: 'active' | 'verification_failed' | 'disabled';
  isDefault: boolean;
  lastVerifiedAt: string | null;
  lastFailureCode: string | null;
  lastFailureAt: string | null;
  createdAt: string;
}

export interface ConnectAccountInput {
  email: string;
  displayName: string;
  appPassword: string;
  makeDefault: boolean;
}

export interface SendTestEmailInput {
  to?: string;
}
