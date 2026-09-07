import { Router, type RequestHandler } from 'express';

import { validate } from '../middleware/validate.middleware';
import type { ContactModule } from '../modules/contacts/contact.module';
import {
  contactIdParamSchema,
  createContactSchema,
  listContactsQuerySchema,
  updateContactSchema,
} from '../modules/contacts/contact.validation';

/**
 * Contact routes. Authentication is applied to the whole router so no endpoint
 * can be added later without it.
 */
export function createContactRouter(
  contactModule: ContactModule,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  const { contactController } = contactModule;

  router.use('/contacts', authenticate);

  router.get('/contacts', validate(listContactsQuerySchema, 'query'), contactController.list);
  router.get('/contacts/tags', contactController.listTags);
  router.post('/contacts', validate(createContactSchema), contactController.create);
  router.get(
    '/contacts/:id',
    validate(contactIdParamSchema, 'params'),
    contactController.getById,
  );
  router.put(
    '/contacts/:id',
    validate(contactIdParamSchema, 'params'),
    validate(updateContactSchema),
    contactController.update,
  );
  router.delete(
    '/contacts/:id',
    validate(contactIdParamSchema, 'params'),
    contactController.remove,
  );

  return router;
}
