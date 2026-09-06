import type { ImportBatchDocument } from './import-batch.model';

export interface ImportBatchDto {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  status: string;
  totalRows: number;
  successfulRows: number;
  duplicateRows: number;
  failedRows: number;
  errors: { rowNumber: number; reason: string }[];
  importedAt: string | null;
  createdAt: string;
}

/** Batch DTOs never expose workspaceId or ownerId. */
export function toImportBatchDto(batch: ImportBatchDocument): ImportBatchDto {
  return {
    id: batch._id.toString(),
    fileName: batch.fileName,
    fileSizeBytes: batch.fileSizeBytes,
    status: batch.status,
    totalRows: batch.totalRows,
    successfulRows: batch.successfulRows,
    duplicateRows: batch.duplicateRows,
    failedRows: batch.failedRows,
    errors: batch.errors.map((entry) => ({ rowNumber: entry.rowNumber, reason: entry.reason })),
    importedAt: batch.importedAt ? batch.importedAt.toISOString() : null,
    createdAt: batch.createdAt.toISOString(),
  };
}
