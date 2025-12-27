/**
 * MCP服务配置
 * 从环境变量加载MCP服务配置，并提供默认值
 */
import { loadAppEnv } from './env.js';
const env = loadAppEnv();
// ==================== 默认配置 ====================
/** 默认MCP服务配置 */
const DEFAULT_SERVICE_CONFIG = {
    endpoint: '',
    timeout: 10000, // 10秒
    retries: 3,
    retryDelay: 1000, // 1秒
    fallbackEnabled: true,
};
/** 默认时间服务配置 */
const DEFAULT_TIME_SERVICE_CONFIG = {
    apiEndpoint: 'https://open.bigmodel.cn/api/mcp-broker/proxy/time/mcp',
    defaultTimezone: 'Asia/Shanghai',
    cacheTtl: 5 * 60 * 1000, // 5分钟缓存
};
/** 默认记忆服务配置 */
const DEFAULT_MEMORY_SERVICE_CONFIG = {
    // @ts-ignore: process.env is defined in Node.js
    endpoint: process.env.MCP_MEMORY_SERVICE_ENDPOINT || 'http://localhost:8080',
    timeout: 15000,
    retries: 2,
    retryDelay: 2000,
    fallbackEnabled: true,
};
// ==================== 环境变量映射 ====================
/** 从环境变量加载MCP配置 */
export function loadMcpConfig() {
    const isMcpEnabled = env.MCP_ENABLED !== 'false'; // 默认启用
    // 时间服务配置
    const timeServiceConfig = {
        ...DEFAULT_SERVICE_CONFIG,
        ...DEFAULT_TIME_SERVICE_CONFIG,
        endpoint: env.MCP_TIME_SERVICE_ENDPOINT || DEFAULT_TIME_SERVICE_CONFIG.apiEndpoint,
        timeout: env.MCP_TIME_SERVICE_TIMEOUT ? parseInt(env.MCP_TIME_SERVICE_TIMEOUT, 10) : DEFAULT_SERVICE_CONFIG.timeout,
        retries: env.MCP_TIME_SERVICE_RETRIES ? parseInt(env.MCP_TIME_SERVICE_RETRIES, 10) : DEFAULT_SERVICE_CONFIG.retries,
        retryDelay: env.MCP_TIME_SERVICE_RETRY_DELAY ? parseInt(env.MCP_TIME_SERVICE_RETRY_DELAY, 10) : DEFAULT_SERVICE_CONFIG.retryDelay,
        fallbackEnabled: env.MCP_TIME_SERVICE_FALLBACK_ENABLED !== 'false',
    };
    // 记忆服务配置
    const memoryServiceConfig = {
        ...DEFAULT_MEMORY_SERVICE_CONFIG,
        endpoint: env.MCP_MEMORY_SERVICE_ENDPOINT || DEFAULT_MEMORY_SERVICE_CONFIG.endpoint,
        timeout: env.MCP_MEMORY_SERVICE_TIMEOUT ? parseInt(env.MCP_MEMORY_SERVICE_TIMEOUT, 10) : DEFAULT_MEMORY_SERVICE_CONFIG.timeout,
        retries: env.MCP_MEMORY_SERVICE_RETRIES ? parseInt(env.MCP_MEMORY_SERVICE_RETRIES, 10) : DEFAULT_MEMORY_SERVICE_CONFIG.retries,
        retryDelay: env.MCP_MEMORY_SERVICE_RETRY_DELAY ? parseInt(env.MCP_MEMORY_SERVICE_RETRY_DELAY, 10) : DEFAULT_MEMORY_SERVICE_CONFIG.retryDelay,
        fallbackEnabled: env.MCP_MEMORY_SERVICE_FALLBACK_ENABLED !== 'false',
    };
    // 降级配置
    const fallbackConfig = {
        time: {
            currentTime: new Date().toISOString(),
            timezone: DEFAULT_TIME_SERVICE_CONFIG.defaultTimezone,
            source: 'system',
            isFallback: false,
        },
        memory: {
            enabled: env.MCP_MEMORY_FALLBACK_ENABLED !== 'false',
            maxMemories: env.MCP_MEMORY_FALLBACK_MAX ? parseInt(env.MCP_MEMORY_FALLBACK_MAX, 10) : 50,
        },
    };
    // 缓存配置
    const cachingConfig = {
        timeTtl: env.MCP_CACHE_TIME_TTL ? parseInt(env.MCP_CACHE_TIME_TTL, 10) : 5 * 60 * 1000, // 5分钟
        memoryTtl: env.MCP_CACHE_MEMORY_TTL ? parseInt(env.MCP_CACHE_MEMORY_TTL, 10) : 10 * 60 * 1000, // 10分钟
    };
    return {
        enabled: isMcpEnabled,
        services: {
            time: timeServiceConfig,
            memory: memoryServiceConfig,
        },
        fallback: fallbackConfig,
        caching: cachingConfig,
    };
}
// ==================== 环境变量验证 ====================
/** 验证MCP配置是否有效 */
export function validateMcpConfig(config) {
    const errors = [];
    if (!config.enabled) {
        // 如果MCP未启用，则跳过详细验证
        return { valid: true, errors: [] };
    }
    // 验证时间服务配置
    if (config.services.time.endpoint && !isValidUrl(config.services.time.endpoint)) {
        errors.push(`时间服务端点无效: ${config.services.time.endpoint}`);
    }
    if (config.services.time.timeout <= 0) {
        errors.push('时间服务超时必须大于0');
    }
    if (config.services.time.retries < 0) {
        errors.push('时间服务重试次数不能为负数');
    }
    // 验证记忆服务配置
    if (config.services.memory.endpoint && !isValidUrl(config.services.memory.endpoint)) {
        errors.push(`记忆服务端点无效: ${config.services.memory.endpoint}`);
    }
    if (config.services.memory.timeout <= 0) {
        errors.push('记忆服务超时必须大于0');
    }
    // 验证缓存配置
    if (config.caching.timeTtl < 0) {
        errors.push('时间缓存TTL不能为负数');
    }
    if (config.caching.memoryTtl < 0) {
        errors.push('记忆缓存TTL不能为负数');
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/** 检查URL是否有效 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
// ==================== 配置实例 ====================
/** 全局MCP配置实例 */
let mcpConfigInstance = null;
/** 获取MCP配置（单例模式） */
export function getMcpConfig() {
    if (!mcpConfigInstance) {
        mcpConfigInstance = loadMcpConfig();
        const validation = validateMcpConfig(mcpConfigInstance);
        if (!validation.valid) {
            console.warn('MCP配置验证失败:', validation.errors);
            // 如果配置无效，禁用MCP功能
            mcpConfigInstance.enabled = false;
        }
    }
    return mcpConfigInstance;
}
/** 重置配置缓存（主要用于测试） */
export function resetMcpConfigCache() {
    mcpConfigInstance = null;
}
// ==================== 环境变量文档 ====================
/**
 * MCP环境变量说明：
 *
 * 1. 基本控制：
 * - MCP_ENABLED: 是否启用MCP功能（默认: true）
 *
 * 2. 时间服务：
 * - MCP_TIME_SERVICE_ENDPOINT: 时间服务端点（默认: https://open.bigmodel.cn/api/mcp-broker/proxy/time/mcp）
 * - MCP_TIME_SERVICE_TIMEOUT: 超时时间（毫秒，默认: 10000）
 * - MCP_TIME_SERVICE_RETRIES: 重试次数（默认: 3）
 * - MCP_TIME_SERVICE_RETRY_DELAY: 重试延迟（毫秒，默认: 1000）
 * - MCP_TIME_SERVICE_FALLBACK_ENABLED: 是否启用降级（默认: true）
 *
 * 3. 记忆服务：
 * - MCP_MEMORY_SERVICE_ENDPOINT: 记忆服务端点（默认: http://localhost:8080）
 * - MCP_MEMORY_SERVICE_TIMEOUT: 超时时间（毫秒，默认: 15000）
 * - MCP_MEMORY_SERVICE_RETRIES: 重试次数（默认: 2）
 * - MCP_MEMORY_SERVICE_RETRY_DELAY: 重试延迟（毫秒，默认: 2000）
 * - MCP_MEMORY_SERVICE_FALLBACK_ENABLED: 是否启用降级（默认: true）
 *
 * 4. 降级配置：
 * - MCP_MEMORY_FALLBACK_ENABLED: 记忆服务降级是否启用（默认: true）
 * - MCP_MEMORY_FALLBACK_MAX: 降级时最大记忆数（默认: 50）
 *
 * 5. 缓存配置：
 * - MCP_CACHE_TIME_TTL: 时间缓存TTL（毫秒，默认: 300000）
 * - MCP_CACHE_MEMORY_TTL: 记忆缓存TTL（毫秒，默认: 600000）
 */ 
//# sourceMappingURL=mcp.config.js.map