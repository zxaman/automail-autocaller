import { ChangeDetectionStrategy, Component } from '@angular/core';

import { UiComingSoonComponent } from '../../../shared/components/ui-coming-soon/ui-coming-soon.component';
import { UiPageHeaderComponent } from '../../../shared/components/ui-page-header/ui-page-header.component';

/** Templates feature shell. Data behaviour is delivered in Phase 8. */
@Component({
  selector: 'app-templates-page',
  standalone: true,
  imports: [UiComingSoonComponent, UiPageHeaderComponent],
  templateUrl: './templates-page.component.html',
  styleUrl: './templates-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplatesPageComponent {
  protected readonly phase = 'Phase 8';
  protected readonly summary = 'Template and signature management with variable personalization.';
  protected readonly capabilities: readonly string[] = [
        'Create, edit, duplicate, and delete templates',
        'Variables such as name, company, and designation',
        'Preview rendered output per recipient',
        'Default signature applied automatically',  ];
}
