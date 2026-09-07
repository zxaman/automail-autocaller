export const IMPORT_TARGET_FIELDS = [
  'name',
  'firstName',
  'lastName',
  'phone',
  'email',
  'company',
  'designation',
  'location',
  'tags',
  'notes',
] as const;

export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number];
export type ColumnAssignment = ImportTargetField | 'ignore' | null;

export type MappingConfidence = 'high' | 'medium' | 'low' | 'none';

export interface SheetSummary {
  readonly name: string;
  readonly rowCount: number;
}

export interface ColumnSuggestion {
  readonly columnIndex: number;
  readonly rawLabel: string;
  readonly suggestedField: ColumnAssignment;
  readonly confidence: MappingConfidence;
  readonly score: number;
  readonly reason: string;
  readonly requiresConfirmation: boolean;
  readonly sampleValues: readonly string[];
  readonly alternatives: readonly { field: ImportTargetField; score: number }[];
}

export interface ImportAnalysis {
  readonly sessionId: string;
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly sheetName: string;
  readonly availableSheets: readonly SheetSummary[];
  readonly hasHeaderRow: boolean;
  readonly headerRowIndex: number;
  readonly totalDataRows: number;
  readonly columns: readonly ColumnSuggestion[];
  readonly previewRows: readonly (readonly string[])[];
  readonly requiresConfirmation: boolean;
  readonly expiresAt: string;
}

export const DUPLICATE_STRATEGIES = ['skip', 'update', 'import'] as const;
export type DuplicateStrategy = (typeof DUPLICATE_STRATEGIES)[number];

export interface ImportCommitRequest {
  readonly sessionId: string;
  readonly mapping: readonly { columnIndex: number; field: ColumnAssignment }[];
  readonly duplicateStrategy: DuplicateStrategy;
  readonly tags: readonly string[];
}

export interface ImportResult {
  readonly batchId: string;
  readonly fileName: string;
  readonly status: 'completed' | 'failed';
  readonly totalRows: number;
  readonly successfulRows: number;
  readonly updatedRows: number;
  readonly duplicateRows: number;
  readonly failedRows: number;
  readonly errors: readonly { rowNumber: number; reason: string }[];
}

export interface ImportBatch {
  readonly id: string;
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly status: string;
  readonly totalRows: number;
  readonly successfulRows: number;
  readonly duplicateRows: number;
  readonly failedRows: number;
  readonly errors: readonly { rowNumber: number; reason: string }[];
  readonly importedAt: string | null;
  readonly createdAt: string;
}

/** Field choices offered in the mapping dropdowns. */
export const FIELD_OPTIONS: readonly { value: ColumnAssignment; label: string }[] = [
  { value: 'name', label: 'Full name' },
  { value: 'firstName', label: 'First name' },
  { value: 'lastName', label: 'Last name' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'company', label: 'Company' },
  { value: 'designation', label: 'Designation' },
  { value: 'location', label: 'Location' },
  { value: 'tags', label: 'Tags' },
  { value: 'notes', label: 'Notes' },
  { value: 'ignore', label: "Don't import" },
];

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMPORT_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;
