import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { UI_ICON_PATHS } from './ui-icon.paths';
import type { UiIconName, UiIconSize } from './ui-icon.model';

/**
 * Inline SVG icon set. Icons are bundled locally to avoid an icon-font
 * dependency and to keep the mobile bundle predictable.
 */
@Component({
  selector: 'app-ui-icon',
  standalone: true,
  templateUrl: './ui-icon.component.html',
  styleUrl: './ui-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ui-icon-host' },
})
export class UiIconComponent {
  public readonly name = input.required<UiIconName>();
  public readonly size = input<UiIconSize>('md');
  /** Provide when the icon is the only content of an interactive element. */
  public readonly label = input<string | null>(null);

  protected readonly paths = computed<readonly string[]>(() => UI_ICON_PATHS[this.name()] ?? []);
  protected readonly pixelSize = computed(() => {
    switch (this.size()) {
      case 'sm':
        return 16;
      case 'lg':
        return 24;
      default:
        return 20;
    }
  });
}
