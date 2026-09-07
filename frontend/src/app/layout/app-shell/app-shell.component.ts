import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LayoutService } from '../../core/services/layout.service';
import { LoadingService } from '../../core/services/loading.service';
import { HeaderComponent } from '../header/header.component';
import { MobileNavigationComponent } from '../mobile-navigation/mobile-navigation.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

/** Authenticated application frame: sidebar, header, content, mobile navigation. */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, MobileNavigationComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly layoutService = inject(LayoutService);
  private readonly loadingService = inject(LoadingService);

  protected readonly isLoading = this.loadingService.isLoading;
  protected readonly isSidebarOpen = this.layoutService.isSidebarOpen;
  protected readonly isDesktop = this.layoutService.isDesktop;

  protected closeSidebar(): void {
    this.layoutService.closeSidebar();
  }
}
