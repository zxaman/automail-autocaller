import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { UiIconComponent } from '../ui-icon/ui-icon.component';
import { UiSkeletonComponent } from '../ui-skeleton/ui-skeleton.component';
import type { MetricCardData } from './ui-metric-card.model';

/** Dashboard metric tile with loading support. */
@Component({
  selector: 'app-ui-metric-card',
  standalone: true,
  imports: [UiIconComponent, UiSkeletonComponent],
  templateUrl: './ui-metric-card.component.html',
  styleUrl: './ui-metric-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiMetricCardComponent {
  public readonly metric = input.required<MetricCardData>();
  public readonly loading = input<boolean>(false);
}
