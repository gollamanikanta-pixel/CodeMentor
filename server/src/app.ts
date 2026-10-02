import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { optionalAuth } from './auth/auth.js';
import { apiRouter } from './routes/index.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const app = express();

// In long-running environments (Railway, Docker) that are not Vercel,
// serve the pre-built React app from this same process.
const serveStatic = !process.env.VERCEL && env.nodeEnv === 'production';

// Behind Vercel (or another reverse proxy) the real client IP is in
// X-Forwarded-For; trusting it is needed for rate limits and secure cookies.
// Never enabled by default, so a directly exposed server can't be spoofed.
if (process.env.VERCEL || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

// Security headers — relax CSP when serving the React SPA so
// scripts/styles load correctly.
app.use(
  helmet({
    contentSecurityPolicy: serveStatic
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'", 'wss:', 'ws:'],
            fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            workerSrc: ["'self'", 'blob:'],
            frameSrc: ["'none'"],
          },
        }
      : false,
  }),
);

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

// API routes
app.use('/api', apiRouter);

// Serve the compiled React app in long-running environments (Railway, Docker).
// In Vercel the static assets are handled by the CDN layer, not this process.
if (serveStatic) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(distPath));
  // SPA fallback — any non-API path gets index.html so React Router works.
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Handle unknown routes
app.use(notFoundHandler);

// Error handling
app.use(errorHandler);
