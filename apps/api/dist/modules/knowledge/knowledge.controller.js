import { searchSchema } from './knowledge.schema.js';
export class KnowledgeController {
    service;
    constructor(service) {
        this.service = service;
    }
    search = async (req, res) => {
        const payload = searchSchema.parse(req.body);
        const result = await this.service.search(payload);
        res.status(200).json(result);
    };
    stats = async (_req, res) => {
        const result = await this.service.getStats();
        res.status(200).json(result);
    };
    health = async (_req, res) => {
        const result = await this.service.healthCheck();
        res.status(200).json(result);
    };
    // 环境验证端点（内部使用）
    validate = async (_req, res) => {
        const isValid = await this.service.validateEnvironment();
        res.status(200).json({
            success: true,
            pythonAvailable: isValid,
            timestamp: new Date().toISOString(),
        });
    };
}
//# sourceMappingURL=knowledge.controller.js.map