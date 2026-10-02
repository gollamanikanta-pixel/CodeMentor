import { Router } from 'express';
import { cancelExecution, getExecution, getExecutionCapabilities, getExecutionUsage, postExecution, postSecureRun } from '../controllers/apiControllers.js';
import { requireAuth, requireCsrf } from '../auth/auth.js';
import { providerLimiter } from '../middleware/rateLimit.js';

export const executionRoutes = Router();

executionRoutes.get('/execution-usage', getExecutionUsage);
executionRoutes.get('/execution-capabilities', getExecutionCapabilities);

// Secure runs are provider-backed, so they require a signed-in learner and a CSRF token.
executionRoutes.post('/run', requireAuth, requireCsrf, postSecureRun);

// v2: authenticated, project-aware execution with durable job history.
executionRoutes.post('/executions', providerLimiter, requireAuth, requireCsrf, postExecution);
executionRoutes.get('/executions/:jobId', requireAuth, getExecution);
executionRoutes.post('/executions/:jobId/cancel', requireAuth, requireCsrf, cancelExecution);
