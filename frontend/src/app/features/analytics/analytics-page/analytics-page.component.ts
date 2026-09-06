import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { UiCardComponent } from '../../../shared/components/ui-card/ui-card.component';
import { UiErrorStateComponent } from '../../../shared/components/ui-error-state/ui-error-state.component';
import { UiLoadingSpinnerComponent } from '../../../shared/components/ui-loading-spinner/ui-loading-spinner.component';
import { UiMetricCardComponent } from '../../../shared/components/ui-metric-card/ui-metric-card.component';
import { UiPageHeaderComponent } from '../../../shared/components/ui-page-header/ui-page-header.component';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';
import { DashboardActivityChartComponent } from '../../dashboard/components/dashboard-activity-chart/dashboard-activity-chart.component';
import { DashboardRangeFilterComponent } from '../../dashboard/components/dashboard-range-filter/dashboard-range-filter.component';
import type { DashboardRangeSelection } from '../../dashboard/dashboard-page/dashboard-page.model';
import { AnalyticsBreakdownBarComponent } from '../components/analytics-breakdown-bar/analytics-breakdown-bar.component';
import { AnalyticsLeaderboardComponent } from '../components/analytics-leaderboard/analytics-leaderboard.component';
import { GRANULARITY_OPTIONS, type AnalyticsGranularity } from '../models/analytics.model';
import { AnalyticsPageService } from './analytics-page.service';

/**
 * Analytics.
 *
 * Every number is aggregated server-side; this page only presents them. Each
 * headline metric carries its definition, because a rate without a stated
 * denominator invites two people to read it differently.
 */
@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [
    UiCardComponent,
    UiErrorStateComponent,
    UiLoadingSpinnerComponent,
    UiMetricCardComponent,
    UiPageHeaderComponent,
    DashboardActivityChartComponent,
    DashboardRangeFilterComponent,
    AnalyticsBreakdownBarComponent,
    AnalyticsLeaderboardComponent,
    DurationPipe,
  ],
  providers: [AnalyticsPageService],
  templateUrl: './analytics-page.component.html',
  styleUrl: './analytics-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPageComponent implements OnInit {
  protected readonly state = inject(AnalyticsPageService);
  protected readonly granularityOptions = GRANULARITY_OPTIONS;

  public ngOnInit(): void {
    void this.state.load();
    void this.state.loadDefinitions();
  }

  protected onRangeChange(selection: DashboardRangeSelection): void {
    void this.state.setRange({
      preset: selection.preset,
      from: selection.from,
      to: selection.to,
    });
  }

  protected onGranularityChange(granularity: AnalyticsGranularity): void {
    void this.state.setGranularity(granularity);
  }

  protected definition(key: string): string | null {
    return this.state.definitionFor(key);
  }
}
