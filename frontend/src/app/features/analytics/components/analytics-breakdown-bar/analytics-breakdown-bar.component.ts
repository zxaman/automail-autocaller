import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface BreakdownBarItem {
  readonly status: string;
  readonly count: number;
  readonly percent: number;
}

/** Proportional status breakdown, labelled with counts as well as widths. */
@Component({
  selector: 'app-analytics-breakdown-bar',
  standalone: true,
  templateUrl: './analytics-breakdown-bar.component.html',
  styleUrl: './analytics-breakdown-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsBreakdownBarComponent {
  public readonly items = input.required<readonly BreakdownBarItem[]>();
  public readonly emptyMessage = input<string>('No activity in this range');

  /** Statuses render in a fixed colour family so charts stay comparable. */
  protected toneFor(status: string): string {
    if (['completed', 'sent'].includes(status)) {
      return 'positive';
    }
    if (['failed', 'canceled'].includes(status)) {
      return 'negative';
    }
    if (['no_answer', 'busy'].includes(status)) {
      return 'warning';
    }

    return 'neutral';
  }

  protected labelFor(status: string): string {
    return status.replace(/_/g, ' ').replace(/^./, (char) => char.toUpperCase());
  }
}
