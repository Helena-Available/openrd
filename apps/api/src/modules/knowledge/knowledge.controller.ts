import type { Request, Response } from 'express';
import { searchSchema } from './knowledge.schema.js';
import type { KnowledgeService } from './knowledge.service.js';

export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  search = async (req: Request, res: Response) => {
    const payload = searchSchema.parse(req.body);
    const result = await this.service.search(payload);
    res.status(200).json(result);
  };

  stats = async (_req: Request, res: Response) => {
    const result = await this.service.getStats();
    res.status(200).json(result);
  };

  health = async (_req: Request, res: Response) => {
    const result = await this.service.healthCheck();
    res.status(200).json(result);
  };

  // 环境验证端点（内部使用）
  validate = async (_req: Request, res: Response) => {
    const isValid = await this.service.validateEnvironment();
    res.status(200).json({
      success: true,
      pythonAvailable: isValid,
      timestamp: new Date().toISOString(),
    });
  };
}