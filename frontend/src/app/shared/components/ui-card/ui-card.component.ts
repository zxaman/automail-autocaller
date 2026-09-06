import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Neutral surface container used by every feature page. */
@Component({
  selector: 'app-ui-card',
  standalone: true,
  templateUrl: './ui-card.component.html',
  styleUrl: './ui-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiCardComponent {
  public readonly title = input<string | null>(null);
  public readonly subtitle = input<string | null>(null);
  public readonly padded = input<boolean>(true);
}
