import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Placeholder block used while data is loading. */
@Component({
  selector: 'app-ui-skeleton',
  standalone: true,
  templateUrl: './ui-skeleton.component.html',
  styleUrl: './ui-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiSkeletonComponent {
  public readonly width = input<string>('100%');
  public readonly height = input<string>('16px');
  public readonly radius = input<string>('var(--radius-sm)');
  public readonly rows = input<number>(1);

  protected get rowList(): readonly number[] {
    return Array.from({ length: Math.max(1, this.rows()) }, (_, index) => index);
  }
}
