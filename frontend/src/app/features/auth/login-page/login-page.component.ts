import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';

import { UiLoadingSpinnerComponent } from '../../../shared/components/ui-loading-spinner/ui-loading-spinner.component';
import type { LoginRedirectReason } from './login-page.model';
import { LoginPageService } from './login-page.service';

/**
 * Google-only sign-in screen.
 *
 * The official Google Identity Services button is rendered so the flow matches
 * Google's branding and security requirements. No password field exists, and no
 * session is ever simulated on the client.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [MatProgressBarModule, MatButtonModule, UiLoadingSpinnerComponent],
  providers: [LoginPageService],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent implements AfterViewInit {
  private readonly loginPageService = inject(LoginPageService);

  /** Bound from the query string by `withComponentInputBinding()`. */
  public readonly returnUrl = input<string>('/dashboard');
  public readonly reason = input<LoginRedirectReason>(null);

  private readonly googleButton = viewChild.required<ElementRef<HTMLElement>>('googleButton');

  protected readonly isSubmitting = this.loginPageService.isSubmitting;
  protected readonly isUnavailable = this.loginPageService.isUnavailable;
  protected readonly isInitializing = this.loginPageService.isInitializing;
  protected readonly errorMessage = this.loginPageService.errorMessage;
  protected readonly isDevMode = this.loginPageService.isDevMode;

  public ngAfterViewInit(): void {
    this.loginPageService.mountGoogleButton(
      this.googleButton().nativeElement,
      this.returnUrl() || '/dashboard',
    );
  }

  protected loginAsDev(): void {
    this.loginPageService.loginAsDev();
  }
}
