import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { UiCardComponent } from '../ui-card/ui-card.component';
import { UiIconComponent } from '../ui-icon/ui-icon.component';
import type { UiIconName } from '../ui-icon/ui-icon.model';

/**
 * Honest placeholder for feature areas whose backend phase is not implemented yet.
 * It states the planned scope instead of showing fabricated data.
 */
@Component({
  selector: 'app-ui-coming-soon',
  standalone: true,
  imports: [UiCardComponent, UiIconComponent],
  templateUrl: './ui-coming-soon.component.html',
  styleUrl: './ui-coming-soon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiComingSoonComponent {
  public readonly icon = input<UiIconName>('inbox');
  public readonly phase = input.required<string>();
  public readonly summary = input.required<string>();
  public readonly capabilities = input<readonly string[]>([]);
}
