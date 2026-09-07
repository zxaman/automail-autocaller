import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Consistent page title block used by every feature page. */
@Component({
  selector: 'app-ui-page-header',
  standalone: true,
  templateUrl: './ui-page-header.component.html',
  styleUrl: './ui-page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiPageHeaderComponent {
  public readonly title = input.required<string>();
  public readonly description = input<string | null>(null);
}
