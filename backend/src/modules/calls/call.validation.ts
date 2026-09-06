import { z } from 'zod';

const objectId = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const startCallSchema = z.object({
  contactId: objectId,
  /**
   * The provider dials this number first. It is required rather than stored on
   * a profile so an agent working from a different phone is never surprised by
   * which handset rings.
   */
  agentNumber: z
    .string()
    .trim()
    .min(7, 'Enter the phone number to reach you on')
    .max(20, 'Enter a valid phone number'),
});

export const listCallsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z
    .enum(['queued', 'initiated', 'ringing', 'in_progress', 'completed', 'no_answer', 'busy', 'failed', 'canceled'])
    .optional(),
  contactId: objectId.optional(),
});

export type StartCallBody = z.infer<typeof startCallSchema>;
export type ListCallsQuery = z.infer<typeof listCallsSchema>;
