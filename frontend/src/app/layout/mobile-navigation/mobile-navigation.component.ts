import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NavigationService } from '../../core/services/navigation.service';
import { UiIconComponent } from '../../shared/components/ui-icon/ui-icon.component';

/** Bottom navigation shown on small screens and in the Capacitor shell. */
@Component({
  selector: 'app-mobile-navigation',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, UiIconComponent],
  templateUrl: './mobile-navigation.component.html',
  styleUrl: './mobile-navigation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileNavigationComponent {
  private readonly navigationService = inject(NavigationService);
  protected readonly items = this.navigationService.mobileItems;
}
