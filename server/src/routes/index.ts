import { Router } from 'express';
import { aiRoutes } from './aiRoutes.js';
import { executionRoutes } from './executionRoutes.js';
import { authRoutes } from './authRoutes.js';
import { projectRoutes } from './projectRoutes.js';
import { quizRoutes } from './quizRoutes.js';
import { settingsRoutes } from './settingsRoutes.js';
import { providerLimiter } from '../middleware/rateLimit.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ ok: true, service: 'codementor-server' }));

// Accounts and server-side project sync (v2).
apiRouter.use('/auth', authRoutes);
apiRouter.use('/projects', projectRoutes);
apiRouter.use('/quizzes', quizRoutes);
apiRouter.use('/settings', settingsRoutes);

// Secure code execution keeps its provider backstop. AI Deep Help is on-demand
// without an application-level request cap or cooldown.
apiRouter.use('/run', providerLimiter);

apiRouter.use(aiRoutes);
apiRouter.use(executionRoutes);
