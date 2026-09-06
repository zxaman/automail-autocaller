import type { ColumnAssignment } from '../models/import.model';

export type WizardStep = 'upload' | 'map' | 'result';

export interface WizardStepDescriptor {
  readonly id: WizardStep;
  readonly label: string;
  readonly description: string;
}

export const WIZARD_STEPS: readonly WizardStepDescriptor[] = [
  { id: 'upload', label: 'Upload', description: 'Choose an Excel or CSV file' },
  { id: 'map', label: 'Map columns', description: 'Confirm how columns become contact fields' },
  { id: 'result', label: 'Done', description: 'Review what was imported' },
];

/** A user-editable mapping row shown in the mapping table. */
export interface EditableColumnMapping {
  readonly columnIndex: number;
  readonly rawLabel: string;
  readonly field: ColumnAssignment;
  readonly reason: string;
  readonly confidence: string;
  readonly requiresConfirmation: boolean;
  readonly sampleValues: readonly string[];
  /** True once the user has explicitly touched this row. */
  readonly confirmed: boolean;
}
