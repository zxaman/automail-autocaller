import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith, switchMap } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { GoogleIdentityService } from '../../core/services/google-identity.service';
import { LayoutService } from '../../core/services/layout.service';
import { NavigationService } from '../../core/services/navigation.service';
import { NotificationService } from '../../core/services/notification.service';
import { UiAvatarComponent } from '../../shared/components/ui-avatar/ui-avatar.component';
import { UiButtonComponent } from '../../shared/components/ui-button/ui-button.component';
import { UiIconComponent } from '../../shared/components/ui-icon/ui-icon.component';
import { ConfirmDialogService } from '../../shared/dialogs/confirm-dialog/confirm-dialog.service';

/**
 * Application header: page context, quick actions, and the account menu.
 * The account menu uses Material's menu for keyboard and focus semantics.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterLink,
    MatMenuModule,
    MatTooltipModule,
    UiAvatarComponent,
    UiButtonComponent,
    UiIconComponent,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly layoutService = inject(LayoutService);
  private readonly navigationService = inject(NavigationService);
  private readonly notificationService = inject(NotificationService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly googleIdentity = inject(GoogleIdentityService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly user = this.authService.user;
  protected readonly isMobile = this.layoutService.isMobile;
  protected readonly pageTitle = computed(
    () => this.navigationService.findByUrl(this.currentUrl())?.label ?? 'Workspace',
  );

  protected toggleSidebar(): void {
    this.layoutService.toggleSidebar();
  }

  protected logout(): void {
    this.confirmDialog
      .confirm({
        title: 'Sign out?',
        message: 'You will need to sign in with Google again to access this workspace.',
        confirmLabel: 'Sign out',
      })
      .pipe(
        filter((confirmed): confirmed is true => confirmed === true),
        switchMap(() => this.authService.logout()),
      )
      .subscribe(() => {
        // Stops Google from silently re-authenticating on the next visit.
        this.googleIdentity.disableAutoSelect();
        this.notificationService.info('You have been signed out.');
        void this.router.navigate(['/auth/login']);
      });
  }
}
