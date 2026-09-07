import { Router, type RequestHandler } from 'express';

import { uploadAttachment } from '../middleware/upload.middleware';
import { validate, validateQuery } from '../middleware/validate.middleware';
import type { EmailModule } from '../modules/emails/email.module';
import {
  composeEmailSchema,
  createSignatureSchema,
  createTemplateSchema,
  listEmailsSchema,
  previewEmailSchema,
} from '../modules/emails/email.validation';

export function createEmailRouter(
  emailModule: EmailModule,
  authenticate: RequestHandler,
  sendRateLimit: RequestHandler,
): Router {
  const router = Router();
  const controller = emailModule.emailController;

  router.use('/emails', authenticate);
  router.use('/email-templates', authenticate);
  router.use('/email-signatures', authenticate);
  router.use('/email-attachments', authenticate);

  // Templates
  router.get('/email-templates', controller.listTemplates);
  router.post('/email-templates', validate(createTemplateSchema), controller.createTemplate);
  router.put('/email-templates/:id', validate(createTemplateSchema), controller.updateTemplate);
  router.delete('/email-templates/:id', controller.deleteTemplate);

  // Signatures
  router.get('/email-signatures', controller.listSignatures);
  router.post('/email-signatures', validate(createSignatureSchema), controller.createSignature);
  router.delete('/email-signatures/:id', controller.deleteSignature);

  // Attachment library
  router.get('/email-attachments', controller.listAttachments);
  router.post('/email-attachments', uploadAttachment('file'), controller.uploadAttachment);
  router.delete('/email-attachments/:id', controller.deleteAttachment);

  // Composing. Sending is rate limited so a scripted client cannot push the
  // workspace past Gmail's daily allowance in a few seconds.
  router.post('/emails/preview', validate(previewEmailSchema), controller.preview);
  router.post('/emails/send', sendRateLimit, validate(composeEmailSchema), controller.compose);

  // History
  router.get('/emails', validateQuery(listEmailsSchema), controller.list);
  router.get('/emails/:id', controller.getById);
  router.post('/emails/:id/retry', sendRateLimit, controller.retry);

  return router;
}
