import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Accessible loading indicator for inline and block contexts. */
@Component({
  selector: 'app-ui-loading-spinner',
  standalone: true,
  templateUrl: './ui-loading-spinner.component.html',
  styleUrl: './ui-loading-spinner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiLoadingSpinnerComponent {
  public readonly label = input<string>('Loading');
  public readonly size = input<'sm' | 'md' | 'lg'>('md');
  public readonly centered = input<boolean>(true);
}
