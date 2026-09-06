import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { ImportResult } from '../../models/import.model';

/** Post-import breakdown, including the per-row error list. */
@Component({
  selector: 'app-import-result-summary',
  standalone: true,
  templateUrl: './import-result-summary.component.html',
  styleUrl: './import-result-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportResultSummaryComponent {
  public readonly result = input.required<ImportResult>();

  protected readonly tiles = computed(() => {
    const result = this.result();
    return [
      { id: 'created', label: 'Contacts added', value: result.successfulRows, tone: 'success' },
      { id: 'updated', label: 'Contacts updated', value: result.updatedRows, tone: 'info' },
      { id: 'duplicates', label: 'Duplicates skipped', value: result.duplicateRows, tone: 'warning' },
      { id: 'failed', label: 'Rows with errors', value: result.failedRows, tone: 'danger' },
    ];
  });

  protected readonly hasErrors = computed(() => this.result().errors.length > 0);
}
