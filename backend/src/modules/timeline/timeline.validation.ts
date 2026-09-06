import { z } from 'zod';

const objectId = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const timelineKind = z.enum(['call', 'email', 'note', 'import']);

export const timelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /**
   * Kind filter. Accepts a repeated param (?kinds=call&kinds=note) or a
   * comma-separated list (?kinds=call,note), since clients express it both
   * ways and both are unambiguous here.
   */
  kinds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) {
        return undefined;
      }

      const raw = (Array.isArray(value) ? value : [value])
        .flatMap((item) => item.split(','))
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      const parsed = z.array(timelineKind).safeParse(raw);

      if (!parsed.success) {
        ctx.addIssue({ code: 'custom', message: 'Unknown timeline kind' });
        return z.NEVER;
      }

      return parsed.data;
    }),
});

export const createNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write something before saving the note')
    .max(5000, 'A note is limited to 5000 characters'),
  /** Set when the note records the outcome of a specific call. */
  callId: objectId.nullish(),
});

export const followUpQuerySchema = z.object({
  callId: objectId.optional(),
});

export type TimelineQueryInput = z.infer<typeof timelineQuerySchema>;
export type CreateNoteBody = z.infer<typeof createNoteSchema>;
export type FollowUpQuery = z.infer<typeof followUpQuerySchema>;
