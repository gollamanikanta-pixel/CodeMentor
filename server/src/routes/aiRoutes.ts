import { Router } from 'express';
import { getAiUsage, postAiChat, postDeepAnalyze } from '../controllers/apiControllers.js';
import { requireAuth, requireCsrf } from '../auth/auth.js';
import { providerLimiter } from '../middleware/rateLimit.js';

export const aiRoutes = Router();

// Usage stays readable so the header can show fair-use status signed out.
aiRoutes.get('/ai-usage', getAiUsage);

// AI guidance is provider-backed, so it requires a signed-in learner and a CSRF token.
aiRoutes.post('/deep-analyze', requireAuth, requireCsrf, postDeepAnalyze);
aiRoutes.post('/ai-chat', requireAuth, requireCsrf, providerLimiter, postAiChat);
