import type { IncomingMessage, ServerResponse } from 'node:http';
import { app } from './app.js';

// Vercel serverless entry. Vercel functions cannot hold WebSocket upgrades, so
// the interactive terminal (`/api/terminal`) is not available here; it needs the
// long-running server in `index.ts` plus the separate runner service.
export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Routes are mounted under /api; make sure a rewritten URL still carries it.
  if (req.url && !req.url.startsWith('/api')) req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
