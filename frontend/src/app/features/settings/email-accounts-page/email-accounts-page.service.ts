import { Injectable, computed, inject, signal } from '@angular/core';

import { AppError } from '../../../core/models/api-error.model';
import { NotificationService } from '../../../core/services/notification.service';
import type { ConnectGmailPayload, EmailAccount } from '../models/email-account.model';
import { EmailAccountService } from '../services/email-account.service';

/**
 * View state for connected Gmail accounts.
 *
 * The App Password never enters this service's state — it arrives as a call
 * argument, goes into the request, and is gone.
 */
@Injectable()
export class EmailAccountsPageService {
  private readonly accountService = inject(EmailAccountService);
  private readonly notifications = inject(NotificationService);

  private readonly accountsSignal = signal<readonly EmailAccount[]>([]);
  private readonly isLoadingSignal = signal(false);
  private readonly isConnectingSignal = signal(false);
  private readonly busyAccountIdSignal = signal<string | null>(null);
  private readonly errorSignal = signal<string | null>(null);
  private readonly connectErrorSignal = signal<string | null>(null);
  private readonly isFormOpenSignal = signal(false);

  public readonly accounts = this.accountsSignal.asReadonly();
  public readonly isLoading = this.isLoadingSignal.asReadonly();
  public readonly isConnecting = this.isConnectingSignal.asReadonly();
  public readonly busyAccountId = this.busyAccountIdSignal.asReadonly();
  public readonly errorMessage = this.errorSignal.asReadonly();
  public readonly connectError = this.connectErrorSignal.asReadonly();
  public readonly isFormOpen = this.isFormOpenSignal.asReadonly();

  public readonly hasAccounts = computed(() => this.accountsSignal().length > 0);
  public readonly defaultAccount = computed(
    () => this.accountsSignal().find((account) => account.isDefault) ?? null,
  );
  public readonly hasFailingAccount = computed(() =>
    this.accountsSignal().some((account) => account.status === 'verification_failed'),
  );

  public load(): void {
    this.isLoadingSignal.set(true);
    this.errorSignal.set(null);

    this.accountService.list().subscribe({
      next: (response) => {
        this.accountsSignal.set(response.items);
        this.isLoadingSignal.set(false);
      },
      error: (error: unknown) => {
        this.errorSignal.set(
          this.toMessage(error, 'Connected accounts could not be loaded.'),
        );
        this.isLoadingSignal.set(false);
      },
    });
  }

  public openForm(): void {
    this.connectErrorSignal.set(null);
    this.isFormOpenSignal.set(true);
  }

  public closeForm(): void {
    this.isFormOpenSignal.set(false);
    this.connectErrorSignal.set(null);
  }

  public connect(payload: ConnectGmailPayload): void {
    this.isConnectingSignal.set(true);
    this.connectErrorSignal.set(null);

    this.accountService.connect(payload).subscribe({
      next: (account) => {
        this.isConnectingSignal.set(false);
        this.isFormOpenSignal.set(false);
        this.notifications.success(`${account.email} is connected and verified.`);
        this.load();
      },
      error: (error: unknown) => {
        // Shown inline on the form so the user can correct the password without
        // retyping the whole thing.
        this.connectErrorSignal.set(
          this.toMessage(error, 'That Gmail account could not be connected.'),
        );
        this.isConnectingSignal.set(false);
      },
    });
  }

  public verify(accountId: string): void {
    this.runAccountAction(accountId, this.accountService.verify(accountId), (account) =>
      `${account.email} verified successfully.`,
    );
  }

  public sendTest(accountId: string): void {
    this.busyAccountIdSignal.set(accountId);

    this.accountService.sendTest(accountId).subscribe({
      next: (result) => {
        this.busyAccountIdSignal.set(null);
        this.notifications.success(`Test email sent to ${result.sentTo}.`);
        this.load();
      },
      error: (error: unknown) => {
        this.busyAccountIdSignal.set(null);
        this.notifications.error(this.toMessage(error, 'The test email could not be sent.'));
        this.load();
      },
    });
  }

  public setDefault(accountId: string): void {
    this.runAccountAction(accountId, this.accountService.setDefault(accountId), (account) =>
      `${account.email} is now the default sending account.`,
    );
  }

  public disconnect(accountId: string): void {
    this.busyAccountIdSignal.set(accountId);

    this.accountService.disconnect(accountId).subscribe({
      next: () => {
        this.busyAccountIdSignal.set(null);
        this.notifications.success('The account was disconnected and its credential deleted.');
        this.load();
      },
      error: (error: unknown) => {
        this.busyAccountIdSignal.set(null);
        this.notifications.error(this.toMessage(error, 'The account could not be disconnected.'));
      },
    });
  }

  private runAccountAction(
    accountId: string,
    request: ReturnType<EmailAccountService['verify']>,
    successMessage: (account: EmailAccount) => string,
  ): void {
    this.busyAccountIdSignal.set(accountId);

    request.subscribe({
      next: (account) => {
        this.busyAccountIdSignal.set(null);
        this.notifications.success(successMessage(account));
        this.load();
      },
      error: (error: unknown) => {
        this.busyAccountIdSignal.set(null);
        this.notifications.error(this.toMessage(error, 'That action could not be completed.'));
        // Reload so a newly failed status is reflected in the list.
        this.load();
      },
    });
  }

  private toMessage(error: unknown, fallback: string): string {
    return error instanceof AppError ? error.message : fallback;
  }
}
