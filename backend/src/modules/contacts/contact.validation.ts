import { z } from 'zod';

import { CONTACT_SOURCES } from './contact.model';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullish()
    .transform((value) => value ?? null);

const emailField = z
  .union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email address').max(320)])
  .nullish()
  .transform((value) => (value ? value : null));

const phoneField = z
  .string()
  .trim()
  .max(32)
  .regex(/^[+()\-.\s\d]*$/, 'Enter a valid phone number')
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

const tagsField = z
  .array(z.string().trim().min(1).max(40))
  .max(25, 'A contact can have at most 25 tags')
  .transform((tags) => [...new Set(tags.map((tag) => tag.toLowerCase()))])
  .optional()
  .default([]);

/** At least one reachable channel must exist, otherwise the record is useless. */
const requireChannel = <T extends { phone: string | null; email: string | null }>(value: T, ctx: z.RefinementCtx) => {
  if (!value.phone && !value.email) {
    ctx.addIssue({
      code: 'custom',
      path: ['phone'],
      message: 'Provide at least a phone number or an email address',
    });
  }
};

export const createContactSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(160),
    phone: phoneField,
    email: emailField,
    company: optionalTrimmed(160),
    designation: optionalTrimmed(160),
    location: optionalTrimmed(160),
    tags: tagsField,
    notes: optionalTrimmed(5000),
  })
  .superRefine(requireChannel);

export const updateContactSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(160),
    phone: phoneField,
    email: emailField,
    company: optionalTrimmed(160),
    designation: optionalTrimmed(160),
    location: optionalTrimmed(160),
    tags: tagsField,
    notes: optionalTrimmed(5000),
  })
  .superRefine(requireChannel);

const booleanFlag = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

export const listContactsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // Bounded so a client cannot request an unlimited result set.
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(160).optional(),
  tag: z.string().trim().toLowerCase().max(40).optional(),
  company: z.string().trim().max(160).optional(),
  source: z.enum(CONTACT_SOURCES).optional(),
  hasEmail: booleanFlag,
  hasPhone: booleanFlag,
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'name', 'company', 'lastContactedAt'])
    .default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

/** Rejects a non-ObjectId path parameter before it reaches the database. */
export const contactIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid contact id'),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type ListContactsQueryInput = z.infer<typeof listContactsQuerySchema>;
