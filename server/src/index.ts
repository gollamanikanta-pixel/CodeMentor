import express from 'express';
import { createServer } from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { ensureSchema } from './db/database.js';
import { optionalAuth } from './auth/auth.js';
import { apiRouter } from './routes/index.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { attachTerminalGateway } from './terminal/terminalGateway.js';

// Accounts and project sync need their tables; the statement is idempotent.
ensureSchema();

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: env.clientOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-csrf-token'],
  }),
);
app.use(cookieParser());
// 512 KB of JSON covers a full multi-file project payload in one request.
app.use(express.json({ limit: '512kb' }));

// Credential-submitting auth POSTs carry their own stricter limiter inside
// authRoutes.ts. The read-only session helpers (`GET /csrf`, `GET /me`) fire on
// every page load and must only meet the general limiter — putting them behind
// the credential budget locked returning learners out of their own login.
app.use(generalLimiter);
app.use(optionalAuth);

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = createServer(app);
attachTerminalGateway(server);

server.listen(env.port, '0.0.0.0', () => {
  console.log(`CodeMentor API listening on http://localhost:${env.port}`);
});
