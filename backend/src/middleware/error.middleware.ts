import type { ErrorRequestHandler } from 'express';

import { logger } from '../infrastructure/logger/logger';
import { AppError } from '../shared/errors/app-error';

export const errorMiddleware: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = req.requestId;
  const isKnownError = error instanceof AppError;
  const possibleBodyParserError = error as { status?: number; type?: string };
  const isInvalidRequestBody = possibleBodyParserError.type === 'entity.parse.failed';
  const statusCode = isKnownError ? error.statusCode : isInvalidRequestBody ? 400 : 500;
  const code = isKnownError
    ? error.code
    : isInvalidRequestBody
      ? 'INVALID_REQUEST_BODY'
      : 'INTERNAL_SERVER_ERROR';
  const message = isKnownError
    ? error.message
    : isInvalidRequestBody
      ? 'The request body could not be parsed'
      : 'An unexpected error occurred';

  logger.error(
    {
      err: error,
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
    },
    isKnownError || isInvalidRequestBody ? 'Request failed' : 'Unhandled request error',
  );

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      requestId,
      ...(isKnownError && error.details ? { details: error.details } : {}),
    },
  });
};
