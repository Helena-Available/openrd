/**
 * MCP错误处理工具
 * 定义MCP服务专用的错误类和降级处理策略
 */

import { McpErrorCode, McpErrorDetails, McpServiceType } from '../types/mcp.types.js';
import { AppError } from './app-error.js';

// ==================== MCP错误类 ====================

/** MCP服务错误 */
export class McpError extends AppError {
  public readonly code: McpErrorCode;
  public readonly service: McpServiceType;
  public readonly isFallbackTriggered: boolean;
  public readonly originalError?: any;

  constructor(
    message: string,
    code: McpErrorCode,
    service: McpServiceType,
    options?: {
      statusCode?: number;
      originalError?: any;
      isFallbackTriggered?: boolean;
      details?: Record<string, unknown>;
    }
  ) {
    const statusCode = options?.statusCode ?? getStatusCodeFromErrorCode(code);
    super(message, statusCode, options?.details);
    
    this.name = 'McpError';
    this.code = code;
    this.service = service;
    this.originalError = options?.originalError;
    this.isFallbackTriggered = options?.isFallbackTriggered ?? false;

    // @ts-ignore: captureStackTrace exists in Node.js/V8
    if (Error.captureStackTrace) {
      // @ts-ignore: captureStackTrace exists in Node.js/V8
      Error.captureStackTrace(this, McpError);
    }
  }

  /** 转换为错误详情对象 */
  toDetails(): McpErrorDetails {
    return {
      code: this.code,
      message: this.message,
      service: this.service,
      originalError: this.originalError,
      timestamp: new Date().toISOString(),
    };
  }

  /** 检查错误是否可降级处理 */
  isRecoverable(): boolean {
    // 网络错误、超时、服务不可用等可以触发降级
    return [
      McpErrorCode.SERVICE_UNAVAILABLE,
      McpErrorCode.TIMEOUT,
      McpErrorCode.NETWORK_ERROR,
      McpErrorCode.RATE_LIMITED,
    ].includes(this.code);
  }
}

// ==================== 错误码映射 ====================

/** 根据错误码返回对应的HTTP状态码 */
function getStatusCodeFromErrorCode(code: McpErrorCode): number {
  const statusMap: Record<McpErrorCode, number> = {
    [McpErrorCode.AUTHENTICATION_FAILED]: 401,
    [McpErrorCode.INVALID_REQUEST]: 400,
    [McpErrorCode.RATE_LIMITED]: 429,
    [McpErrorCode.TIMEOUT]: 504,
    [McpErrorCode.NETWORK_ERROR]: 502,
    [McpErrorCode.SERVICE_UNAVAILABLE]: 503,
    [McpErrorCode.FALLBACK_TRIGGERED]: 200, // 降级触发但仍返回成功
  };
  
  return statusMap[code] ?? 500;
}

/** 根据原始错误创建MCP错误 */
export function createMcpError(
  error: any,
  service: McpServiceType,
  context?: {
    operation?: string;
    userId?: string;
    fallbackTriggered?: boolean;
  }
): McpError {
  // 判断错误类型
  let code: McpErrorCode;
  let message: string;
  
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    code = McpErrorCode.AUTHENTICATION_FAILED;
    message = `MCP服务认证失败: ${error.message || '无效的API密钥或权限不足'}`;
  } else if (error?.response?.status === 400) {
    code = McpErrorCode.INVALID_REQUEST;
    message = `MCP服务请求无效: ${error.message || '请求参数错误'}`;
  } else if (error?.response?.status === 429) {
    code = McpErrorCode.RATE_LIMITED;
    message = `MCP服务调用频率超限: ${error.message || '请稍后重试'}`;
  } else if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNABORTED') {
    code = McpErrorCode.TIMEOUT;
    message = `MCP服务调用超时: ${error.message || '服务响应时间过长'}`;
  } else if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
    code = McpErrorCode.SERVICE_UNAVAILABLE;
    message = `MCP服务不可用: ${error.message || '无法连接到服务'}`;
  } else if (error?.code === 'ENETUNREACH' || error?.code === 'ECONNRESET') {
    code = McpErrorCode.NETWORK_ERROR;
    message = `网络错误: ${error.message || '网络连接异常'}`;
  } else {
    // 未知错误
    code = McpErrorCode.SERVICE_UNAVAILABLE;
    message = `MCP服务错误: ${error?.message || String(error)}`;
  }

  // 添加上下文信息
  const fullMessage = context?.operation 
    ? `${message} (操作: ${context.operation}, 用户: ${context.userId || '未知'})`
    : message;

  return new McpError(fullMessage, code, service, {
    originalError: error,
    isFallbackTriggered: context?.fallbackTriggered ?? false,
    details: {
      operation: context?.operation,
      userId: context?.userId,
    },
  });
}

