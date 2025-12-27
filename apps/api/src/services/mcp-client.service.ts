/**
 * MCP客户端服务
 * 提供通用的MCP服务调用功能，支持认证、重试、降级和错误处理
 */

// @ts-ignore: axios is installed as dependency
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getMcpConfig } from '../config/mcp.config.js';
import type {
  McpRequestParams,
  McpResponse,
  McpServiceType,
  TimeServiceResponse,
  MemoryMetadata,
  MemoryRetrievalParams,
  MemoryStorageParams,
  MemoryExtractionResult,
} from '../types/mcp.types.js';
import {
  McpError,
  createMcpError,
  executeWithFallback,
  invalidApiKeyError,
  requestTimeoutError,
} from '../utils/mcp-error.js';
import { McpErrorCode } from '../types/mcp.types.js';

// ==================== MCP客户端类 ====================

/** MCP客户端选项 */
export interface McpClientOptions {
  /** 默认重试次数（覆盖配置） */
  maxRetries?: number;
  /** 默认重试延迟（毫秒） */
  retryDelay?: number;
  /** 是否启用降级 */
  fallbackEnabled?: boolean;
  /** 自定义认证头生成器 */
  authHeaderBuilder?: (service: McpServiceType, apiKey?: string) => Record<string, string>;
}

/** 缓存条目 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/** MCP客户端服务 */
export class McpClientService {
  private axiosInstances: Map<McpServiceType, AxiosInstance> = new Map();
  private config = getMcpConfig();
  private cache: Map<string, CacheEntry<any>> = new Map();
  private options: McpClientOptions;

