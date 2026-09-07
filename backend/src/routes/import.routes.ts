import { Router, type RequestHandler } from 'express';

import { uploadSpreadsheet } from '../middleware/upload.middleware';
import { validate } from '../middleware/validate.middleware';
import type { ImportModule } from '../modules/imports/import.module';
import {
  importAnalyzeQuerySchema,
  importCommitSchema,
  importHistoryQuerySchema,
} from '../modules/imports/import.validation';

export function createImportRouter(
  importModule: ImportModule,
  authenticate: RequestHandler,
): Router {
  const router = Router();

  router.post(
    '/imports/analyze',
    authenticate,
    uploadSpreadsheet('file'),
    validate(importAnalyzeQuerySchema, 'query'),
    importModule.importController.analyze,
  );

  router.post(
    '/imports/commit',
    authenticate,
    validate(importCommitSchema),
    importModule.importController.commit,
  );

  router.get(
    '/imports',
    authenticate,
    validate(importHistoryQuerySchema, 'query'),
    importModule.importController.history,
  );

  router.get('/imports/:id', authenticate, importModule.importController.getBatch);

  return router;
}
