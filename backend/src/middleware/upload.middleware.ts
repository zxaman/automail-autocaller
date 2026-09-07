import multer from 'multer';
import type { RequestHandler } from 'express';

import { AppError } from '../shared/errors/app-error';

/** 10 MB covers a very large contact sheet while bounding memory per request. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

/**
 * In-memory upload handling.
 *
 * Files are parsed immediately and never persisted, so writing them to disk
 * would only add cleanup obligations and a path-traversal surface. The size cap
 * plus a single-file limit keeps the memory cost predictable.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10 },
  fileFilter: (_req, file, callback) => {
    const name = file.originalname.toLowerCase();
    const isAllowed = ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension));

    if (!isAllowed) {
      callback(
        new AppError(
          'Only .xlsx, .xls, and .csv files can be imported',
          400,
          'IMPORT_UNSUPPORTED_FORMAT',
        ),
      );
      return;
    }

    callback(null, true);
  },
});

/** Wraps multer so its own errors become the API's standard error shape. */
export function uploadSpreadsheet(fieldName: string): RequestHandler {
  const handler = upload.single(fieldName);

  return (req, res, next) => {
    handler(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          next(
            new AppError(
              'The file is larger than the 10 MB limit',
              413,
              'IMPORT_FILE_TOO_LARGE',
            ),
          );
          return;
        }

        next(new AppError('The file could not be uploaded', 400, 'IMPORT_UPLOAD_FAILED'));
        return;
      }

      next(error);
    });
  };
}

/** 10 MB per attachment; Gmail rejects messages far above 25 MB in total. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Attachment uploads.
 *
 * Executables and scripts are refused outright: an attachment library is a
 * convenient way to distribute malware, and a business mailer has no reason to
 * send one.
 */
const BLOCKED_ATTACHMENT_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.cpl', '.dll', '.js', '.jse', '.lnk', '.msi',
  '.ps1', '.scr', '.sh', '.vb', '.vbs', '.wsf', '.jar', '.app', '.deb', '.dmg',
];

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1, fields: 10 },
  fileFilter: (_req, file, callback) => {
    const name = file.originalname.toLowerCase();
    const isBlocked = BLOCKED_ATTACHMENT_EXTENSIONS.some((extension) =>
      name.endsWith(extension),
    );

    if (isBlocked) {
      callback(
        new AppError(
          'This file type cannot be sent as an attachment',
          400,
          'ATTACHMENT_UNSUPPORTED_FORMAT',
        ),
      );
      return;
    }

    callback(null, true);
  },
});

export function uploadAttachment(fieldName: string): RequestHandler {
  const handler = attachmentUpload.single(fieldName);

  return (req, res, next) => {
    handler(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          next(new AppError('The file is larger than the 10 MB limit', 413, 'ATTACHMENT_TOO_LARGE'));
          return;
        }

        next(new AppError('The file could not be uploaded', 400, 'ATTACHMENT_UPLOAD_FAILED'));
        return;
      }

      next(error);
    });
  };
}
