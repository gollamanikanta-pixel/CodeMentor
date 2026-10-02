import { Router } from 'express';
import { z } from 'zod';
import { authWriteLimiter } from '../middleware/rateLimit.js';
import { forgot, login, logout, me, register, requireCsrf, reset, setCsrf } from '../auth/auth.js';

export const authRoutes = Router();

const registration = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().email().max(200),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
    acceptedTerms: z.literal(true),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

authRoutes.get('/csrf', (_req, res) => res.json({ csrfToken: setCsrf(res) }));

// Only routes that submit secrets sit behind the credential-stuffing budget.
// GET /csrf and GET /me below stay under the general limiter so ordinary page
// loads can never drain a learner's login budget.
authRoutes.post('/register', authWriteLimiter, async (req, res) => {
  const parsed = registration.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Please check your registration details.' });
  }
  return register(parsed.data, req, res);
});

authRoutes.post('/login', authWriteLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Please enter a valid email and password.' });
  return login(parsed.data, req, res);
});

authRoutes.post('/logout', requireCsrf, logout);
authRoutes.get('/me', me);

authRoutes.post('/forgot-password', authWriteLimiter, (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  return forgot(parsed.success ? parsed.data.email : '', req, res);
});

authRoutes.post('/reset-password', authWriteLimiter, async (req, res) => {
  const parsed = z
    .object({
      token: z.string().min(20),
      password: z.string().min(8).max(128),
      confirmPassword: z.string().min(8).max(128),
    })
    .safeParse(req.body);
  if (!parsed.success || parsed.data.password !== parsed.data.confirmPassword) {
    return res.status(400).json({ message: 'Please provide matching passwords of at least 8 characters.' });
  }
  return reset(parsed.data.token, parsed.data.password, res);
});
