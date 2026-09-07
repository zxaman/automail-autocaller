import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { UiButtonComponent } from '../ui-button/ui-button.component';
import { UiIconComponent } from '../ui-icon/ui-icon.component';
import type { UiIconName } from '../ui-icon/ui-icon.model';

/** Shown when a collection has no records yet. */
@Component({
  selector: 'app-ui-empty-state',
  standalone: true,
  imports: [UiButtonComponent, UiIconComponent],
  templateUrl: './ui-empty-state.component.html',
  styleUrl: './ui-empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiEmptyStateComponent {
  public readonly icon = input<UiIconName>('inbox');
  public readonly title = input.required<string>();
  public readonly description = input<string | null>(null);
  public readonly actionLabel = input<string | null>(null);

  public readonly actionTriggered = output<void>();
}
