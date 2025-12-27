/**
 * 记忆管理器服务
 * 管理MCP记忆服务的交互，包括存储、检索、更新和总结记忆
 */
import { getMcpClient } from './mcp-client.service.js';
import { getPool } from '../db/pool.js';
// ==================== 记忆提取提示词 ====================
/** 记忆提取提示词 - 用于从对话中提取关键医疗信息 */
export const MEMORY_EXTRACTION_PROMPT = `请从以下对话中提取关键医疗信息：

用户问题：{userQuestion}
AI回答：{aiAnswer}

请提取：
1. 提到的症状或健康问题（如果有）
2. 提到的时间信息（如"最近三天"、"上周开始"等）
3. 关键的患者陈述摘要（精简到1-2句话）

格式要求：
症状：[症状列表]
时间关联：[时间信息]
摘要：[精简摘要]`;
/** 记忆管理器服务 */
export class MemoryManagerService {
    mcpClient = getMcpClient();
    options;
    cache = new Map();
    constructor(options = {}) {
        this.options = {
            defaultLimit: options.defaultLimit ?? 10,
            enableCaching: options.enableCaching ?? true,
            cacheTtl: options.cacheTtl ?? 10 * 60 * 1000, // 10分钟
            autoExtractMedicalEntities: options.autoExtractMedicalEntities ?? true,
            generateSummaryOnRetrieve: options.generateSummaryOnRetrieve ?? false,
        };
    }
    // ==================== 公共方法 ====================
    /**
     * 存储记忆
     * @param params 记忆存储参数
     * @param apiKey API密钥（可选）
     * @returns 记忆ID
     */
    async storeMemory(params, apiKey) {
        const { userId, type, content, conversationId, source } = params;
        // 如果启用自动提取，则从内容中提取医疗实体
        let enhancedContent = { ...content };
        if (this.options.autoExtractMedicalEntities && content.originalText) {
            const extractionResult = await this.extractMedicalEntities(content.originalText, apiKey);
            enhancedContent = {
                ...content,
                extractedSymptoms: extractionResult.symptoms,
                concerns: [...(content.concerns || []), ...extractionResult.concerns],
                summary: extractionResult.summary || content.summary,
            };
        }
        // 调用MCP服务存储记忆
        const memoryId = await this.mcpClient.storeMemory({
            userId,
            type,
            content: enhancedContent,
            conversationId,
            source,
        }, apiKey);
        // 存储元数据到本地数据库
        await this.insertMemoryMetadata({
            userId,
            mcpMemoryId: memoryId,
            memoryType: type,
            summary: enhancedContent.summary || '无摘要',
            rawContent: enhancedContent,
            conversationId,
        });
        // 提取症状时间线并存储
        if (enhancedContent.extractedSymptoms && enhancedContent.extractedSymptoms.length > 0) {
            await this.storeSymptomTimelineEntries(userId, enhancedContent.extractedSymptoms, memoryId);
        }
        // 清除相关缓存
        this.clearUserCache(userId);
        return memoryId;
    }
    /**
     * 检索记忆
     * @param params 记忆检索参数
     * @param apiKey API密钥（可选）
     * @returns 记忆检索结果
     */
    async retrieveMemories(params, apiKey) {
        const { userId, limit = this.options.defaultLimit, offset = 0, types, startDate, endDate, keywords } = params;
        // 构建缓存键
        const cacheKey = this.buildCacheKey('retrieve', userId, { limit, offset, types, startDate, endDate, keywords });
        // 检查缓存
        if (this.options.enableCaching) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return {
                    memories: cached,
                    total: cached.length,
                    summary: this.options.generateSummaryOnRetrieve
                        ? this.generateMemorySummary(cached)
                        : undefined,
                };
            }
        }
        // 调用MCP服务检索记忆
        const memories = await this.mcpClient.retrieveMemories({
            userId,
            limit,
            offset,
            types,
            startDate,
            endDate,
            keywords,
        }, apiKey);
        // 缓存结果
        if (this.options.enableCaching && memories.length > 0) {
            this.setCache(cacheKey, memories, this.options.cacheTtl);
        }
        // 生成摘要（如果需要）
        let summary;
        if (this.options.generateSummaryOnRetrieve && memories.length > 0) {
            summary = this.generateMemorySummary(memories);
        }
        return {
            memories,
            total: memories.length,
            summary,
        };
    }
    /**
     * 检索最近记忆
     * @param userId 用户ID
     * @param limit 数量限制
     * @param apiKey API密钥（可选）
     * @returns 记忆列表
     */
    async retrieveRecentMemories(userId, limit = 5, apiKey) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const result = await this.retrieveMemories({
            userId,
            limit,
            startDate: sevenDaysAgo.toISOString(),
        }, apiKey);
        return result.memories;
    }
    /**
     * 检索症状相关记忆
     * @param userId 用户ID
     * @param symptomKeywords 症状关键词数组
     * @param limit 数量限制
     * @param apiKey API密钥（可选）
     * @returns 症状相关记忆
     */
    async retrieveSymptomMemories(userId, symptomKeywords, limit = 10, apiKey) {
        const result = await this.retrieveMemories({
            userId,
            limit,
            types: ['symptom'],
            keywords: symptomKeywords,
        }, apiKey);
        return result.memories;
    }
    /**
     * 提取医疗实体
     * @param content 文本内容
     * @param apiKey API密钥（可选）
     * @returns 医疗实体提取结果
     */
    async extractMedicalEntities(content, apiKey) {
        // 调用MCP服务提取医疗实体
        return await this.mcpClient.extractMedicalEntities(content, apiKey);
    }
    /**
     * 生成记忆摘要
     * @param memories 记忆列表
     * @returns 摘要文本
     */
    generateMemorySummary(memories) {
        if (memories.length === 0) {
            return '暂无相关记忆。';
        }
        // 按类型分组
        const byType = {
            symptom: [],
            conversation: [],
            preference: [],
            medical_event: [],
        };
        for (const memory of memories) {
            if (byType[memory.type]) {
                byType[memory.type].push(memory);
            }
        }
        // 统计症状
        const symptoms = [];
        for (const memory of byType.symptom) {
            if (memory.content.extractedSymptoms) {
                symptoms.push(...memory.content.extractedSymptoms);
            }
        }
        // 构建摘要
        const parts = [];
        if (symptoms.length > 0) {
            const symptomDescriptions = symptoms.map(s => s.description);
            const uniqueSymptoms = [...new Set(symptomDescriptions)];
            parts.push(`提到以下症状：${uniqueSymptoms.join('、')}`);
        }
        if (byType.conversation.length > 0) {
            parts.push(`有${byType.conversation.length}次相关对话`);
        }
        if (byType.preference.length > 0) {
            parts.push(`记录了${byType.preference.length}项个人偏好`);
        }
        if (parts.length === 0) {
            parts.push(`有${memories.length}条相关记录`);
        }
        return `用户历史记忆：${parts.join('；')}。`;
    }
    /**
     * 获取记忆统计信息
     * @param userId 用户ID
     * @param apiKey API密钥（可选）
     * @returns 记忆统计信息
     */
    async getMemoryStats(userId, apiKey) {
        // 检索所有记忆（使用较大限制）
        const allMemories = await this.retrieveMemories({ userId, limit: 1000 }, apiKey);
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        // 按类型统计
        const byType = {
            symptom: 0,
            conversation: 0,
            preference: 0,
            medical_event: 0,
        };
        let last7Days = 0;
        let last30Days = 0;
        for (const memory of allMemories.memories) {
            // 按类型统计
            if (byType[memory.type] !== undefined) {
                byType[memory.type]++;
            }
            // 按时间统计
            const createdAt = new Date(memory.metadata.createdAt);
            if (createdAt >= sevenDaysAgo) {
                last7Days++;
            }
            if (createdAt >= thirtyDaysAgo) {
                last30Days++;
            }
        }
        return {
            totalMemories: allMemories.memories.length,
            byType,
            recentActivity: {
                last7Days,
                last30Days,
            },
        };
    }
    /**
     * 删除记忆
     * @param memoryId 记忆ID
     * @param userId 用户ID（用于验证）
     * @param apiKey API密钥（可选）
     * @returns 是否删除成功
     */
    async deleteMemory(memoryId, userId, apiKey) {
        // 调用MCP服务删除记忆
        const success = await this.mcpClient.deleteMemory(memoryId, userId, apiKey);
        if (success) {
            // 删除本地数据库记录
            await this.deleteMemoryMetadata(memoryId);
            await this.deleteSymptomTimelineByMemoryId(memoryId);
            // 清除相关缓存
            this.clearUserCache(userId);
        }
        return success;
    }
    /**
     * 初始化MCP记忆服务连接（验证服务可用性）
     */
    async initializeMcpMemoryService() {
        try {
            // 尝试调用一个简单的端点来验证服务可用性
            const testResult = await this.mcpClient.callMcpService({
                service: 'memory',
                method: 'health',
                payload: {},
            });
            return testResult.success;
        }
        catch (error) {
            console.warn('MCP记忆服务初始化失败:', error);
            return false;
        }
    }
    /**
     * 创建新记忆（增强版，包含数据库存储）
     */
    async createMemory(userId, content, metadata) {
        // 提取医疗信息
        const extractionResult = await this.extractMedicalEntities(content.originalText);
        const enhancedContent = {
            ...content,
            extractedSymptoms: extractionResult.symptoms,
            concerns: [...(content.concerns || []), ...extractionResult.concerns],
            summary: extractionResult.summary || content.summary,
        };
        // 存储到MCP服务
        const memoryId = await this.mcpClient.storeMemory({
            userId,
            type: 'conversation', // 默认类型，可根据内容调整
            content: enhancedContent,
            source: 'ai-extracted',
        });
        // 存储元数据到本地数据库
        await this.insertMemoryMetadata({
            userId,
            mcpMemoryId: memoryId,
            memoryType: 'conversation',
            summary: extractionResult.summary || '无摘要',
            rawContent: enhancedContent,
            conversationId: metadata?.conversationId,
        });
        // 提取症状时间线并存储
        if (extractionResult.symptoms.length > 0) {
            await this.storeSymptomTimelineEntries(userId, extractionResult.symptoms, memoryId);
        }
        this.clearUserCache(userId);
        return memoryId;
    }
    /**
     * 获取用户记忆（带高级选项）
     */
    async getMemories(userId, options) {
        const params = {
            userId,
            limit: options?.limit ?? this.options.defaultLimit,
            offset: options?.offset ?? 0,
            types: options?.types,
            startDate: options?.startDate,
            endDate: options?.endDate,
            keywords: options?.keywords,
        };
        const result = await this.retrieveMemories(params);
        return result.memories;
    }
    /**
     * 更新记忆
     */
    async updateMemory(memoryId, updates) {
        // 注意：MCP记忆服务需要实现update方法，此处为示意
        // 实际项目中应调用MCP服务的memory.update操作
        console.warn('记忆更新功能暂未实现，需要MCP服务支持');
        // 更新本地数据库元数据
        await this.updateMemoryMetadata(memoryId, updates);
        // 清除相关缓存
        const memory = await this.getMemoryMetadataById(memoryId);
        if (memory) {
            this.clearUserCache(memory.userId);
        }
        return true;
    }
    /**
     * 删除记忆（增强版，同时删除MCP服务和本地数据）
     */
    async deleteMemoryEnhanced(memoryId, userId, apiKey) {
        // 调用MCP服务删除记忆
        // 注意：需要MCP服务提供删除端点
        const success = await this.deleteMemory(memoryId, userId, apiKey);
        if (success) {
            // 删除本地数据库记录
            await this.deleteMemoryMetadata(memoryId);
            await this.deleteSymptomTimelineByMemoryId(memoryId);
        }
        return success;
    }
    /**
     * 从对话中提取医疗信息
     */
    async extractMedicalInfo(conversation) {
        const prompt = MEMORY_EXTRACTION_PROMPT
            .replace('{userQuestion}', conversation.userQuestion)
            .replace('{aiAnswer}', conversation.aiAnswer);
        // 调用AI服务提取信息（这里简化处理，实际应调用AI模型）
        // 此处可集成现有的extractMedicalEntities方法
        return await this.extractMedicalEntities(prompt);
    }
    /**
     * 生成记忆摘要（增强版，支持多记忆合并）
     */
    async generateMemorySummaryEnhanced(memories) {
        if (memories.length === 0) {
            return '暂无相关记忆。';
        }
        // 使用现有摘要生成逻辑
        const basicSummary = this.generateMemorySummary(memories);
        // 提取症状趋势
        const trend = analyzeSymptomTrend(memories);
        const symptomSummary = [];
        if (trend.worsening.length > 0) {
            symptomSummary.push(`加重症状：${trend.worsening.map(s => s.description).join('、')}`);
        }
        if (trend.improving.length > 0) {
            symptomSummary.push(`好转症状：${trend.improving.map(s => s.description).join('、')}`);
        }
        if (symptomSummary.length > 0) {
            return `${basicSummary} 症状趋势：${symptomSummary.join('；')}。`;
        }
        return basicSummary;
    }
    /**
     * 构建症状时间线
     */
    async buildSymptomTimeline(userId) {
        const entries = await this.getSymptomTimelineEntries(userId);
        return entries.map(entry => ({
            symptom: entry.symptomDescription,
            time: entry.occurredAt,
            description: entry.symptomDescription,
            severity: entry.severity || 5,
        }));
    }
    /**
     * 存储记忆元数据到数据库
     */
    async insertMemoryMetadata(data) {
        const pool = getPool();
        await pool.query(`INSERT INTO memory_metadata
       (user_id, mcp_memory_id, memory_type, summary, raw_content, conversation_id)
       VALUES ($1, $2, $3, $4, $5, $6)`, [
            data.userId,
            data.mcpMemoryId,
            data.memoryType,
            data.summary,
            JSON.stringify(data.rawContent),
            data.conversationId,
        ]);
    }
    /**
     * 更新记忆元数据
     */
    async updateMemoryMetadata(memoryId, updates) {
        const pool = getPool();
        const updateFields = [];
        const values = [];
        let index = 1;
        if (updates.content) {
            updateFields.push(`raw_content = $${index++}`);
            values.push(JSON.stringify(updates.content));
        }
        if (updates.summary) {
            updateFields.push(`summary = $${index++}`);
            values.push(updates.summary);
        }
        if (updateFields.length === 0)
            return;
        values.push(memoryId);
        await pool.query(`UPDATE memory_metadata SET ${updateFields.join(', ')} WHERE mcp_memory_id = $${index}`, values);
    }
    /**
     * 根据ID获取记忆元数据
     */
    async getMemoryMetadataById(memoryId) {
        const pool = getPool();
        const result = await pool.query('SELECT * FROM memory_metadata WHERE mcp_memory_id = $1', [memoryId]);
        return result.rows[0] || null;
    }
    /**
     * 删除记忆元数据
     */
    async deleteMemoryMetadata(memoryId) {
        const pool = getPool();
        await pool.query('DELETE FROM memory_metadata WHERE mcp_memory_id = $1', [memoryId]);
    }
    /**
     * 存储症状时间线条目
     */
    async storeSymptomTimelineEntries(userId, symptoms, memoryId) {
        const pool = getPool();
        const now = new Date().toISOString();
        for (const symptom of symptoms) {
            await pool.query(`INSERT INTO symptom_timeline
         (user_id, symptom_description, severity, occurred_at, recorded_at, source_type, memory_id, confidence_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                userId,
                symptom.description,
                symptom.severity,
                symptom.occurredAt || now,
                now,
                'ai_extracted',
                memoryId,
                symptom.confidence || 1.0,
            ]);
        }
    }
    /**
     * 获取用户症状时间线条目
     */
    async getSymptomTimelineEntries(userId) {
        const pool = getPool();
        const result = await pool.query('SELECT * FROM symptom_timeline WHERE user_id = $1 ORDER BY occurred_at DESC', [userId]);
        return result.rows;
    }
    /**
     * 根据记忆ID删除症状时间线
     */
    async deleteSymptomTimelineByMemoryId(memoryId) {
        const pool = getPool();
        await pool.query('DELETE FROM symptom_timeline WHERE memory_id = $1', [memoryId]);
    }
    /**
     * 清除用户所有记忆缓存
     * @param userId 用户ID
     */
    clearUserCache(userId) {
        const pattern = `retrieve:${userId}:`;
        this.clearCacheByPattern(pattern);
    }
    /**
     * 清除所有缓存
     */
    clearAllCache() {
        this.cache.clear();
    }
    // ==================== 内部辅助方法 ====================
    /** 构建缓存键 */
    buildCacheKey(operation, userId, params) {
        const paramStr = JSON.stringify(params);
        const hash = this.simpleHash(paramStr);
        return `${operation}:${userId}:${hash}`;
    }
    /** 简单哈希函数 */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash.toString(36);
    }
    /** 从缓存获取数据 */
    getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }
    /** 设置缓存 */
    setCache(key, data, ttl) {
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttl,
        });
    }
    /** 清除缓存（按模式匹配） */
    clearCacheByPattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }
}
// ==================== 导出单例实例 ====================
/** 全局记忆管理器实例 */
let memoryManagerInstance = null;
/** 获取记忆管理器实例（单例模式） */
export function getMemoryManager() {
    if (!memoryManagerInstance) {
        memoryManagerInstance = new MemoryManagerService();
    }
    return memoryManagerInstance;
}
/** 重置记忆管理器实例（主要用于测试） */
export function resetMemoryManager() {
    memoryManagerInstance = null;
}
// ==================== 工具函数 ====================
/**
 * 存储记忆（快捷函数）
 */
export async function storeMemory(params, apiKey) {
    return getMemoryManager().storeMemory(params, apiKey);
}
/**
 * 检索记忆（快捷函数）
 */
export async function retrieveMemories(params, apiKey) {
    return getMemoryManager().retrieveMemories(params, apiKey);
}
/**
 * 提取医疗实体（快捷函数）
 */
export async function extractMedicalEntities(content, apiKey) {
    return getMemoryManager().extractMedicalEntities(content, apiKey);
}
// ==================== 记忆分析工具 ====================
/**
 * 分析症状趋势
 */
export function analyzeSymptomTrend(memories) {
    const symptomsByDescription = new Map();
    // 按症状描述分组
    for (const memory of memories) {
        if (memory.content.extractedSymptoms) {
            for (const symptom of memory.content.extractedSymptoms) {
                if (!symptomsByDescription.has(symptom.description)) {
                    symptomsByDescription.set(symptom.description, []);
                }
                symptomsByDescription.get(symptom.description).push(symptom);
            }
        }
    }
    const worsening = [];
    const improving = [];
    const stable = [];
    // 分析每个症状的趋势
    for (const [description, symptomList] of symptomsByDescription) {
        if (symptomList.length < 2) {
            stable.push(symptomList[0]);
            continue;
        }
        // 按时间排序
        const sorted = symptomList.sort((a, b) => {
            const timeA = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
            const timeB = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
            return timeA - timeB;
        });
        const firstSeverity = sorted[0].severity;
        const lastSeverity = sorted[sorted.length - 1].severity;
        if (lastSeverity > firstSeverity + 1) {
            worsening.push(sorted[sorted.length - 1]);
        }
        else if (lastSeverity < firstSeverity - 1) {
            improving.push(sorted[sorted.length - 1]);
        }
        else {
            stable.push(sorted[sorted.length - 1]);
        }
    }
    return { worsening, improving, stable };
}
/**
 * 生成症状时间线
 */
export function generateSymptomTimeline(memories) {
    const timeline = [];
    for (const memory of memories) {
        if (memory.content.extractedSymptoms) {
            for (const symptom of memory.content.extractedSymptoms) {
                if (symptom.occurredAt) {
                    timeline.push({
                        date: symptom.occurredAt,
                        symptom,
                        memoryId: memory.id,
                    });
                }
            }
        }
    }
    // 按时间排序
    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return timeline;
}
//# sourceMappingURL=memory-manager.service.js.map