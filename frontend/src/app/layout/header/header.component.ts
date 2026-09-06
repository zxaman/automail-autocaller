import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { NavigationService } from '../../core/services/navigation.service';
import { NotificationService } from '../../core/services/notification.service';
import { UiAvatarComponent } from '../../shared/components/ui-avatar/ui-avatar.component';
import { UiButtonComponent } from '../../shared/components/ui-button/ui-button.component';
import { UiIconComponent } from '../../shared/components/ui-icon/ui-icon.component';

/** Application header: page context, quick actions, and the account menu. */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, UiAvatarComponent, UiButtonComponent, UiIconComponent],
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
  protected readonly menuOpen = signal(false);
  protected readonly pageTitle = computed(
    () => this.navigationService.findByUrl(this.currentUrl())?.label ?? 'Workspace',
  );

  protected toggleSidebar(): void {
    this.layoutService.toggleSidebar();
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected logout(): void {
    this.closeMenu();
    this.authService.logout().subscribe(() => {
      this.notificationService.info('You have been signed out.');
      void this.router.navigate(['/auth/login']);
    });
  }
}
