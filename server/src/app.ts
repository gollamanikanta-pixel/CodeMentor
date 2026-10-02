import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { optionalAuth } from './auth/auth.js';
import { apiRouter } from './routes/index.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const app = express();

// Behind Vercel (or another reverse proxy) the real client IP is in
// X-Forwarded-For; trusting it is needed for rate limits and `secure` cookies.
// Never enabled by default, so a directly exposed server can't be spoofed.
if (process.env.VERCEL || process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

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
