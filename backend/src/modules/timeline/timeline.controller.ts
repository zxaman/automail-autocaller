import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/app-error';
import { sendSuccess } from '../../shared/http/api-response';
import type { AuthContext } from '../auth/auth.types';
import type { TimelineService } from './timeline.service';
import type { CreateNoteBody, FollowUpQuery, TimelineQueryInput } from './timeline.validation';

/** HTTP boundary for the contact timeline. No business logic lives here. */
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  public getContactTimeline: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const query = req.query as unknown as TimelineQueryInput;

      const result = await this.timelineService.getContactTimeline(
        { workspaceId: auth.workspaceId },
        this.requireParam(req.params['contactId']),
        { limit: query.limit, kinds: query.kinds },
      );

      sendSuccess(res, 200, 'Timeline retrieved successfully', result);
    });
  };

  public addNote: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const body = req.body as CreateNoteBody;

      const entry = await this.timelineService.addNote(
        { workspaceId: auth.workspaceId },
        auth.userId,
        this.requireParam(req.params['contactId']),
        { body: body.body, callId: body.callId ?? null },
      );

      sendSuccess(res, 201, 'Note added', entry);
    });
  };

  public deleteNote: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);

      await this.timelineService.deleteNote(
        { workspaceId: auth.workspaceId },
        this.requireParam(req.params['noteId']),
      );

      sendSuccess(res, 200, 'Note deleted', { deleted: true });
    });
  };

  public followUpDraft: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const query = req.query as unknown as FollowUpQuery;

      const draft = await this.timelineService.buildFollowUpDraft(
        { workspaceId: auth.workspaceId },
        this.requireParam(req.params['contactId']),
        query.callId,
      );

      sendSuccess(res, 200, 'Follow-up draft prepared', draft);
    });
  };

  private requireAuth(auth: AuthContext | undefined): AuthContext {
    if (!auth) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    }

    return auth;
  }

  /** Express 5 params may be arrays; only a single string is acceptable. */
  private requireParam(value: string | string[] | undefined): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new AppError('A valid identifier is required', 400, 'INVALID_IDENTIFIER');
    }

    return value;
  }

  private async run(
    next: (error?: unknown) => void,
    handler: () => Promise<void>,
  ): Promise<void> {
    try {
      await handler();
    } catch (error) {
      next(error);
    }
  }
}
