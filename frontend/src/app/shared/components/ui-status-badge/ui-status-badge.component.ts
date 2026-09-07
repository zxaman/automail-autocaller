import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { UI_STATUS_TONES, type UiStatusTone } from './ui-status-badge.model';

/** Status pill that always pairs color with a text label for accessibility. */
@Component({
  selector: 'app-ui-status-badge',
  standalone: true,
  templateUrl: './ui-status-badge.component.html',
  styleUrl: './ui-status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiStatusBadgeComponent {
  public readonly status = input.required<string>();
  /** Overrides the automatic tone lookup when a feature needs a specific tone. */
  public readonly tone = input<UiStatusTone | null>(null);

  protected readonly resolvedTone = computed<UiStatusTone>(
    () => this.tone() ?? UI_STATUS_TONES[this.status().toLowerCase().replace(/\s+/g, '')] ?? 'neutral',
  );
}
