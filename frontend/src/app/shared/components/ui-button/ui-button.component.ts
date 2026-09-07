import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { UiIconComponent } from '../ui-icon/ui-icon.component';
import type { UiIconName } from '../ui-icon/ui-icon.model';
import type { UiButtonSize, UiButtonType, UiButtonVariant } from './ui-button.model';

/** Shared button with default, hover, focus, pressed, disabled, and loading states. */
@Component({
  selector: 'app-ui-button',
  standalone: true,
  imports: [UiIconComponent],
  templateUrl: './ui-button.component.html',
  styleUrl: './ui-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiButtonComponent {
  public readonly variant = input<UiButtonVariant>('primary');
  public readonly size = input<UiButtonSize>('md');
  public readonly type = input<UiButtonType>('button');
  public readonly disabled = input<boolean>(false);
  public readonly loading = input<boolean>(false);
  public readonly fullWidth = input<boolean>(false);
  public readonly icon = input<UiIconName | null>(null);
  public readonly ariaLabel = input<string | null>(null);

  public readonly pressed = output<MouseEvent>();

  protected readonly isInactive = computed(() => this.disabled() || this.loading());
  protected readonly classes = computed(() => [
    'ui-button',
    `ui-button--${this.variant()}`,
    `ui-button--${this.size()}`,
    this.fullWidth() ? 'ui-button--block' : '',
    this.loading() ? 'is-loading' : '',
  ]);

  protected onClick(event: MouseEvent): void {
    if (this.isInactive()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.pressed.emit(event);
  }
}
