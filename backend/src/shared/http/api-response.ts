import type { Response } from 'express';

/** Consistent success envelope used by every controller. */
export function sendSuccess<TData>(
  res: Response,
  statusCode: number,
  message: string,
  data: TData,
): void {
  res.status(statusCode).json({ success: true, message, data });
}
