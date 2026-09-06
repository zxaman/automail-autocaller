import { ChangeDetectionStrategy, Component } from '@angular/core';

import { UiComingSoonComponent } from '../../../shared/components/ui-coming-soon/ui-coming-soon.component';
import { UiPageHeaderComponent } from '../../../shared/components/ui-page-header/ui-page-header.component';

/** Analytics feature shell. Data behaviour is delivered in Phase 12. */
@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [UiComingSoonComponent, UiPageHeaderComponent],
  templateUrl: './analytics-page.component.html',
  styleUrl: './analytics-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPageComponent {
  protected readonly phase = 'Phase 12';
  protected readonly summary = 'Backend aggregation for call and email trends with date range filters.';
  protected readonly capabilities: readonly string[] = [
        'Calls and emails per day and per week',
        'Call and email success rates',
        'Total and average call duration',
        'Today, week, month, and custom range filters',  ];
}
