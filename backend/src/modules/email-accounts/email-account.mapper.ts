import type { EmailAccountDocument } from './email-account.model';
import type { EmailAccountDto } from './email-account.types';

/**
 * The single place an account becomes an API response.
 *
 * Fields are listed explicitly rather than spread, so a new schema field can
 * never be exposed by accident. The credential has no representation here at
 * all — not masked, not a placeholder, simply absent.
 */
export function toEmailAccountDto(account: EmailAccountDocument): EmailAccountDto {
  return {
    id: account._id.toString(),
    email: account.email,
    displayName: account.displayName,
    provider: account.provider,
    status: account.status,
    isDefault: account.isDefault,
    lastVerifiedAt: account.lastVerifiedAt ? account.lastVerifiedAt.toISOString() : null,
    lastFailureCode: account.lastFailureCode,
    lastFailureAt: account.lastFailureAt ? account.lastFailureAt.toISOString() : null,
    createdAt: account.createdAt.toISOString(),
  };
}
