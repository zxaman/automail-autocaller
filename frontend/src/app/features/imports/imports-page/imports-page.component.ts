import { ChangeDetectionStrategy, Component } from '@angular/core';

import { UiComingSoonComponent } from '../../../shared/components/ui-coming-soon/ui-coming-soon.component';
import { UiPageHeaderComponent } from '../../../shared/components/ui-page-header/ui-page-header.component';

/** Imports feature shell. Data behaviour is delivered in Phase 7. */
@Component({
  selector: 'app-imports-page',
  standalone: true,
  imports: [UiComingSoonComponent, UiPageHeaderComponent],
  templateUrl: './imports-page.component.html',
  styleUrl: './imports-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportsPageComponent {
  protected readonly phase = 'Phase 7';
  protected readonly summary = 'Multi-step import wizard with column mapping, validation, and import batches.';
  protected readonly capabilities: readonly string[] = [
        'Upload XLSX, XLS, and CSV files',
        'Preview rows and map spreadsheet columns to contact fields',
        'Validate missing names, invalid phones and emails, and duplicates',
        'Import batch history with per-row error reporting',  ];
}