  constructor(options: McpClientOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries,
      retryDelay: options.retryDelay,
      fallbackEnabled: options.fallbackEnabled ?? true,
      authHeaderBuilder: options.authHeaderBuilder,
    };
  }

  // ==================== 公共方法 ====================

  /** 调用MCP服务 */
  async callMcpService<T = any>(
    params: McpRequestParams
  ): Promise<McpResponse<T>> {
    const { service, method, payload, userId, apiKey } = params;
    
    // 检查MCP是否启用
    if (!this.config.enabled) {
      return this.createFallbackResponse(service, 'MCP功能未启用');
    }

    // 构建缓存键
    const cacheKey = this.buildCacheKey(service, method, payload, userId);
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached,
        metadata: {
          responseTime: 0,
          service,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // 获取服务配置
    const serviceConfig = this.config.services[service];
    if (!serviceConfig) {
      throw new McpError(
        `未找到服务配置: ${service}`,
        McpErrorCode.SERVICE_UNAVAILABLE,
        service
      );
    }

    // 构建请求配置
    const requestConfig: AxiosRequestConfig = {
      method: 'POST', // MCP服务通常使用POST
      url: serviceConfig.endpoint,
      headers: this.buildHeaders(service, apiKey),
      data: payload,
      timeout: serviceConfig.timeout,
      validateStatus: (status: number) => status >= 200 && status < 500,
    };

    // 执行带重试和降级的请求
    const startTime = Date.now();
    
    try {
      const response = await this.executeWithRetry(
        () => this.getAxiosInstance(service).request(requestConfig),
        service,
        serviceConfig.retries,
        serviceConfig.retryDelay
      );

      const responseTime = Date.now() - startTime;
      
      // 解析响应
      const responseData = this.parseResponse(response, service);
      
      // 缓存响应（如果支持缓存）
      if (this.shouldCacheResponse(service, method)) {
        this.setCache(cacheKey, responseData, this.getCacheTtl(service));
      }

      return {
        success: true,
        data: responseData,
        metadata: {
          responseTime,
          service,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      // 处理错误并可能触发降级
      return await this.handleServiceError<T>(error, service, method, payload, userId);
    }
  }

  /** 调用时间服务获取当前时间 */
  async getCurrentTime(apiKey?: string): Promise<TimeServiceResponse> {
    const cacheKey = 'time:current';
    const cached = this.getFromCache<TimeServiceResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    // 如果未提供API密钥，尝试从数据库获取用户密钥
    // 注意：这里简化处理，实际项目中需要从数据库获取用户密钥
    // @ts-ignore: process.env is defined in Node.js
    const effectiveApiKey = apiKey || process.env.MCP_TIME_SERVICE_API_KEY;

    if (!effectiveApiKey) {
      // 没有API密钥，触发降级返回系统时间
      return this.getFallbackTime();
    }

    const response = await this.callMcpService<TimeServiceResponse>({
      service: 'time',
      method: 'getCurrentTime',
      apiKey: effectiveApiKey,
    });

    if (response.success && response.data) {
      // 缓存时间结果（5分钟）
      this.setCache(cacheKey, response.data, this.config.caching.timeTtl);
      return response.data;
    }

    // 如果MCP调用失败，触发降级
    return this.getFallbackTime();
  }

  /** 检索用户记忆 */
  async retrieveMemories(
    params: MemoryRetrievalParams,
    apiKey?: string
  ): Promise<MemoryMetadata[]> {
    const { userId, limit = 10, offset = 0, types, startDate, endDate, keywords } = params;
    
    const cacheKey = `memory:retrieve:${userId}:${limit}:${offset}`;
    const cached = this.getFromCache<MemoryMetadata[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await this.callMcpService<MemoryMetadata[]>({
      service: 'memory',
      method: 'retrieveMemories',
      payload: {
        userId,
        limit,
        offset,
        types,
        startDate,
        endDate,
        keywords,
      },
      userId,
      apiKey,
    });

    if (response.success && response.data) {
      this.setCache(cacheKey, response.data, this.config.caching.memoryTtl);
      return response.data;
    }

    // 降级：返回空数组
    return [];
  }

  /** 存储记忆 */
  async storeMemory(
    params: MemoryStorageParams,
    apiKey?: string
  ): Promise<string> {
    const { userId, type, content, conversationId, source = 'ai-extracted' } = params;

    const response = await this.callMcpService<{ memoryId: string }>({
      service: 'memory',
      method: 'storeMemory',
      payload: {
        userId,
        type,
        content,
        conversationId,
        source,
      },
      userId,
      apiKey,
    });

    if (response.success && response.data) {
      // 清除相关缓存
      this.clearCacheByPattern(`memory:retrieve:${userId}:`);
      return response.data.memoryId;
    }

    throw new McpError(
      '存储记忆失败',
      McpErrorCode.SERVICE_UNAVAILABLE,
      'memory'
    );
  }

  /** 更新记忆 */
  async updateMemory(
    memoryId: string,
    updates: Partial<{
      content: any;
      summary?: string;
      metadata?: Record<string, any>;
    }>,
    apiKey?: string
  ): Promise<boolean> {
    const response = await this.callMcpService<{ success: boolean }>({
      service: 'memory',
      method: 'updateMemory',
      payload: {
        memoryId,
        updates,
      },
      apiKey,
    });

    if (response.success && response.data?.success) {
      // 清除相关缓存
      this.clearCacheByPattern(`memory:retrieve:`);
      return true;
    }

    throw new McpError(
      '更新记忆失败',
      McpErrorCode.SERVICE_UNAVAILABLE,
      'memory'
    );
  }

  /** 删除记忆 */
  async deleteMemory(
    memoryId: string,
    userId?: string,
    apiKey?: string
  ): Promise<boolean> {
    const response = await this.callMcpService<{ success: boolean }>({
      service: 'memory',
      method: 'deleteMemory',
      payload: {
        memoryId,
        userId,
      },
      apiKey,
    });

    if (response.success && response.data?.success) {
      // 清除相关缓存
      if (userId) {
        this.clearCacheByPattern(`memory:retrieve:${userId}:`);
      }
      return true;
    }

    throw new McpError(
      '删除记忆失败',
      McpErrorCode.SERVICE_UNAVAILABLE,
      'memory'
    );
  }

  /** 提取记忆（从对话内容中提取医疗信息） */
  async extractMedicalEntities(
    content: string,
    apiKey?: string
  ): Promise<MemoryExtractionResult> {
    // 注意：这个功能可能需要调用专门的MCP服务或本地AI处理
    // 这里简化实现，实际项目中需要集成专门的提取服务
    
    const response = await this.callMcpService<MemoryExtractionResult>({
      service: 'memory',
      method: 'extractMedicalEntities',
      payload: { content },
      apiKey,
    });

    if (response.success && response.data) {
      return response.data;
    }

    // 降级：返回空结果
    return {
      symptoms: [],
      concerns: [],
      summary: '',
    };
  }

  // ==================== 内部辅助方法 ====================

  /** 获取Axios实例（带连接池和默认配置） */
  private getAxiosInstance(service: McpServiceType): AxiosInstance {
    if (!this.axiosInstances.has(service)) {
      const serviceConfig = this.config.services[service];
      const instance = axios.create({
        baseURL: serviceConfig.endpoint,
        timeout: serviceConfig.timeout,
        maxRedirects: 0,
      });

      // 添加请求拦截器（用于添加认证头）
      instance.interceptors.request.use((config: AxiosRequestConfig) => {
        // 可以在这里动态添加认证头
        return config;
      });

      // 添加响应拦截器（用于统一错误处理）
      instance.interceptors.response.use(
        (response: AxiosResponse) => response,
        (error: any) => {
          // 转换为统一的McpError
          throw createMcpError(error, service);
        }
      );

      this.axiosInstances.set(service, instance);
    }

    return this.axiosInstances.get(service)!;
  }

  /** 构建请求头 */
  private buildHeaders(service: McpServiceType, apiKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'OpenRD-MCP-Client/1.0',
    };

    // 添加认证头
    if (apiKey) {
      if (this.options.authHeaderBuilder) {
        Object.assign(headers, this.options.authHeaderBuilder(service, apiKey));
      } else {
        // 默认使用Bearer Token
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    return headers;
  }

  /** 解析响应 */
  private parseResponse(response: AxiosResponse, service: McpServiceType): any {
    const { status, data } = response;

    if (status >= 400) {
      throw createMcpError(
        { response: { status, data } },
        service,
        { operation: 'parseResponse' }
      );
    }

    // 时间服务的特殊处理
    if (service === 'time' && data && typeof data === 'object') {
      return this.normalizeTimeResponse(data);
    }

    return data;
  }

  /** 规范化时间响应 */
  private normalizeTimeResponse(data: any): TimeServiceResponse {
    // 智谱时间服务的响应格式可能不同，这里进行标准化
    return {
      current_time: data.current_time || data.currentTime || new Date().toISOString(),
      timezone: data.timezone || 'Asia/Shanghai',
      timestamp: data.timestamp || Math.floor(Date.now() / 1000),
      formatted: data.formatted,
    };
  }

  /** 执行带重试的请求 */
  private async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    service: McpServiceType,
    maxRetries: number,
    retryDelay: number
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // 如果是最后一次尝试，不再重试
        if (attempt === maxRetries) {
          break;
        }
        
        // 检查错误是否应该重试
        if (this.shouldRetryError(error)) {
          const delay = retryDelay * Math.pow(2, attempt); // 指数退避
          console.warn(`MCP服务重试 (${service}): 第${attempt + 1}次尝试，${delay}ms后重试`);
          await this.sleep(delay);
          continue;
        }
        
        // 不应该重试的错误，直接抛出
        throw error;
      }
    }
    
    // 所有重试都失败
    throw lastError;
  }

  /** 处理服务错误并触发降级 */
  private async handleServiceError<T>(
    error: any,
    service: McpServiceType,
    method: string,
    payload?: any,
    userId?: string
  ): Promise<McpResponse<T>> {
    const mcpError = error instanceof McpError ? error : createMcpError(error, service);
    
    // 检查是否可以降级
    const serviceConfig = this.config.services[service];
    if (serviceConfig?.fallbackEnabled && this.options.fallbackEnabled) {
      console.warn(`MCP服务降级触发: ${service}.${method}`, {
        error: mcpError.message,
        userId,
      });
      
      // 尝试执行降级逻辑
      const fallbackResult = await this.executeFallback<T>(service, method, payload, userId);
      if (fallbackResult !== undefined) {
        return {
          success: true,
          data: fallbackResult,
          metadata: {
            responseTime: 0,
            service,
            timestamp: new Date().toISOString(),
          },
        };
      }
    }
    
    // 无法降级，返回错误响应
    return {
      success: false,
      error: mcpError.message,
      metadata: {
        responseTime: 0,
        service,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /** 执行降级逻辑 */
  private async executeFallback<T>(
    service: McpServiceType,
    method: string,
    payload?: any,
    userId?: string
  ): Promise<T | undefined> {
    // 时间服务的降级：返回系统时间
    if (service === 'time' && method === 'getCurrentTime') {
      return this.getFallbackTime() as any;
    }
    
    // 记忆服务的降级：返回空数据
    if (service === 'memory' && method.startsWith('retrieve')) {
      return [] as any;
    }
    
    // 其他情况返回undefined，表示无法降级
    return undefined;
  }

  /** 获取降级时间（系统时间） */
  private getFallbackTime(): TimeServiceResponse {
    const now = new Date();
    return {
      current_time: now.toISOString(),
      timezone: this.config.services.time.defaultTimezone || 'Asia/Shanghai',
      timestamp: Math.floor(now.getTime() / 1000),
      formatted: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    };
  }

  /** 创建降级响应 */
  private createFallbackResponse(service: McpServiceType, reason: string): McpResponse {
    return {
      success: false,
      error: `MCP服务降级: ${reason}`,
      metadata: {
        responseTime: 0,
        service,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ==================== 缓存管理 ====================

  /** 构建缓存键 */
  private buildCacheKey(
    service: McpServiceType,
    method: string,
    payload?: any,
    userId?: string
  ): string {
    const parts = [service, method];
    if (userId) parts.push(userId);
    if (payload) {
      const payloadStr = JSON.stringify(payload);
      // 简单哈希（实际项目中可能需要更复杂的哈希函数）
      const hash = this.simpleHash(payloadStr);
      parts.push(hash);
    }
    return parts.join(':');
  }

  /** 简单哈希函数 */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(36);
  }

  /** 从缓存获取数据 */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /** 设置缓存 */
  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  /** 清除缓存（按模式匹配） */
  private clearCacheByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /** 判断响应是否应该缓存 */
  private shouldCacheResponse(service: McpServiceType, method: string): boolean {
    // 时间服务的getCurrentTime应该缓存
    if (service === 'time' && method === 'getCurrentTime') {
      return true;
    }
    
    // 记忆服务的retrieveMemories应该缓存
    if (service === 'memory' && method.startsWith('retrieve')) {
      return true;
    }
    
    return false;
  }

  /** 获取缓存TTL */
  private getCacheTtl(service: McpServiceType): number {
    return service === 'time' 
      ? this.config.caching.timeTtl 
      : this.config.caching.memoryTtl;
  }

  // ==================== 工具函数 ====================

  /** 判断错误是否应该重试 */
  private shouldRetryError(error: any): boolean {
    // 网络错误、超时、5xx错误应该重试
    const status = error?.response?.status;
    const code = error?.code;
    
    return (
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNABORTED' ||
      code === 'ENETUNREACH' ||
      (status && status >= 500) ||
      status === 429 // 限流
    );
  }

  /** 休眠函数 */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ==================== 导出单例实例 ====================

/** 全局MCP客户端实例 */
let mcpClientInstance: McpClientService | null = null;

/** 获取MCP客户端实例（单例模式） */
export function getMcpClient(): McpClientService {
  if (!mcpClientInstance) {
    mcpClientInstance = new McpClientService();
  }
  
  return mcpClientInstance;
}

/** 重置MCP客户端实例（主要用于测试） */
export function resetMcpClient(): void {
  mcpClientInstance = null;
}