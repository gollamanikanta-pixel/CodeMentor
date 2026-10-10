import type { NextFunction, Request, Response } from 'express';
import { safeDatabaseTarget } from '../db/database.js';

function safeErrorCodes(error: unknown): string[] {
  const codes: string[] = [];
  const pending: unknown[] = [error];
  const visited = new Set<unknown>();

  while (pending.length > 0 && visited.size < 8) {
    const current = pending.shift();
    if (typeof current !== 'object' || current === null || visited.has(current)) continue;
    visited.add(current);

    const details = current as { code?: unknown; errors?: unknown };
    if (typeof details.code === 'string' && /^[A-Z0-9_]+$/.test(details.code)) {
      codes.push(details.code);
    }
    if (Array.isArray(details.errors)) {
      pending.push(...details.errors);
    }
  }

  return [...new Set(codes)];
}

/**
 * Central error handler. It logs a short, secret-free description and always
 * returns a safe, generic message — never a stack trace.
 */
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const label = error instanceof Error ? error.name : 'UnknownError';
  const codes = safeErrorCodes(error);
  const isDatabaseError = codes.some((code) => /^[A-Z0-9]{5}$/.test(code));
  console.error('safe-api-error', {
    name: label,
    ...(codes.length ? { codes } : {}),
    ...(isDatabaseError ? { databaseTarget: safeDatabaseTarget() } : {}),
  });
  res.status(500).json({ message: 'The request could not be completed safely.' });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: 'Route not found.' });
}
