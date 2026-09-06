import { ChangeDetectionStrategy, Component } from '@angular/core';

import { UiComingSoonComponent } from '../../../shared/components/ui-coming-soon/ui-coming-soon.component';
import { UiPageHeaderComponent } from '../../../shared/components/ui-page-header/ui-page-header.component';

/** Calls feature shell. Data behaviour is delivered in Phase 9 and 10. */
@Component({
  selector: 'app-calls-page',
  standalone: true,
  imports: [UiComingSoonComponent, UiPageHeaderComponent],
  templateUrl: './calls-page.component.html',
  styleUrl: './calls-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallsPageComponent {
  protected readonly phase = 'Phase 9 and 10';
  protected readonly summary = 'Provider-backed in-app calling, call controls, history, and the calling queue.';
  protected readonly capabilities: readonly string[] = [
        'Provider-backed outgoing calls with real call state',
        'Mute, hold, DTMF, and recording where the provider supports it',
        'Call history with direction, status, and duration filters',
        'Controlled calling queue with explicit user progression',  ];
}
