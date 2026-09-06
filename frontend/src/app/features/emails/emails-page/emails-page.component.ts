import { ChangeDetectionStrategy, Component } from '@angular/core';

import { UiComingSoonComponent } from '../../../shared/components/ui-coming-soon/ui-coming-soon.component';
import { UiPageHeaderComponent } from '../../../shared/components/ui-page-header/ui-page-header.component';

/** Emails feature shell. Data behaviour is delivered in Phase 8. */
@Component({
  selector: 'app-emails-page',
  standalone: true,
  imports: [UiComingSoonComponent, UiPageHeaderComponent],
  templateUrl: './emails-page.component.html',
  styleUrl: './emails-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailsPageComponent {
  protected readonly phase = 'Phase 8';
  protected readonly summary = 'Gmail App Password connection, composer, personalization, queue, and email history.';
  protected readonly capabilities: readonly string[] = [
        'Connect Gmail accounts with a server-verified App Password',
        'Composer with template, signature, and saved attachments',
        'Per-recipient email jobs so recipients never see each other',
        'Throttled queue with per-message status tracking',  ];
}
