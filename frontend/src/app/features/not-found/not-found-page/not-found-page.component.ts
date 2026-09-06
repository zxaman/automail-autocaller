import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { UiButtonComponent } from '../../../shared/components/ui-button/ui-button.component';

/** Fallback route for unknown URLs. */
@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink, UiButtonComponent],
  templateUrl: './not-found-page.component.html',
  styleUrl: './not-found-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPageComponent {}
