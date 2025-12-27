/**
 * MCP相关类型定义
 * 用于OpenRD知识库API中的MCP服务集成
 */

// ==================== 基础类型 ====================

/** MCP服务类型 */
export type McpServiceType = 'time' | 'memory';

/** MCP服务配置 */
export interface McpServiceConfig {
  endpoint: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  fallbackEnabled: boolean;
}

/** MCP通用请求参数 */
export interface McpRequestParams {
  service: McpServiceType;
  method: string;
  payload?: Record<string, any>;
  userId?: string;
  apiKey?: string;
}

/** MCP通用响应 */
export interface McpResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    responseTime: number;
    service: string;
    timestamp: string;
  };
}

// ==================== 时间服务类型 ====================

/** 时间服务响应数据结构（智谱MCP时间服务） */
export interface TimeServiceResponse {
  current_time: string; // ISO 8601格式
  timezone: string;
  timestamp: number; // Unix时间戳（秒）
  formatted?: string; // 格式化时间字符串
}

/** 时间服务配置 */
export interface TimeServiceConfig {
  apiEndpoint: string;
  defaultTimezone: string;
  cacheTtl: number; // 缓存时间（毫秒）
}

/** 降级时间数据（当MCP服务不可用时） */
export interface FallbackTimeData {
  currentTime: string;
  timezone: string;
  source: 'system' | 'cache';
  isFallback: boolean;
}

// ==================== 记忆服务类型 ====================

/** 记忆类型 */
export type MemoryType = 'symptom' | 'conversation' | 'preference' | 'medical_event';

/** 症状严重程度（1-10） */
export type SymptomSeverity = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** 提取的症状信息 */
export interface ExtractedSymptom {
  description: string;
  severity: SymptomSeverity;
  timeContext: string; // 时间上下文描述
  occurredAt?: string; // ISO时间（如可推断）
  confidence?: number; // 置信度 0-1
}

/** 记忆内容 */
export interface MemoryContent {
  originalText: string; // 原始对话内容
  extractedSymptoms?: ExtractedSymptom[];
  concerns: string[]; // 用户关注点
  summary?: string; // AI生成的摘要
}

/** 记忆元数据 */
export interface MemoryMetadata {
  id: string; // MCP服务生成的唯一ID
  userId: string;
  type: MemoryType;
  summary: string; // 精简总结（AI生成）
  content: MemoryContent;
  metadata: {
    source: 'ai-extracted' | 'manual' | 'system';
    conversationId?: string;
    createdAt: string;
    updatedAt?: string;
    expiresAt?: string; // 可选：记忆过期时间
  };
}

/** 记忆检索参数 */
export interface MemoryRetrievalParams {
  userId: string;
  limit?: number;
  offset?: number;
  types?: MemoryType[];
  startDate?: string;
  endDate?: string;
  keywords?: string[];
}

/** 记忆存储参数 */
export interface MemoryStorageParams {
  userId: string;
  type: MemoryType;
  content: MemoryContent;
  conversationId?: string;
  source?: 'ai-extracted' | 'manual' | 'system';
}

/** 记忆提取结果 */
export interface MemoryExtractionResult {
  symptoms: ExtractedSymptom[];
  concerns: string[];
  summary: string;
}

// ==================== MCP凭证类型 ====================

/** MCP凭证 */
export interface McpCredential {
  id: string;
  userId: string;
  serviceType: 'time' | 'memory';
  apiKeyEncrypted: string;
  isValid: boolean;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** 凭证创建/更新参数 */
export interface McpCredentialParams {
  userId: string;
  serviceType: 'time' | 'memory';
  apiKey: string; // 明文，前端传输时需要加密
}

// ==================== 病史导出类型 ====================

/** 病史导出类型 */
export type ExportType = 'full' | 'timeline' | 'summary';

/** 导出文件格式 */
export type ExportFormat = 'pdf' | 'json' | 'txt';

/** 时间范围 */
export interface DateRange {
  start: string; // ISO日期字符串
  end: string; // ISO日期字符串
}

/** 导出选项 */
export interface ExportOptions {
  exportType: ExportType;
  format: ExportFormat;
  dateRange?: DateRange;
  includeSymptoms: boolean;
  includeConversations: boolean;
  includeAnalysis: boolean;
}

/** 时间线条目 */
export interface TimelineEntry {
  date: string;
  type: 'symptom' | 'conversation' | 'medical_event';
  description: string;
  severity?: number;
  source: string;
  relatedMemoryId?: string;
}

/** 病史导出数据结构 */
export interface MedicalHistoryExport {
  patientInfo: {
    userId: string;
    age?: number;
    condition?: string;
    language?: string;
  };
  timeline: TimelineEntry[];
  summary: {
    symptomOverview: string;
    trendAnalysis: string;
    recommendations: string[];
  };
  generatedAt: string;
  exportId: string;
}

/** 导出记录 */
export interface ExportRecord {
  id: string;
  userId: string;
  exportType: ExportType;
  fileFormat: ExportFormat;
  filePath: string;
  fileSize: number;
  memoryIds: string[];
  exportOptions: ExportOptions;
  generatedAt: string;
  expiresAt?: string;
  downloadCount: number;
}

// ==================== 症状时间线类型 ====================

/** 症状时间线条目 */
export interface SymptomTimelineEntry {
  id: string;
  userId: string;
  symptomDescription: string;
  severity: SymptomSeverity;
  occurredAt: string;
  recordedAt: string;
  sourceType: 'conversation' | 'manual' | 'ai_extracted';
  memoryId?: string;
  confidenceScore: number;
}

// ==================== AI提示词增强类型 ====================

/** 增强的提示词上下文 */
export interface EnhancedPromptContext {
  currentTime: string;
  memories: MemoryMetadata[];
  userContext?: {
    age?: number;
    condition?: string;
    language?: string;
  };
  knowledgeContext: string;
}

/** 提示词模板类型 */
export interface PromptTemplate {
  system: string;
  user: string;
  memoryExtraction?: string;
}

// ==================== 错误处理类型 ====================

/** MCP错误码 */
export enum McpErrorCode {
  SERVICE_UNAVAILABLE = 'MCP_SERVICE_UNAVAILABLE',
  AUTHENTICATION_FAILED = 'MCP_AUTHENTICATION_FAILED',
  INVALID_REQUEST = 'MCP_INVALID_REQUEST',
  RATE_LIMITED = 'MCP_RATE_LIMITED',
  TIMEOUT = 'MCP_TIMEOUT',
  NETWORK_ERROR = 'MCP_NETWORK_ERROR',
  FALLBACK_TRIGGERED = 'MCP_FALLBACK_TRIGGERED'
}

/** MCP错误详情 */
export interface McpErrorDetails {
  code: McpErrorCode;
  message: string;
  service: McpServiceType;
  originalError?: any;
  timestamp: string;
}

// ==================== 配置类型 ====================

/** MCP整体配置 */
export interface McpConfig {
  enabled: boolean;
  services: {
    time: McpServiceConfig & TimeServiceConfig;
    memory: McpServiceConfig;
  };
  fallback: {
    time: FallbackTimeData;
    memory: {
      enabled: boolean;
      maxMemories: number;
    };
  };
  caching: {
    timeTtl: number; // 时间缓存TTL（毫秒）
    memoryTtl: number; // 记忆缓存TTL（毫秒）
  };
}