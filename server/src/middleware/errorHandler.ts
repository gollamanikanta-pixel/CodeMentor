import type { NextFunction, Request, Response } from 'express';

/**
 * Central error handler. It logs a short, secret-free description and always
 * returns a safe, generic message — never a stack trace.
 */
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const label = error instanceof Error ? error.name : 'UnknownError';
  console.error(`safe-api-error: ${label}`);
  res.status(500).json({ message: 'The request could not be completed safely.' });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: 'Route not found.' });
}
