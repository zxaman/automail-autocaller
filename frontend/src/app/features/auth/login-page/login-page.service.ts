import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AppError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import type { LoginPageState } from './login-page.model';

/**
 * Presentation state for the login screen.
 * The Google credential is exchanged server-side; no secret is held in Angular.
 */
@Injectable()
export class LoginPageService {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  private readonly state = signal<LoginPageState>({ submitting: false, errorMessage: null });

  public readonly submitting = computed(() => this.state().submitting);
  public readonly errorMessage = computed(() => this.state().errorMessage);

  public signInWithGoogle(idToken: string, returnUrl: string): void {
    this.state.set({ submitting: true, errorMessage: null });

    this.authService.loginWithGoogle(idToken).subscribe({
      next: (user) => {
        this.state.set({ submitting: false, errorMessage: null });
        this.notificationService.success(`Welcome back, ${user.name}.`);
        void this.router.navigateByUrl(returnUrl);
      },
      error: (error: unknown) => {
        const message =
          error instanceof AppError
            ? error.message
            : 'Google sign-in is unavailable right now. Please try again.';
        this.state.set({ submitting: false, errorMessage: message });
      },
    });
  }

  public setError(message: string): void {
    this.state.set({ submitting: false, errorMessage: message });
  }
}
