import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { UiButtonComponent } from '../ui-button/ui-button.component';
import { UiIconComponent } from '../ui-icon/ui-icon.component';

/** Standard failure panel with a retry affordance. */
@Component({
  selector: 'app-ui-error-state',
  standalone: true,
  imports: [UiButtonComponent, UiIconComponent],
  templateUrl: './ui-error-state.component.html',
  styleUrl: './ui-error-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiErrorStateComponent {
  public readonly title = input<string>('Something went wrong');
  public readonly message = input<string>('The request could not be completed. Please try again.');
  public readonly retryLabel = input<string>('Retry');
  public readonly showRetry = input<boolean>(true);

  public readonly retry = output<void>();
}
