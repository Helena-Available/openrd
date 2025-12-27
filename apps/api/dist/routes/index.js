import { Router } from 'express';
import { getPool } from '../db/pool.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { aiChatRoutes } from './ai-chat.routes.js';
import { medicalHistoryRoutes } from './medical-history.routes.js';
import { asyncHandler } from '../utils/async-handler.js';
import { createKnowledgeRouter } from '../modules/knowledge/knowledge.routes.js';
export const registerRoutes = (app, context) => {
    const apiRouter = Router();
    apiRouter.get('/healthz', asyncHandler(async (_req, res) => {
        try {
            await getPool().query('SELECT 1');
            res.status(200).json({ status: 'ok', database: 'connected' });
        }
        catch (error) {
            context.logger.error({ error }, 'Database health check failed');
            res.status(503).json({ status: 'degraded', database: 'unreachable' });
        }
    }));
    apiRouter.use('/auth', createAuthRouter(context));
    apiRouter.use('/ai', aiChatRoutes);
    apiRouter.use('/knowledge', createKnowledgeRouter(context));
    apiRouter.use('/medical-history', medicalHistoryRoutes);
    app.use('/api', apiRouter);
};
//# sourceMappingURL=index.js.map