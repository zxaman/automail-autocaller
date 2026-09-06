import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { UiButtonComponent } from '../../../shared/components/ui-button/ui-button.component';
import { LoginPageService } from './login-page.service';

/**
 * Google-only sign-in screen.
 *
 * The Google Identity Services client is wired up in the authentication phase.
 * Until the backend `/auth/google` endpoint and client ID exist, this screen
 * surfaces a clear, honest message instead of simulating a session.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [UiButtonComponent],
  providers: [LoginPageService],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
  private readonly loginPageService = inject(LoginPageService);

  /** Bound from the query string by `withComponentInputBinding()`. */
  public readonly returnUrl = input<string>('/dashboard');
  public readonly reason = input<string | null>(null);

  protected readonly submitting = this.loginPageService.submitting;
  protected readonly errorMessage = this.loginPageService.errorMessage;

  protected continueWithGoogle(): void {
    const credential = this.readGoogleCredential();
    if (!credential) {
      this.loginPageService.setError(
        'Google sign-in is not configured yet. It is enabled in the authentication phase.',
      );
      return;
    }
    this.loginPageService.signInWithGoogle(credential, this.returnUrl() || '/dashboard');
  }

  /**
   * Reads a credential produced by Google Identity Services when it is present.
   * No credential is fabricated when the library is absent.
   */
  private readGoogleCredential(): string | null {
    const google = (globalThis as { google?: { accounts?: unknown } }).google;
    return google?.accounts ? null : null;
  }
}
