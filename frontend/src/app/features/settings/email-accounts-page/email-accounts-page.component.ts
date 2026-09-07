import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { UiCardComponent } from '../../../shared/components/ui-card/ui-card.component';
import { UiEmptyStateComponent } from '../../../shared/components/ui-empty-state/ui-empty-state.component';
import { UiErrorStateComponent } from '../../../shared/components/ui-error-state/ui-error-state.component';
import { UiLoadingSpinnerComponent } from '../../../shared/components/ui-loading-spinner/ui-loading-spinner.component';
import { ConnectGmailFormComponent } from '../components/connect-gmail-form/connect-gmail-form.component';
import { EmailAccountCardComponent } from '../components/email-account-card/email-account-card.component';
import type { ConnectGmailPayload } from '../models/email-account.model';
import { EmailAccountsPageService } from './email-accounts-page.service';

/** Connected Gmail accounts: connect, verify, test, default, disconnect. */
@Component({
  selector: 'app-email-accounts-page',
  standalone: true,
  imports: [
    UiCardComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    UiLoadingSpinnerComponent,
    ConnectGmailFormComponent,
    EmailAccountCardComponent,
  ],
  providers: [EmailAccountsPageService],
  templateUrl: './email-accounts-page.component.html',
  styleUrl: './email-accounts-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailAccountsPageComponent implements OnInit {
  private readonly page = inject(EmailAccountsPageService);

  protected readonly accounts = this.page.accounts;
  protected readonly isLoading = this.page.isLoading;
  protected readonly isConnecting = this.page.isConnecting;
  protected readonly busyAccountId = this.page.busyAccountId;
  protected readonly errorMessage = this.page.errorMessage;
  protected readonly connectError = this.page.connectError;
  protected readonly isFormOpen = this.page.isFormOpen;
  protected readonly hasAccounts = this.page.hasAccounts;

  public ngOnInit(): void {
    this.page.load();
  }

  protected reload(): void {
    this.page.load();
  }

  protected openForm(): void {
    this.page.openForm();
  }

  protected closeForm(): void {
    this.page.closeForm();
  }

  protected connect(payload: ConnectGmailPayload): void {
    this.page.connect(payload);
  }

  protected verify(accountId: string): void {
    this.page.verify(accountId);
  }

  protected sendTest(accountId: string): void {
    this.page.sendTest(accountId);
  }

  protected setDefault(accountId: string): void {
    this.page.setDefault(accountId);
  }

  protected disconnect(accountId: string): void {
    // Disconnecting destroys the stored credential, so it is worth a prompt.
    const confirmed = globalThis.confirm(
      'Disconnect this account? Its stored App Password will be permanently deleted, ' +
        'and you will need a new one to reconnect.',
    );

    if (confirmed) {
      this.page.disconnect(accountId);
    }
  }
}
