import { createServer } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { ensureSchema } from './db/database.js';
import { attachTerminalGateway } from './terminal/terminalGateway.js';

// Long-running server (local development, Railway, Docker, ...). Verifies the
// database is reachable, then serves the API and the interactive-terminal
// WebSocket. On Vercel the app is served by `vercel.ts` instead.
await ensureSchema();

const server = createServer(app);
attachTerminalGateway(server);

server.listen(env.port, '0.0.0.0', () => {
  console.log(`CodeMentor API listening on http://localhost:${env.port}`);
});
