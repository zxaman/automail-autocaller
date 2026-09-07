import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NavigationService } from '../../core/services/navigation.service';
import { LayoutService } from '../../core/services/layout.service';
import { UiIconComponent } from '../../shared/components/ui-icon/ui-icon.component';

/** Desktop sidebar and mobile drawer navigation. */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, UiIconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  private readonly navigationService = inject(NavigationService);
  private readonly layoutService = inject(LayoutService);

  protected readonly items = this.navigationService.items;
  protected readonly collapsed = this.layoutService.isSidebarCollapsed;
  protected readonly isOpen = this.layoutService.isSidebarOpen;
  protected readonly isMobile = this.layoutService.isMobile;
  protected readonly showDrawer = computed(() => !this.layoutService.isDesktop() && this.isOpen());

  protected close(): void {
    if (!this.layoutService.isDesktop()) {
      this.layoutService.closeSidebar();
    }
  }
}
