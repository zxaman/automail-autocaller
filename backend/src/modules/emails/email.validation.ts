import { z } from 'zod';

import { MAX_ATTACHMENTS_PER_EMAIL, MAX_RECIPIENTS_PER_SEND } from './email.service';

const objectId = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Enter a template name').max(120),
  subject: z.string().trim().min(1, 'Enter a subject').max(500),
  bodyHtml: z.string().min(1, 'Enter the email body').max(100_000),
});

export const createSignatureSchema = z.object({
  name: z.string().trim().min(1, 'Enter a signature name').max(120),
  bodyHtml: z.string().min(1, 'Enter the signature content').max(20_000),
  isDefault: z.boolean().default(false),
});

export const composeEmailSchema = z.object({
  contactIds: z
    .array(objectId)
    .min(1, 'Select at least one recipient')
    .max(MAX_RECIPIENTS_PER_SEND, `Select at most ${MAX_RECIPIENTS_PER_SEND} recipients`),
  emailAccountId: objectId.optional(),
  templateId: objectId.optional(),
  signatureId: objectId.optional(),
  subject: z.string().trim().min(1, 'Enter a subject').max(500),
  bodyHtml: z.string().min(1, 'Enter the email body').max(100_000),
  attachmentIds: z.array(objectId).max(MAX_ATTACHMENTS_PER_EMAIL).default([]),
});

export const previewEmailSchema = z.object({
  contactId: objectId,
  subject: z.string().trim().min(1, 'Enter a subject').max(500),
  bodyHtml: z.string().min(1, 'Enter the email body').max(100_000),
  signatureId: objectId.optional(),
});

export const listEmailsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['draft', 'queued', 'sending', 'sent', 'failed']).optional(),
  contactId: objectId.optional(),
});

export type CreateTemplateBody = z.infer<typeof createTemplateSchema>;
export type CreateSignatureBody = z.infer<typeof createSignatureSchema>;
export type ComposeEmailBody = z.infer<typeof composeEmailSchema>;
export type PreviewEmailBody = z.infer<typeof previewEmailSchema>;
export type ListEmailsQuery = z.infer<typeof listEmailsSchema>;
