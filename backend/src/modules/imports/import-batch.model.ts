import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export const IMPORT_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export interface ImportRowError {
  rowNumber: number;
  reason: string;
}

export interface ImportBatchAttributes {
  workspaceId: Types.ObjectId;
  ownerId: Types.ObjectId;
  fileName: string;
  fileSizeBytes: number;
  status: ImportStatus;
  totalRows: number;
  successfulRows: number;
  duplicateRows: number;
  failedRows: number;
  errors: ImportRowError[];
  importedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ImportBatchDocument = HydratedDocument<ImportBatchAttributes>;

/**
 * Import audit records. Introduced here for dashboard "recent imports"; the
 * import wizard and row processing arrive in the import phase.
 */
const importBatchSchema = new Schema<ImportBatchAttributes>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true, trim: true, maxlength: 260 },
    fileSizeBytes: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: IMPORT_STATUSES, required: true, default: 'pending' },
    totalRows: { type: Number, default: 0, min: 0 },
    successfulRows: { type: Number, default: 0, min: 0 },
    duplicateRows: { type: Number, default: 0, min: 0 },
    failedRows: { type: Number, default: 0, min: 0 },
    // Bounded at write time so a bad file cannot create an unbounded document.
    errors: { type: [{ rowNumber: Number, reason: String }], default: [] },
    importedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

importBatchSchema.index({ workspaceId: 1, createdAt: -1 });

export const ImportBatchModel: Model<ImportBatchAttributes> = model<ImportBatchAttributes>(
  'ImportBatch',
  importBatchSchema,
);
