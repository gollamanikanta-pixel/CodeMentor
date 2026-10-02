
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
// X-Forwarded-For; trusting it is needed for rate limits and secure cookies.
// Never enabled by default, so a directly exposed server can't be spoofed.
if (process.env.VERCEL || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: env.clientOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-csrf-token'],
  }),
);

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '512kb' }));

// General rate limiter
app.use(generalLimiter);

// Optional authentication
app.use(optionalAuth);

// Homepage health-check route
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'CodeMentor API is running successfully!',
    status: 'OK',
  });
});

// API routes
app.use('/api', apiRouter);

// Handle unknown routes
app.use(notFoundHandler);

// Error handling
app.use(errorHandler);
