import express, { Router, type RequestHandler } from 'express';

import { validate, validateQuery } from '../middleware/validate.middleware';
import type { CallModule } from '../modules/calls/call.module';
import { listCallsSchema, startCallSchema } from '../modules/calls/call.validation';

export function createCallRouter(
  callModule: CallModule,
  authenticate: RequestHandler,
  callRateLimit: RequestHandler,
): Router {
  const router = Router();
  const controller = callModule.callController;

  /**
   * Webhook first, and deliberately before `authenticate`: the provider has no
   * session, so the HMAC signature is what authenticates it.
   *
   * `express.text()` keeps the body verbatim. Parsing it to an object first
   * would re-serialize it differently and break the signature.
   */
  router.post(
    '/webhooks/telephony/:provider',
    express.text({ type: '*/*', limit: '256kb' }),
    controller.webhook,
  );

  router.use('/calls', authenticate);

  // Rate limited: each request places a real, billable phone call.
  router.post('/calls', callRateLimit, validate(startCallSchema), controller.start);

  router.get('/calls', validateQuery(listCallsSchema), controller.list);
  router.get('/calls/:id', controller.getById);
  router.post('/calls/:id/refresh', controller.refresh);
  router.post('/calls/:id/cancel', controller.cancel);

  return router;
}
