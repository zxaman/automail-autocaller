import { z } from 'zod';

/**
 * The Google ID token is a compact JWS. Length and shape are bounded so a
 * malformed or oversized payload is rejected before any crypto work happens.
 */
export const googleLoginSchema = z.object({
  idToken: z
    .string()
    .min(20, 'A Google credential is required')
    .max(4096, 'The Google credential is too large')
    .regex(/^[A-Za-z0-9._-]+$/, 'The Google credential is malformed'),
});

export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