// ==================== 降级处理策略 ====================

/** 降级处理选项 */
export interface FallbackOptions<T = any> {
  /** 是否启用降级 */
  enabled: boolean;
  /** 降级时的默认值 */
  defaultValue: T;
  /** 降级时记录日志 */
  logFallback: boolean;
  /** 降级原因 */
  reason?: string;
}

/** 执行带降级的MCP操作 */
export async function executeWithFallback<T>(
  operation: () => Promise<T>,
  fallback: () => T | Promise<T>,
  options?: Partial<FallbackOptions<T>>
): Promise<T> {
  const fallbackOptions: FallbackOptions<T> = {
    enabled: true,
    defaultValue: undefined as T,
    logFallback: true,
    ...options,
  };

  if (!fallbackOptions.enabled) {
    // 不启用降级，直接执行原操作
    return operation();
  }

  try {
    return await operation();
  } catch (error) {
    const mcpError = error instanceof McpError ? error : createMcpError(error, 'unknown' as McpServiceType);
    
    if (mcpError.isRecoverable() && fallbackOptions.enabled) {
      // 可恢复错误，触发降级
      if (fallbackOptions.logFallback) {
        console.warn(`MCP服务降级触发: ${mcpError.message}`, {
          code: mcpError.code,
          service: mcpError.service,
          reason: fallbackOptions.reason,
        });
      }
      
      try {
        return await (typeof fallback === 'function' ? fallback() : fallback);
      } catch (fallbackError) {
        // 降级函数也失败，返回默认值
        console.error(`MCP降级函数失败: ${fallbackError}`);
        return fallbackOptions.defaultValue;
      }
    } else {
      // 不可恢复错误，直接抛出
      throw mcpError;
    }
  }
}

// ==================== 错误工具函数 ====================

/** 检查错误是否为MCP错误 */
export function isMcpError(error: any): error is McpError {
  return error instanceof McpError || error?.name === 'McpError';
}

/** 检查错误是否应触发降级 */
export function shouldTriggerFallback(error: any): boolean {
  if (!isMcpError(error)) return false;
  return error.isRecoverable();
}

/** 创建降级错误（用于记录降级事件） */
export function createFallbackError(
  service: McpServiceType,
  originalError: any,
  fallbackReason: string
): McpError {
  return new McpError(
    `MCP服务降级: ${fallbackReason}`,
    McpErrorCode.FALLBACK_TRIGGERED,
    service,
    {
      originalError,
      isFallbackTriggered: true,
      details: { fallbackReason },
    }
  );
}

// ==================== 预定义错误 ====================

/** 时间服务不可用错误 */
export function timeServiceUnavailableError(error?: any): McpError {
  return new McpError(
    '时间服务暂时不可用',
    McpErrorCode.SERVICE_UNAVAILABLE,
    'time',
    { originalError: error }
  );
}

/** 记忆服务不可用错误 */
export function memoryServiceUnavailableError(error?: any): McpError {
  return new McpError(
    '记忆服务暂时不可用',
    McpErrorCode.SERVICE_UNAVAILABLE,
    'memory',
    { originalError: error }
  );
}

/** API密钥无效错误 */
export function invalidApiKeyError(service: McpServiceType): McpError {
  return new McpError(
    'API密钥无效或已过期',
    McpErrorCode.AUTHENTICATION_FAILED,
    service
  );
}

/** 请求超时错误 */
export function requestTimeoutError(service: McpServiceType, timeoutMs: number): McpError {
  return new McpError(
    `请求超时 (${timeoutMs}ms)`,
    McpErrorCode.TIMEOUT,
    service
  );
}