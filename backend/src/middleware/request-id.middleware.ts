import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';
const MAX_REQUEST_ID_LENGTH = 128;

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const suppliedRequestId = req.header(REQUEST_ID_HEADER)?.trim();
  const requestId = suppliedRequestId && suppliedRequestId.length <= MAX_REQUEST_ID_LENGTH
    ? suppliedRequestId
    : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};
