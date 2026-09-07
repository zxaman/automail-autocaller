import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import {
  APP_PASSWORD_HELP_URL,
  APP_PASSWORD_LENGTH,
  type ConnectGmailPayload,
} from '../../models/email-account.model';

/**
 * Gmail connection form.
 *
 * The App Password lives in a component signal only until submit, is rendered
 * in a masked field, and is cleared on success, cancel, and destroy. It is
 * never written to localStorage, never placed in a URL, and never echoed back.
 */
@Component({
  selector: 'app-connect-gmail-form',
  standalone: true,
  templateUrl: './connect-gmail-form.component.html',
  styleUrl: './connect-gmail-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectGmailFormComponent {
  public readonly isSubmitting = input(false);
  public readonly errorMessage = input<string | null>(null);
  public readonly submitted = output<ConnectGmailPayload>();
  public readonly cancelled = output<void>();

  protected readonly helpUrl = APP_PASSWORD_HELP_URL;
  protected readonly email = signal('');
  protected readonly displayName = signal('');
  protected readonly appPassword = signal('');
  protected readonly makeDefault = signal(false);
  protected readonly showPassword = signal(false);

  /** Spaces are stripped so Google's four-group display can be pasted as-is. */
  protected readonly normalizedPassword = computed(() =>
    this.appPassword().replace(/\s+/g, ''),
  );

  protected readonly isEmailValid = computed(() => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(this.email()));

  protected readonly isPasswordValid = computed(() => {
    const value = this.normalizedPassword();
    return value.length === APP_PASSWORD_LENGTH && /^[a-zA-Z]+$/.test(value);
  });

  protected readonly passwordHint = computed(() => {
    const value = this.normalizedPassword();
    if (value === '') {
      return `Google shows this as four groups of four letters.`;
    }
    if (/[^a-zA-Z]/.test(value)) {
      return 'An App Password contains only letters. This looks like your normal password.';
    }
    if (value.length !== APP_PASSWORD_LENGTH) {
      return `${value.length} of ${APP_PASSWORD_LENGTH} characters entered.`;
    }
    return 'Looks like a valid App Password.';
  });

  protected readonly canSubmit = computed(
    () =>
      this.isEmailValid() &&
      this.displayName().trim() !== '' &&
      this.isPasswordValid() &&
      !this.isSubmitting(),
  );

  protected onSubmit(event: Event): void {
    event.preventDefault();

    if (!this.canSubmit()) {
      return;
    }

    this.submitted.emit({
      email: this.email().trim().toLowerCase(),
      displayName: this.displayName().trim(),
      appPassword: this.normalizedPassword(),
      makeDefault: this.makeDefault(),
    });

    // Clear the secret from component state as soon as it has been handed off.
    this.appPassword.set('');
    this.showPassword.set(false);
  }

  protected onCancel(): void {
    this.appPassword.set('');
    this.showPassword.set(false);
    this.cancelled.emit();
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }
}
