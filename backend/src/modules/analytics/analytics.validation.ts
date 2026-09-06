import { z } from 'zod';

import { DATE_RANGE_PRESETS } from '../../shared/utils/date-range';
import { ANALYTICS_GRANULARITIES } from './analytics.types';

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format');

export const analyticsQuerySchema = z.object({
  preset: z.enum(DATE_RANGE_PRESETS).default('week'),
  /**
   * The client's IANA timezone. Day boundaries are the user's local ones, so
   * without this a late-evening call could be reported on the wrong day.
   */
  timezone: z.string().trim().min(1).max(64).default('UTC'),
  from: isoDate.optional(),
  to: isoDate.optional(),
  /** Omitted means the server picks a bucket size that suits the range. */
  granularity: z.enum(ANALYTICS_GRANULARITIES).optional(),
  /** Size of the most-contacted ranking. */
  leaderboardLimit: z.coerce.number().int().min(1).max(50).optional(),
});

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
