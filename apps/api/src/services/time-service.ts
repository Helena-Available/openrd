/**
 * 时间服务封装
 * 提供当前时间获取功能，集成MCP时间服务并实现降级策略
 */

import { getMcpClient } from './mcp-client.service.js';
import type { TimeServiceResponse } from '../types/mcp.types.js';
import { executeWithFallback } from '../utils/mcp-error.js';

// ==================== 时间服务类 ====================

/** 时间服务选项 */
export interface TimeServiceOptions {
  /** 是否启用MCP时间服务（默认: true） */
  useMcpTime: boolean;
  /** 降级时使用的时区（默认: Asia/Shanghai） */
  fallbackTimezone: string;
  /** 是否缓存时间结果（默认: true） */
  enableCaching: boolean;
  /** 缓存TTL（毫秒，默认: 5分钟） */
  cacheTtl: number;
}

/** 时间服务 */
export class TimeService {
  private mcpClient = getMcpClient();
  private options: TimeServiceOptions;
  private timeCache: Map<string, { data: TimeServiceResponse; expiresAt: number }> = new Map();

  constructor(options: Partial<TimeServiceOptions> = {}) {
    this.options = {
      useMcpTime: options.useMcpTime ?? true,
      fallbackTimezone: options.fallbackTimezone ?? 'Asia/Shanghai',
      enableCaching: options.enableCaching ?? true,
      cacheTtl: options.cacheTtl ?? 5 * 60 * 1000, // 5分钟
    };
  }

  // ==================== 公共方法 ====================

