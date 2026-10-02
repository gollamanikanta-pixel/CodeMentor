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

// Only the expensive, provider-backed POST routes get the extra limiter.
// The read-only usage endpoints stay under the global limiter so the header
// and dialogs can safely display fair-use status.
apiRouter.use('/deep-analyze', providerLimiter);
apiRouter.use('/run', providerLimiter);

apiRouter.use(aiRoutes);
apiRouter.use(executionRoutes);
