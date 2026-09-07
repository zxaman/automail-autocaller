/** The contact fields an import can populate. */
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

/** `ignore` is an explicit user choice, distinct from "not yet mapped". */
export type ColumnAssignment = ImportTargetField | 'ignore' | null;

export interface SheetSummary {
  name: string;
  rowCount: number;
}

export interface ParsedSheet {
  sheetName: string;
  /** Raw grid, already trimmed of fully empty trailing rows. */
  rows: string[][];
}

export interface DetectedHeader {
  index: number;
  /** Exactly what the file said, for display. */
  rawLabel: string;
  /** Lowercased, punctuation-stripped, for matching. */
  normalizedLabel: string;
  sampleValues: string[];
}

export interface HeaderDetectionResult {
  /** -1 when the file has no usable header row. */
  headerRowIndex: number;
  hasHeaderRow: boolean;
  headers: DetectedHeader[];
  dataStartRowIndex: number;
  confidence: number;
}

export type MappingConfidence = 'high' | 'medium' | 'low' | 'none';

export interface ColumnSuggestion {
  columnIndex: number;
  rawLabel: string;
  suggestedField: ColumnAssignment;
  confidence: MappingConfidence;
  score: number;
  /** Human-readable justification, shown in the UI next to the suggestion. */
  reason: string;
  requiresConfirmation: boolean;
  sampleValues: string[];
  alternatives: { field: ImportTargetField; score: number }[];
}

export interface ImportAnalysis {
  sessionId: string;
  fileName: string;
  fileSizeBytes: number;
  sheetName: string;
  availableSheets: SheetSummary[];
  hasHeaderRow: boolean;
  headerRowIndex: number;
  totalDataRows: number;
  columns: ColumnSuggestion[];
  previewRows: string[][];
  requiresConfirmation: boolean;
  expiresAt: string;
}

export const DUPLICATE_STRATEGIES = ['skip', 'update', 'import'] as const;
export type DuplicateStrategy = (typeof DUPLICATE_STRATEGIES)[number];

export interface ImportCommitRequest {
  sessionId: string;
  mapping: { columnIndex: number; field: ColumnAssignment }[];
  duplicateStrategy: DuplicateStrategy;
  tags: string[];
}

export type ImportRowStatus = 'created' | 'updated' | 'duplicate' | 'failed';

export interface ImportRowOutcome {
  rowNumber: number;
  status: ImportRowStatus;
  reason?: string;
  contactId?: string;
}

export interface ImportResult {
  batchId: string;
  fileName: string;
  status: 'completed' | 'failed';
  totalRows: number;
  successfulRows: number;
  updatedRows: number;
  duplicateRows: number;
  failedRows: number;
  errors: { rowNumber: number; reason: string }[];
}

/** A single spreadsheet row translated into contact-shaped values. */
export interface ContactDraft {
  rowNumber: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  designation: string | null;
  location: string | null;
  tags: string[];
  notes: string | null;
}
