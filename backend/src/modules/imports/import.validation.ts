import { z } from 'zod';

import { DUPLICATE_STRATEGIES, IMPORT_TARGET_FIELDS } from './import.types';

export const importAnalyzeQuerySchema = z.object({
  sheetName: z.string().trim().max(120).optional(),
});

const columnAssignmentSchema = z.union([
  z.enum(IMPORT_TARGET_FIELDS),
  z.literal('ignore'),
  z.null(),
]);

export const importCommitSchema = z.object({
  sessionId: z.string().uuid('The import session reference is not valid'),
  mapping: z
    .array(
      z.object({
        columnIndex: z.number().int().min(0).max(99),
        field: columnAssignmentSchema,
      }),
    )
    .min(1, 'At least one column must be mapped')
    .max(100),
  duplicateStrategy: z.enum(DUPLICATE_STRATEGIES).default('skip'),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export const importHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ImportCommitInput = z.infer<typeof importCommitSchema>;
