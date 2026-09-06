import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { EmailAccount } from '../../models/email-account.model';

/** One connected Gmail account, with its status and available actions. */
@Component({
  selector: 'app-email-account-card',
  standalone: true,
  templateUrl: './email-account-card.component.html',
  styleUrl: './email-account-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailAccountCardComponent {
  public readonly account = input.required<EmailAccount>();
  public readonly isBusy = input(false);

  public readonly verifyRequested = output<string>();
  public readonly testRequested = output<string>();
  public readonly defaultRequested = output<string>();
  public readonly disconnectRequested = output<string>();

  protected readonly statusLabel = computed(() => {
    switch (this.account().status) {
      case 'active':
        return 'Connected';
      case 'verification_failed':
        return 'Needs attention';
      default:
        return 'Disabled';
    }
  });

  /** Explains a failure in terms of what the user should actually do next. */
  protected readonly statusDetail = computed(() => {
    const account = this.account();

    if (account.status === 'active') {
      return account.lastVerifiedAt
        ? `Last verified ${new Date(account.lastVerifiedAt).toLocaleString()}`
        : 'Verified';
    }

    switch (account.lastFailureCode) {
      case 'SMTP_AUTH_FAILED':
        return 'Gmail rejected the saved App Password. It may have been revoked — reconnect with a new one.';
      case 'SMTP_RATE_LIMITED':
        return 'Gmail is rate limiting this account. Try verifying again in a few minutes.';
      case 'SMTP_TIMEOUT':
      case 'SMTP_CONNECTION_FAILED':
        return 'Gmail could not be reached the last time this account was used.';
      default:
        return 'The last attempt to use this account failed.';
    }
  });

  protected readonly needsAttention = computed(
    () => this.account().status === 'verification_failed',
  );
}
