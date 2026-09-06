import { z } from 'zod';

import { MAX_CUSTOM_RANGE_DAYS } from '../../shared/utils/date-range';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format');

export const dashboardQuerySchema = z
  .object({
    preset: z.enum(['today', 'week', 'month', 'custom']).default('today'),
    // IANA zone names are validated at resolution time, falling back to UTC.
    timezone: z.string().trim().max(64).default('UTC'),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.preset !== 'custom') {
      return;
    }

    if (!value.from || !value.to) {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'A custom range requires both a start and an end date',
      });
      return;
    }

    if (value.from > value.to) {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'The start date must be on or before the end date',
      });
      return;
    }

    const spanDays =
      (Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`)) / 86_400_000 + 1;
    if (spanDays > MAX_CUSTOM_RANGE_DAYS) {
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: `A custom range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days`,
      });
    }
  });

export type DashboardQueryInputSchema = z.infer<typeof dashboardQuerySchema>;
