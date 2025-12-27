import { spawn } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import path from 'path';
import type { AppEnv } from '../../config/env.js';
import type { AppLogger } from '../../config/logger.js';
import type { SearchInput, SearchResponse, StatsResponse, HealthResponse } from './knowledge.schema.js';
import { AppError } from '../../utils/app-error.js';

const sleep = promisify(setTimeout);

interface KnowledgeServiceDeps {
  env: AppEnv;
  logger: AppLogger;
}

interface PythonBridgeResult {
  success: boolean;
  error?: string;
  stats?: {
    total_chunks?: number;
    language_distribution?: Record<string, number>;
    category_distribution?: Record<string, number>;
    file_type_distribution?: Record<string, number>;
  };
  [key: string]: unknown;
}

export class KnowledgeService {
  private readonly env: AppEnv;
  private readonly logger: AppLogger;
  private readonly pythonPath: string;
  private readonly bridgeScriptPath: string;

  constructor({ env, logger }: KnowledgeServiceDeps) {
    this.env = env;
    this.logger = logger;
    this.pythonPath = env.PYTHON_PATH || 'python3';
    this.bridgeScriptPath = path.resolve(process.cwd(), 'apps/knowledge-base/knowledge_bridge.py');
  }

  private async callPythonBridge(args: string[], input?: object): Promise<PythonBridgeResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.pythonPath, [this.bridgeScriptPath, ...args], {
        stdio: input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      if (input) {
        child.stdin?.write(JSON.stringify(input));
        child.stdin?.end();
      }

      child.on('close', (code) => {
        if (code !== 0) {
          this.logger.error({ stderr, code }, 'Python桥接脚本执行失败');
          reject(new AppError(`Python脚本执行失败: ${stderr || '未知错误'}`, 500));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          this.logger.error({ stdout, error }, 'Python脚本输出解析失败');
          reject(new AppError('Python脚本返回无效JSON', 500));
        }
      });

      child.on('error', (error) => {
        this.logger.error({ error }, '启动Python进程失败');
        reject(new AppError('无法启动Python服务', 503));
      });
    });
  }

  async search(payload: SearchInput): Promise<SearchResponse> {
    this.logger.info({ payload }, '知识库搜索请求');

    try {
      const result = await this.callPythonBridge(['search'], {
        command: 'search',
        question: payload.question,
        n_results: payload.nResults,
        language: payload.language === 'all' ? undefined : payload.language,
      });

      if (!result.success) {
        throw new AppError(result.error || '搜索失败', 500);
      }

      // 转换结果格式以匹配schema
      const searchResult: SearchResponse = {
        success: true,
        question: result.question as string,
        totalResults: result.total_results as number,
        results: (result.results as any[] || []).map((item) => ({
          id: item.id,
          content: item.content,
          metadata: {
            category: item.metadata?.category,
            docType: item.metadata?.doc_type,
            sourceFile: item.metadata?.source_file,
            language: item.metadata?.language,
            chunkIndex: item.metadata?.chunk_index,
            totalPages: item.metadata?.total_pages,
          },
          distance: item.distance,
        })),
      };

      this.logger.info({ totalResults: searchResult.totalResults }, '搜索完成');
      return searchResult;
    } catch (error) {
      this.logger.error({ error, payload }, '知识库搜索异常');
      throw error;
    }
  }

  async getStats(): Promise<StatsResponse> {
    this.logger.info('获取知识库统计信息');

    try {
      const result = await this.callPythonBridge(['stats']);

      if (!result.success) {
        throw new AppError(result.error || '获取统计失败', 500);
      }

      const statsResult: StatsResponse = {
        success: true,
        stats: {
          totalChunks: result.stats?.total_chunks as number || 0,
          languageDistribution: result.stats?.language_distribution as Record<string, number> || {},
          categoryDistribution: result.stats?.category_distribution as Record<string, number> || {},
          fileTypeDistribution: result.stats?.file_type_distribution as Record<string, number> || {},
        },
      };

      this.logger.info({ stats: statsResult.stats }, '统计信息获取完成');
      return statsResult;
    } catch (error) {
      this.logger.error({ error }, '获取统计信息异常');
      throw error;
    }
  }

  async healthCheck(): Promise<HealthResponse> {
    this.logger.info('知识库健康检查');

    try {
      const result = await this.callPythonBridge(['health']);

      if (!result.success) {
        throw new AppError(result.error || '健康检查失败', 500);
      }

      const healthResult: HealthResponse = {
        success: true,
        status: result.status as string,
        collection: result.collection as string,
        totalChunks: result.total_chunks as number,
      };

      this.logger.info({ health: healthResult }, '健康检查完成');
      return healthResult;
    } catch (error) {
      this.logger.error({ error }, '健康检查异常');
      throw error;
    }
  }

  /**
   * 检查Python环境和脚本是否可用
   */
  async validateEnvironment(): Promise<boolean> {
    try {
      // 检查Python可执行文件
      await this.executeCommand(`${this.pythonPath} --version`);
      
      // 检查脚本文件是否存在
      await readFile(this.bridgeScriptPath);
      
      // 测试健康检查
      await this.healthCheck();
      
      return true;
    } catch (error) {
      this.logger.warn({ error }, 'Python环境验证失败');
      return false;
    }
  }

  private async executeCommand(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => stdout += data.toString());
      child.stderr.on('data', (data) => stderr += data.toString());
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `命令执行失败，退出码 ${code}`));
        }
      });
      
      child.on('error', reject);
    });
  }
}