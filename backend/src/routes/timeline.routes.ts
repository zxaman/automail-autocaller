import { Router, type RequestHandler } from 'express';

import { validate, validateQuery } from '../middleware/validate.middleware';
import type { TimelineModule } from '../modules/timeline/timeline.module';
import {
  createNoteSchema,
  followUpQuerySchema,
  timelineQuerySchema,
} from '../modules/timeline/timeline.validation';

export function createTimelineRouter(
  timelineModule: TimelineModule,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  const controller = timelineModule.timelineController;

  /**
   * A timeline is a contact's private history, so every route requires a
   * session. `authenticate` is attached per route rather than with
   * `router.use`, because this router is mounted on the shared `/api/v1` path
   * and a root-level guard would intercept unmatched paths too, turning an
   * unknown-route 404 into a misleading 401.
   */
  router.get(
    '/contacts/:contactId/timeline',
    authenticate,
    validateQuery(timelineQuerySchema),
    controller.getContactTimeline,
  );

  router.get(
    '/contacts/:contactId/follow-up-draft',
    authenticate,
    validateQuery(followUpQuerySchema),
    controller.followUpDraft,
  );

  router.post(
    '/contacts/:contactId/notes',
    authenticate,
    validate(createNoteSchema),
    controller.addNote,
  );

  router.delete('/notes/:noteId', authenticate, controller.deleteNote);

  return router;
}
