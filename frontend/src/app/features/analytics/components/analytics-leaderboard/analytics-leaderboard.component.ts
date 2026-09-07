import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { UiEmptyStateComponent } from '../../../../shared/components/ui-empty-state/ui-empty-state.component';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';
import type { MostContactedEntry } from '../../models/analytics.model';

/** Ranked list of the most contacted people in the selected range. */
@Component({
  selector: 'app-analytics-leaderboard',
  standalone: true,
  imports: [RouterLink, UiEmptyStateComponent, RelativeTimePipe],
  templateUrl: './analytics-leaderboard.component.html',
  styleUrl: './analytics-leaderboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsLeaderboardComponent {
  public readonly entries = input.required<readonly MostContactedEntry[]>();
}
