import { Router, type RequestHandler } from 'express';

import { validate } from '../middleware/validate.middleware';
import type { EmailAccountModule } from '../modules/email-accounts/email-account.module';
import {
  connectAccountSchema,
  sendTestEmailSchema,
} from '../modules/email-accounts/email-account.validation';

export function createEmailAccountRouter(
  emailAccountModule: EmailAccountModule,
  authenticate: RequestHandler,
  strictRateLimit: RequestHandler,
): Router {
  const router = Router();
  const controller = emailAccountModule.emailAccountController;

  router.get('/email-accounts', authenticate, controller.list);

  // Rate limited: this endpoint accepts secrets and talks to Gmail, so it is
  // the natural target for credential stuffing.
  router.post(
    '/email-accounts',
    authenticate,
    strictRateLimit,
    validate(connectAccountSchema),
    controller.connect,
  );

  router.post('/email-accounts/:id/verify', authenticate, strictRateLimit, controller.verify);

  router.post(
    '/email-accounts/:id/test',
    authenticate,
    strictRateLimit,
    validate(sendTestEmailSchema),
    controller.sendTest,
  );

  router.patch('/email-accounts/:id/default', authenticate, controller.setDefault);

  router.delete('/email-accounts/:id', authenticate, controller.disconnect);

  return router;
}
