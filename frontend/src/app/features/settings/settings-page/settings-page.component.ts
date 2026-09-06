import { ChangeDetectionStrategy, Component } from '@angular/core';

import { UiComingSoonComponent } from '../../../shared/components/ui-coming-soon/ui-coming-soon.component';
import { UiPageHeaderComponent } from '../../../shared/components/ui-page-header/ui-page-header.component';

/** Settings feature shell. Data behaviour is delivered in Phase 8 onwards. */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [UiComingSoonComponent, UiPageHeaderComponent],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent {
  protected readonly phase = 'Phase 8 onwards';
  protected readonly summary = 'Profile preferences, Gmail account management, and telephony configuration.';
  protected readonly capabilities: readonly string[] = [
        'Profile and workspace preferences',
        'Connected Gmail accounts with verify, default, update, and disconnect',
        'Telephony provider configuration',
        'Security and session management',  ];
}
