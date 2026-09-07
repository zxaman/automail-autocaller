import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { AppError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth.service';
import { GoogleIdentityService } from '../../../core/services/google-identity.service';
import { NotificationService } from '../../../core/services/notification.service';
import type { LoginPageState } from './login-page.model';

/**
 * Presentation logic for the login screen.
 *
 * The Google credential is passed straight to the backend for verification and
 * is never persisted, decoded, or trusted on the client.
 */
@Injectable()
export class LoginPageService {
  private readonly authService = inject(AuthService);
  private readonly googleIdentity = inject(GoogleIdentityService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stateSignal = signal<LoginPageState>({
    phase: 'initializing',
    errorMessage: null,
  });

  public readonly phase = computed(() => this.stateSignal().phase);
  public readonly errorMessage = computed(() => this.stateSignal().errorMessage);
  public readonly isSubmitting = computed(() => this.stateSignal().phase === 'submitting');
  public readonly isUnavailable = computed(() => this.stateSignal().phase === 'unavailable');
  public readonly isInitializing = computed(() => this.stateSignal().phase === 'initializing');

  /** Mounts the official Google button and handles each credential response. */
  public mountGoogleButton(container: HTMLElement, returnUrl: string): void {
    if (!this.googleIdentity.isConfigured) {
      this.stateSignal.set({
        phase: 'unavailable',
        errorMessage:
          'Google sign-in is not configured for this environment. Set the Google client ID to enable it.',
      });
      return;
    }

    this.googleIdentity
      .renderButton(container)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (idToken) => this.exchangeCredential(idToken, returnUrl),
        error: () =>
          this.stateSignal.set({
            phase: 'unavailable',
            errorMessage:
              'Google sign-in could not be loaded. Check your connection and refresh the page.',
          }),
      });

    this.stateSignal.set({ phase: 'ready', errorMessage: null });
  }

  private exchangeCredential(idToken: string, returnUrl: string): void {
    this.stateSignal.set({ phase: 'submitting', errorMessage: null });

    this.authService
      .loginWithGoogle(idToken)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.stateSignal.set({ phase: 'ready', errorMessage: null });
          this.notificationService.success(`Signed in as ${user.name}.`);
          void this.router.navigateByUrl(this.sanitizeReturnUrl(returnUrl));
        },
        error: (error: unknown) => {
          this.stateSignal.set({
            phase: 'ready',
            errorMessage: this.toMessage(error),
          });
        },
      });
  }

  /** Only same-origin relative paths are honoured, preventing open redirects. */
  private sanitizeReturnUrl(returnUrl: string): string {
    if (!returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
      return '/dashboard';
    }
    return returnUrl;
  }

  private toMessage(error: unknown): string {
    if (!(error instanceof AppError)) {
      return 'Sign-in failed. Please try again.';
    }

    switch (error.code) {
      case 'GOOGLE_AUTH_NOT_CONFIGURED':
        return 'Google sign-in is not enabled on the server yet.';
      case 'ACCOUNT_EMAIL_CONFLICT':
        return 'An account already exists for this email address.';
      case 'ACCOUNT_DISABLED':
        return 'This account has been disabled. Contact your workspace owner.';
      case 'GOOGLE_EMAIL_UNVERIFIED':
        return 'This Google account does not have a verified email address.';
      case 'AUTH_RATE_LIMITED':
        return 'Too many sign-in attempts. Please wait a few minutes and try again.';
      default:
        return error.message;
    }
  }
}
