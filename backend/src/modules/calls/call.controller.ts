import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/app-error';
import { sendSuccess } from '../../shared/http/api-response';
import type { AuthContext } from '../auth/auth.types';
import type { CallService } from './call.service';
import type { ListCallsQuery, StartCallBody } from './call.validation';

/** HTTP boundary for calling. */
export class CallController {
  constructor(private readonly callService: CallService) {}

  public start: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const result = await this.callService.startCall(
        { workspaceId: auth.workspaceId },
        auth.userId,
        req.body as StartCallBody,
      );

      sendSuccess(res, 201, 'Call started', result);
    });
  };

  public list: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const result = await this.callService.listCalls(
        { workspaceId: auth.workspaceId },
        req.query as unknown as ListCallsQuery,
      );

      sendSuccess(res, 200, 'Calls retrieved successfully', result);
    });
  };

  public getById: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const call = await this.callService.getCall(
        { workspaceId: auth.workspaceId },
        this.requireParam(req.params['id']),
      );

      sendSuccess(res, 200, 'Call retrieved successfully', call);
    });
  };

  /** Polled by the calling screen while a call is in flight. */
  public refresh: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const call = await this.callService.refreshCall(
        { workspaceId: auth.workspaceId },
        this.requireParam(req.params['id']),
      );

      sendSuccess(res, 200, 'Call status refreshed', call);
    });
  };

  public cancel: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const call = await this.callService.cancelCall(
        { workspaceId: auth.workspaceId },
        this.requireParam(req.params['id']),
      );

      sendSuccess(res, 200, 'Call canceled', call);
    });
  };

  /**
   * Provider webhook. Unauthenticated by necessity — the provider has no
   * session — so the signature is the only thing that makes it trustworthy.
   */
  public webhook: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const provider = this.requireParam(req.params['provider']);
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});

      const result = await this.callService.handleWebhook(provider, {
        rawBody,
        headers: req.headers,
        url: `${req.protocol}://${req.get('host') ?? ''}${req.originalUrl}`,
      });

      // Always 200 once verified: a non-2xx makes the provider retry, and a
      // duplicate or late event is not a failure worth retrying.
      sendSuccess(res, 200, result.reason, { accepted: result.accepted });
    });
  };

  private async run(next: (error?: unknown) => void, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      next(error);
    }
  }

  private requireAuth(auth: AuthContext | undefined): AuthContext {
    if (!auth) {
      throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
    }
    return auth;
  }

  private requireParam(value: string | string[] | undefined): string {
    if (!value || Array.isArray(value)) {
      throw new AppError('A resource identifier is required', 400, 'INVALID_IDENTIFIER');
    }
    return value;
  }
}
