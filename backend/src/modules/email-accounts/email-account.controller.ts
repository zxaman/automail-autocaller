import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/app-error';
import { sendSuccess } from '../../shared/http/api-response';
import type { AuthContext } from '../auth/auth.types';
import type { EmailAccountService } from './email-account.service';
import type { ConnectAccountBody, SendTestEmailBody } from './email-account.validation';

/** HTTP boundary for connected email accounts. */
export class EmailAccountController {
  constructor(private readonly accountService: EmailAccountService) {}

  public list: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const auth = this.requireAuth(req.auth);
        const accounts = await this.accountService.list({ workspaceId: auth.workspaceId });

        sendSuccess(res, 200, 'Email accounts retrieved successfully', { items: accounts });
      } catch (error) {
        next(error);
      }
    })();
  };

  public connect: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const auth = this.requireAuth(req.auth);
        const body = req.body as ConnectAccountBody;

        const account = await this.accountService.connect(
          { workspaceId: auth.workspaceId },
          auth.userId,
          body,
        );

        sendSuccess(res, 201, 'Gmail account connected successfully', account);
      } catch (error) {
        next(error);
      } finally {
        // The parsed body has held the plaintext App Password for the duration
        // of this request. Clearing it keeps it out of anything that might
        // later serialize the request object.
        if (req.body && typeof req.body === 'object') {
          delete (req.body as Record<string, unknown>)['appPassword'];
        }
      }
    })();
  };

  public verify: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const auth = this.requireAuth(req.auth);
        const account = await this.accountService.verifyStored(
          { workspaceId: auth.workspaceId },
          this.accountId(req.params['id']),
        );

        sendSuccess(res, 200, 'Email account verified successfully', account);
      } catch (error) {
        next(error);
      }
    })();
  };

  public sendTest: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const auth = this.requireAuth(req.auth);
        const body = req.body as SendTestEmailBody;

        const result = await this.accountService.sendTestEmail(
          { workspaceId: auth.workspaceId },
          this.accountId(req.params['id']),
          body.to,
        );

        sendSuccess(res, 200, `Test email sent to ${result.sentTo}`, result);
      } catch (error) {
        next(error);
      }
    })();
  };

  public setDefault: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const auth = this.requireAuth(req.auth);
        const account = await this.accountService.setDefault(
          { workspaceId: auth.workspaceId },
          this.accountId(req.params['id']),
        );

        sendSuccess(res, 200, 'Default sending account updated', account);
      } catch (error) {
        next(error);
      }
    })();
  };

  public disconnect: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const auth = this.requireAuth(req.auth);
        await this.accountService.disconnect(
          { workspaceId: auth.workspaceId },
          this.accountId(req.params['id']),
        );

        sendSuccess(res, 200, 'Email account disconnected', { disconnected: true });
      } catch (error) {
        next(error);
      }
    })();
  };

  private accountId(value: unknown): string {
    return String(value ?? '');
  }

  private requireAuth(auth: AuthContext | undefined): AuthContext {
    if (!auth) {
      throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
    }
    return auth;
  }
}
