import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { FIELD_OPTIONS, type ColumnAssignment } from '../../models/import.model';
import type { EditableColumnMapping } from '../../import-wizard-page/import-wizard-page.model';

/**
 * The mapping table: one row per spreadsheet column, showing what the server
 * guessed, why, and sample values so the user can judge it at a glance.
 */
@Component({
  selector: 'app-import-column-mapper',
  standalone: true,
  templateUrl: './import-column-mapper.component.html',
  styleUrl: './import-column-mapper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportColumnMapperComponent {
  public readonly rows = input.required<readonly EditableColumnMapping[]>();
  public readonly disabled = input(false);
  public readonly fieldAssigned = output<{ columnIndex: number; field: ColumnAssignment }>();
  public readonly suggestionConfirmed = output<number>();

  protected readonly fieldOptions = FIELD_OPTIONS;

  protected onFieldChange(columnIndex: number, value: string): void {
    const field = (value === '' ? null : value) as ColumnAssignment;
    this.fieldAssigned.emit({ columnIndex, field });
  }

  protected needsAttention(row: EditableColumnMapping): boolean {
    return row.requiresConfirmation && !row.confirmed;
  }

  protected confidenceLabel(row: EditableColumnMapping): string {
    switch (row.confidence) {
      case 'high':
        return 'Confident';
      case 'medium':
        return 'Likely';
      case 'low':
        return 'Unsure';
      default:
        return 'No match';
    }
  }
}
