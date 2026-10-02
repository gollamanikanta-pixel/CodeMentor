import rateLimit from 'express-rate-limit';

/** Broad protection for every API route. */
export const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  skip: (req) => req.path === '/api/deep-analyze',
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please continue learning locally and try again shortly.' },
});

/**
 * Tighter limiter for the expensive, provider-backed routes. This is a hard
 * backstop on top of the per-day quota and cooldown logic in the services.
 */
export const providerLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many provider requests. Local guidance remains available.' },
});

/**
 * Credential-stuffing backstop for the routes that submit secrets. Only the
 * four credential POSTs sit behind this — never the per-page-load session
 * reads (`GET /csrf`, `GET /me`), which would otherwise drain the budget and
 * lock a returning learner out of their own correct-password login (429).
 */
export const authWriteLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many account requests. Please try again shortly.' },
});
