import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { UiToastHostComponent } from './shared/components/ui-toast-host/ui-toast-host.component';

/** Root component. Routing decides whether the shell or auth layout is rendered. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UiToastHostComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
