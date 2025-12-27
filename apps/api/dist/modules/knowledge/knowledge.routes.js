import { Router } from 'express';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeService } from './knowledge.service.js';
import { asyncHandler } from '../../utils/async-handler.js';
export const createKnowledgeRouter = (context) => {
    const router = Router();
    const service = new KnowledgeService({ env: context.env, logger: context.logger });
    const controller = new KnowledgeController(service);
    // 搜索知识库
    router.post('/search', asyncHandler(controller.search));
    // 获取统计信息
    router.get('/stats', asyncHandler(controller.stats));
    // 健康检查
    router.get('/health', asyncHandler(controller.health));
    // 环境验证（内部调试）
    router.get('/validate', asyncHandler(controller.validate));
    return router;
};
//# sourceMappingURL=knowledge.routes.js.map