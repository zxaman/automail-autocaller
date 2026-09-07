import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import type { DashboardActivityPoint } from '../../dashboard-page/dashboard-page.model';
import { DashboardActivityChartService } from './dashboard-activity-chart.service';

/**
 * Grouped bar chart of daily calls and emails, rendered as inline SVG.
 * Material has no chart primitive, so this is a purpose-built component.
 */
@Component({
  selector: 'app-dashboard-activity-chart',
  standalone: true,
  providers: [DashboardActivityChartService],
  templateUrl: './dashboard-activity-chart.component.html',
  styleUrl: './dashboard-activity-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardActivityChartComponent {
  private readonly chartService = inject(DashboardActivityChartService);

  public readonly points = input.required<readonly DashboardActivityPoint[]>();
  public readonly loading = input(false);

  protected readonly chart = computed(() => this.chartService.build(this.points()));
  /** Dense ranges get every other tick so labels never overlap. */
  protected readonly labelStep = computed(() => (this.chart().bars.length > 14 ? 5 : 1));
}