  /**
   * 获取当前时间
   * @param userId 用户ID（用于获取用户特定的API密钥）
   * @param forceRefresh 是否强制刷新缓存
   * @returns 当前时间信息
   */
  async getCurrentTime(
    userId?: string,
    forceRefresh: boolean = false
  ): Promise<TimeServiceResponse> {
    // 构建缓存键
    const cacheKey = `time:${userId || 'system'}`;
    
    // 检查缓存（如果启用且不强制刷新）
    if (this.options.enableCaching && !forceRefresh) {
      const cached = this.getCachedTime(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 获取用户API密钥（实际项目中应从数据库获取）
    const apiKey = userId ? await this.getUserApiKey(userId) : undefined;

    // 如果启用MCP时间服务，则尝试调用
    if (this.options.useMcpTime) {
      try {
        const timeResponse = await this.mcpClient.getCurrentTime(apiKey);
        
        // 缓存结果
        if (this.options.enableCaching) {
          this.cacheTime(cacheKey, timeResponse);
        }
        
        return timeResponse;
      } catch (error) {
        console.warn('MCP时间服务调用失败，使用降级方案:', error);
        // 继续执行降级逻辑
      }
    }

    // 降级：返回系统时间
    return this.getFallbackTime();
  }

  /**
   * 获取带格式化的当前时间
   * @param format 格式化字符串（例如：'YYYY-MM-DD HH:mm:ss'）
   * @param userId 用户ID
   * @returns 格式化后的时间字符串
   */
  async getFormattedCurrentTime(
    format?: string,
    userId?: string
  ): Promise<string> {
    const timeResponse = await this.getCurrentTime(userId);
    
    if (format) {
      return this.formatTime(timeResponse, format);
    }
    
    return timeResponse.formatted || this.formatTime(timeResponse, 'YYYY-MM-DD HH:mm:ss');
  }

  /**
   * 获取时间戳（Unix时间戳，秒）
   * @param userId 用户ID
   * @returns Unix时间戳（秒）
   */
  async getTimestamp(userId?: string): Promise<number> {
    const timeResponse = await this.getCurrentTime(userId);
    return timeResponse.timestamp;
  }

  /**
   * 获取时区信息
   * @param userId 用户ID
   * @returns 时区字符串
   */
  async getTimezone(userId?: string): Promise<string> {
    const timeResponse = await this.getCurrentTime(userId);
    return timeResponse.timezone;
  }

  /**
   * 验证时间服务是否可用
   * @returns 是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      // 快速测试调用（使用系统用户）
      await this.mcpClient.getCurrentTime();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 清除时间缓存
   */
  clearCache(): void {
    this.timeCache.clear();
  }

  // ==================== 内部辅助方法 ====================

  /** 获取用户API密钥（模拟实现） */
  private async getUserApiKey(userId: string): Promise<string | undefined> {
    // 实际项目中应从数据库查询mcp_credentials表
    // 这里返回环境变量中的默认密钥
    // @ts-ignore: process.env is defined in Node.js
    return process.env.MCP_TIME_SERVICE_API_KEY;
  }

  /** 获取降级时间（系统时间） */
  private getFallbackTime(): TimeServiceResponse {
    const now = new Date();
    return {
      current_time: now.toISOString(),
      timezone: this.options.fallbackTimezone,
      timestamp: Math.floor(now.getTime() / 1000),
      formatted: this.formatSystemTime(now),
    };
  }

  /** 格式化系统时间 */
  private formatSystemTime(date: Date): string {
    return date.toLocaleString('zh-CN', {
      timeZone: this.options.fallbackTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /** 格式化时间响应 */
  private formatTime(timeResponse: TimeServiceResponse, format: string): string {
    const date = new Date(timeResponse.current_time);
    
    // 简单的格式化实现
    const replacements: Record<string, string> = {
      'YYYY': date.getFullYear().toString(),
      'MM': (date.getMonth() + 1).toString().padStart(2, '0'),
      'DD': date.getDate().toString().padStart(2, '0'),
      'HH': date.getHours().toString().padStart(2, '0'),
      'mm': date.getMinutes().toString().padStart(2, '0'),
      'ss': date.getSeconds().toString().padStart(2, '0'),
      'ZZ': timeResponse.timezone,
    };
    
    let formatted = format;
    for (const [key, value] of Object.entries(replacements)) {
      formatted = formatted.replace(key, value);
    }
    
    return formatted;
  }

  // ==================== 缓存管理 ====================

  /** 获取缓存的时间 */
  private getCachedTime(key: string): TimeServiceResponse | null {
    const entry = this.timeCache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.timeCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /** 缓存时间 */
  private cacheTime(key: string, timeResponse: TimeServiceResponse): void {
    this.timeCache.set(key, {
      data: timeResponse,
      expiresAt: Date.now() + this.options.cacheTtl,
    });
  }
}

// ==================== 导出单例实例 ====================

/** 全局时间服务实例 */
let timeServiceInstance: TimeService | null = null;

/** 获取时间服务实例（单例模式） */
export function getTimeService(): TimeService {
  if (!timeServiceInstance) {
    timeServiceInstance = new TimeService();
  }
  
  return timeServiceInstance;
}

/** 重置时间服务实例（主要用于测试） */
export function resetTimeService(): void {
  timeServiceInstance = null;
}

// ==================== 工具函数 ====================

/**
 * 获取当前时间（快捷函数）
 */
export async function getCurrentTime(userId?: string): Promise<TimeServiceResponse> {
  return getTimeService().getCurrentTime(userId);
}

/**
 * 获取当前时间戳（快捷函数）
 */
export async function getCurrentTimestamp(userId?: string): Promise<number> {
  return getTimeService().getTimestamp(userId);
}

/**
 * 获取当前格式化时间（快捷函数）
 */
export async function getCurrentFormattedTime(
  format?: string,
  userId?: string
): Promise<string> {
  return getTimeService().getFormattedCurrentTime(format, userId);
}

// ==================== 时间计算工具 ====================

/**
 * 计算时间差（毫秒）
 */
export function timeDifference(
  time1: TimeServiceResponse,
  time2: TimeServiceResponse
): number {
  const timestamp1 = time1.timestamp * 1000;
  const timestamp2 = time2.timestamp * 1000;
  return Math.abs(timestamp1 - timestamp2);
}

/**
 * 检查时间是否在最近N分钟内
 */
export function isWithinMinutes(
  time: TimeServiceResponse,
  minutes: number,
  referenceTime?: TimeServiceResponse
): boolean {
  const referenceTimestamp = referenceTime 
    ? referenceTime.timestamp * 1000 
    : Date.now();
  
  const timeTimestamp = time.timestamp * 1000;
  const difference = Math.abs(referenceTimestamp - timeTimestamp);
  
  return difference <= minutes * 60 * 1000;
}

/**
 * 将时间响应转换为Date对象
 */
export function toDate(timeResponse: TimeServiceResponse): Date {
  return new Date(timeResponse.current_time);
}

/**
 * 将Date对象转换为时间响应
 */
export function fromDate(date: Date, timezone: string = 'Asia/Shanghai'): TimeServiceResponse {
  return {
    current_time: date.toISOString(),
    timezone,
    timestamp: Math.floor(date.getTime() / 1000),
    formatted: date.toLocaleString('zh-CN', { timeZone: timezone }),
  };
}