import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/app-error';
import type { AuthContext } from '../auth/auth.types';
import { sendSuccess } from '../../shared/http/api-response';
import { toImportBatchDto } from './import.mapper';
import type { ImportRepository } from './import.repository';
import type { ImportService } from './import.service';
import type { ImportCommitInput } from './import.validation';

/** HTTP boundary for imports. No parsing or mapping logic lives here. */
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly importRepository: ImportRepository,
  ) {}

  public analyze: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const auth = this.requireAuth(req.auth);

        if (!req.file) {
          throw new AppError('Attach a spreadsheet to import', 400, 'IMPORT_FILE_MISSING');
        }

        const query = req.query as { sheetName?: string };
        const analysis = await this.importService.analyze(
          { workspaceId: auth.workspaceId },
          auth.userId,
          {
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            buffer: req.file.buffer,
          },
          query.sheetName,
        );

        sendSuccess(res, 200, 'File analyzed successfully', analysis);
      } catch (error) {
        next(error);
      }
    })();
  };

  public commit: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const auth = this.requireAuth(req.auth);
        const body = req.body as ImportCommitInput;

        const result = await this.importService.commit(
          { workspaceId: auth.workspaceId },
          auth.userId,
          body,
        );

        sendSuccess(res, 201, 'Contacts imported successfully', result);
      } catch (error) {
        next(error);
      }
    })();
  };

  public history: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const auth = this.requireAuth(req.auth);
        const { limit } = req.query as unknown as { limit: number };

        const batches = await this.importRepository.listBatches(
          { workspaceId: auth.workspaceId },
          limit,
        );

        sendSuccess(res, 200, 'Import history retrieved successfully', {
          items: batches.map(toImportBatchDto),
        });
      } catch (error) {
        next(error);
      }
    })();
  };

  public getBatch: RequestHandler = (req, res, next) => {
    void (async () => {
      try {
        const auth = this.requireAuth(req.auth);
        const batchId = String(req.params['id'] ?? '');

        const batch = await this.importRepository.findBatchById(
          { workspaceId: auth.workspaceId },
          batchId,
        );

        // 404 rather than 403, so the API never confirms a foreign id exists.
        if (!batch) {
          throw new AppError('The import was not found', 404, 'IMPORT_BATCH_NOT_FOUND');
        }

        sendSuccess(res, 200, 'Import retrieved successfully', toImportBatchDto(batch));
      } catch (error) {
        next(error);
      }
    })();
  };

  private requireAuth(auth: AuthContext | undefined): AuthContext {
    if (!auth) {
      throw new AppError('Authentication is required', 401, 'UNAUTHENTICATED');
    }
    return auth;
  }
}
