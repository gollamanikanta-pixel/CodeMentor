import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/database.js';
import { attachTerminalGateway } from './terminal/terminalGateway.js';

// Long-running server (local development, Railway, Docker, ...). Applies the
// schema idempotently (CREATE TABLE IF NOT EXISTS), then serves the API and
// the interactive-terminal WebSocket. On Vercel `vercel.ts` is used instead.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, 'db/schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
await pool.query(schemaSql);
console.log('Database schema ready.');

const server = createServer(app);
attachTerminalGateway(server);

server.listen(env.port, '0.0.0.0', () => {
  console.log(`CodeMentor API listening on http://localhost:${env.port}`);
});
