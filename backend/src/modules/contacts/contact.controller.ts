import type { Request, RequestHandler } from 'express';

import { AppError } from '../../shared/errors/app-error';
import { sendSuccess } from '../../shared/http/api-response';
import type { ContactScope } from './contact.repository';
import type { ContactService } from './contact.service';
import type { ContactListQuery } from './contact.types';
import type { CreateContactInput, UpdateContactInput } from './contact.validation';

/** HTTP boundary for contacts. Translates requests to service calls only. */
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  public list: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const result = await this.contactService.list(
          this.scope(req),
          req.query as unknown as ContactListQuery,
        );
        sendSuccess(res, 200, 'Contacts retrieved successfully', result);
      } catch (error) {
        next(error);
      }
    })();
  };

  public listTags: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const tags = await this.contactService.listTags(this.scope(req));
        sendSuccess(res, 200, 'Tags retrieved successfully', { tags });
      } catch (error) {
        next(error);
      }
    })();
  };

  public getById: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const contact = await this.contactService.getById(this.scope(req), req.params['id'] as string);
        sendSuccess(res, 200, 'Contact retrieved successfully', contact);
      } catch (error) {
        next(error);
      }
    })();
  };

  public create: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const auth = this.auth(req);
        const contact = await this.contactService.create(
          { workspaceId: auth.workspaceId },
          auth.userId,
          req.body as CreateContactInput,
        );
        sendSuccess(res, 201, 'Contact created successfully', contact);
      } catch (error) {
        next(error);
      }
    })();
  };

  public update: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const contact = await this.contactService.update(
          this.scope(req),
          req.params['id'] as string,
          req.body as UpdateContactInput,
        );
        sendSuccess(res, 200, 'Contact updated successfully', contact);
      } catch (error) {
        next(error);
      }
    })();
  };

  public remove: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        await this.contactService.delete(this.scope(req), req.params['id'] as string);
        sendSuccess(res, 200, 'Contact deleted successfully', { deleted: true });
      } catch (error) {
        next(error);
      }
    })();
  };

  /** The scope always comes from the verified session, never from the request. */
  private scope(req: Request): ContactScope {
    return { workspaceId: this.auth(req).workspaceId };
  }

  private auth(req: Request) {
    if (!req.auth) {
      throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
    }
    return req.auth;
  }
}
