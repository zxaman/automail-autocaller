import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { UiButtonComponent } from '../../../shared/components/ui-button/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui-card/ui-card.component';
import { UiEmptyStateComponent } from '../../../shared/components/ui-empty-state/ui-empty-state.component';
import { UiErrorStateComponent } from '../../../shared/components/ui-error-state/ui-error-state.component';
import { UiMetricCardComponent } from '../../../shared/components/ui-metric-card/ui-metric-card.component';
import { UiPageHeaderComponent } from '../../../shared/components/ui-page-header/ui-page-header.component';
import { UiStatusBadgeComponent } from '../../../shared/components/ui-status-badge/ui-status-badge.component';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { DashboardActivityChartComponent } from '../components/dashboard-activity-chart/dashboard-activity-chart.component';
import { DashboardRangeFilterComponent } from '../components/dashboard-range-filter/dashboard-range-filter.component';
import type { DashboardRangeSelection } from './dashboard-page.model';
import { DashboardPageService } from './dashboard-page.service';

/** Workspace overview: metrics, activity trend, recent history, quick actions. */
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    RouterLink,
    DurationPipe,
    RelativeTimePipe,
    UiButtonComponent,
    UiCardComponent,
    UiEmptyStateComponent,
    UiErrorStateComponent,
    UiMetricCardComponent,
    UiPageHeaderComponent,
    UiStatusBadgeComponent,
    DashboardActivityChartComponent,
    DashboardRangeFilterComponent,
  ],
  providers: [DashboardPageService],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  private readonly dashboardPageService = inject(DashboardPageService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly metrics = this.dashboardPageService.metrics;
  protected readonly snapshot = this.dashboardPageService.snapshot;
  protected readonly activity = this.dashboardPageService.activity;
  protected readonly range = this.dashboardPageService.range;
  protected readonly isLoading = this.dashboardPageService.isLoading;
  protected readonly hasError = this.dashboardPageService.hasError;
  protected readonly errorMessage = this.dashboardPageService.errorMessage;
  protected readonly userName = this.authService.displayName;

  public ngOnInit(): void {
    this.dashboardPageService.load();
  }

  protected reload(): void {
    this.dashboardPageService.load();
  }

  protected changeRange(selection: DashboardRangeSelection): void {
    this.dashboardPageService.changeRange(selection);
  }

  /** Recent rows link through to the contact when the record still has one. */
  protected openContact(contactId: string | null): void {
    if (!contactId) {
      return;
    }
    void this.router.navigate(['/contacts', contactId]);
  }
}
