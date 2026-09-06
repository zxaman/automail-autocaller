import { ChangeDetectionStrategy, Component } from '@angular/core';

import { UiComingSoonComponent } from '../../../shared/components/ui-coming-soon/ui-coming-soon.component';
import { UiPageHeaderComponent } from '../../../shared/components/ui-page-header/ui-page-header.component';
import { EmailAccountsPageComponent } from '../email-accounts-page/email-accounts-page.component';

/** Settings shell. Gmail connection is live; other sections follow in later phases. */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [UiComingSoonComponent, UiPageHeaderComponent, EmailAccountsPageComponent],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent {
  protected readonly phase = 'Phase 9 onwards';
  protected readonly summary = 'Profile preferences and telephony configuration.';
  protected readonly capabilities: readonly string[] = [
    'Profile and workspace preferences',
    'Telephony provider configuration',
    'Security and session management',
  ];
}
