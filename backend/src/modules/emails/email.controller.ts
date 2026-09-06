import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/app-error';
import { sendSuccess } from '../../shared/http/api-response';
import type { AuthContext } from '../auth/auth.types';
import type { EmailService } from './email.service';
import type {
  ComposeEmailBody,
  CreateSignatureBody,
  CreateTemplateBody,
  ListEmailsQuery,
  PreviewEmailBody,
} from './email.validation';

/** HTTP boundary for the composer, the template library, and email history. */
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  // --- templates -----------------------------------------------------------

  public listTemplates: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const items = await this.emailService.listTemplates({ workspaceId: auth.workspaceId });

      sendSuccess(res, 200, 'Templates retrieved successfully', { items });
    });
  };

  public createTemplate: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const template = await this.emailService.createTemplate(
        { workspaceId: auth.workspaceId },
        auth.userId,
        req.body as CreateTemplateBody,
      );

      sendSuccess(res, 201, 'Template created successfully', template);
    });
  };

  public updateTemplate: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const template = await this.emailService.updateTemplate(
        { workspaceId: auth.workspaceId },
        this.requireParam(req.params['id']),
        req.body as CreateTemplateBody,
      );

      sendSuccess(res, 200, 'Template updated successfully', template);
    });
  };

  public deleteTemplate: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      await this.emailService.deleteTemplate(
        { workspaceId: auth.workspaceId },
        this.requireParam(req.params['id']),
      );

      sendSuccess(res, 200, 'Template deleted successfully', { deleted: true });
    });
  };

  // --- signatures ----------------------------------------------------------

  public listSignatures: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const items = await this.emailService.listSignatures({ workspaceId: auth.workspaceId });

      sendSuccess(res, 200, 'Signatures retrieved successfully', { items });
    });
  };

  public createSignature: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const signature = await this.emailService.createSignature(
        { workspaceId: auth.workspaceId },
        auth.userId,
        req.body as CreateSignatureBody,
      );

      sendSuccess(res, 201, 'Signature created successfully', signature);
    });
  };

  public deleteSignature: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      await this.emailService.deleteSignature(
        { workspaceId: auth.workspaceId },
        this.requireParam(req.params['id']),
      );

      sendSuccess(res, 200, 'Signature deleted successfully', { deleted: true });
    });
  };

  // --- attachments ---------------------------------------------------------

  public listAttachments: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const items = await this.emailService.listAttachments({ workspaceId: auth.workspaceId });

      sendSuccess(res, 200, 'Attachments retrieved successfully', { items });
    });
  };

  public uploadAttachment: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);

      if (!req.file) {
        throw new AppError('Choose a file to upload', 400, 'ATTACHMENT_FILE_MISSING');
      }

      const attachment = await this.emailService.uploadAttachment(
        { workspaceId: auth.workspaceId },
        auth.userId,
        req.file,
      );

      sendSuccess(res, 201, 'Attachment uploaded successfully', attachment);
    });
  };

  public deleteAttachment: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      await this.emailService.deleteAttachment(
        { workspaceId: auth.workspaceId },
        this.requireParam(req.params['id']),
      );

      sendSuccess(res, 200, 'Attachment deleted successfully', { deleted: true });
    });
  };

  // --- composing -----------------------------------------------------------

  public preview: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const preview = await this.emailService.preview(
        { workspaceId: auth.workspaceId },
        req.body as PreviewEmailBody,
      );

      sendSuccess(res, 200, 'Preview generated successfully', preview);
    });
  };

  public compose: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const result = await this.emailService.compose(
        { workspaceId: auth.workspaceId },
        auth.userId,
        req.body as ComposeEmailBody,
      );

      sendSuccess(res, 202, `${result.queued} email(s) queued for sending`, result);
    });
  };

  // --- history -------------------------------------------------------------

  public list: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const query = req.query as unknown as ListEmailsQuery;
      const result = await this.emailService.listEmails({ workspaceId: auth.workspaceId }, query);

      sendSuccess(res, 200, 'Emails retrieved successfully', result);
    });
  };

  public getById: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const email = await this.emailService.getEmail(
        { workspaceId: auth.workspaceId },
        this.requireParam(req.params['id']),
      );

      sendSuccess(res, 200, 'Email retrieved successfully', email);
    });
  };

  public retry: RequestHandler = (req, res, next) => {
    void this.run(next, async () => {
      const auth = this.requireAuth(req.auth);
      const email = await this.emailService.retry(
        { workspaceId: auth.workspaceId },
        this.requireParam(req.params['id']),
      );

      sendSuccess(res, 202, 'Email queued for another attempt', email);
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
    if (Array.isArray(value)) {
      throw new AppError('A resource identifier is required', 400, 'INVALID_IDENTIFIER');
    }

    if (!value) {
      throw new AppError('A resource identifier is required', 400, 'INVALID_IDENTIFIER');
    }
    return value;
  }
}
