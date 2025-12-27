import AsyncStorage from '@react-native-async-storage/async-storage';

// MCP API服务接口
export interface McpApiConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface TimeServiceRequest {
  timezone?: string;
  format?: string;
}

export interface TimeServiceResponse {
  timestamp: number;
  formatted: string;
  timezone: string;
  is_valid: boolean;
}

export interface MemoryRecord {
  id: string;
  content: string;
  timestamp: number;
  category?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface MemoryStats {
  total: number;
  byCategory: Record<string, number>;
  recentCount: number;
  lastUpdated: string;
}

class McpApiService {
  private config: McpApiConfig = {
    apiKey: '',
    baseUrl: 'http://localhost:3000/api', // 默认后端API地址
    timeout: 10000,
  };

  constructor() {
    this.loadConfig();
  }

  // 加载配置
  private async loadConfig() {
    try {
      const savedApiKey = await AsyncStorage.getItem('@zhipu_api_key');
      if (savedApiKey) {
        this.config.apiKey = savedApiKey;
      }
    } catch (error) {
      console.error('加载MCP配置失败:', error);
    }
  }

  // 更新API密钥
  async updateApiKey(apiKey: string): Promise<boolean> {
    try {
      this.config.apiKey = apiKey;
      await AsyncStorage.setItem('@zhipu_api_key', apiKey);
      return true;
    } catch (error) {
      console.error('更新API密钥失败:', error);
      return false;
    }
  }

  // 验证API密钥
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // 这里应该调用实际的验证API
      // 暂时模拟验证逻辑
      const isValid = apiKey.length >= 20 && apiKey.startsWith('sk-');
      
      if (isValid) {
        // 测试时间服务是否可用
        const testResult = await this.testTimeService(apiKey);
        return testResult.is_valid;
      }
      
      return false;
    } catch (error) {
      console.error('验证API密钥失败:', error);
      return false;
    }
  }

  // 测试时间服务
  async testTimeService(apiKey?: string): Promise<TimeServiceResponse> {
    const testApiKey = apiKey || this.config.apiKey;
    
    if (!testApiKey) {
      throw new Error('API密钥未配置');
    }

    try {
      // 模拟API调用
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            timestamp: Date.now(),
            formatted: new Date().toLocaleString('zh-CN'),
            timezone: 'Asia/Shanghai',
            is_valid: true,
          });
        }, 1000);
      });
    } catch (error) {
      console.error('测试时间服务失败:', error);
      throw error;
    }
  }

  // 获取当前时间
  async getCurrentTime(options?: TimeServiceRequest): Promise<TimeServiceResponse> {
    if (!this.config.apiKey) {
      throw new Error('API密钥未配置，请先配置API密钥');
    }

    try {
      // 这里应该调用实际的时间服务API
      // 暂时返回模拟数据
      return {
        timestamp: Date.now(),
        formatted: new Date().toLocaleString('zh-CN', {
          timeZone: options?.timezone || 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        timezone: options?.timezone || 'Asia/Shanghai',
        is_valid: true,
      };
    } catch (error) {
      console.error('获取时间失败:', error);
      throw error;
    }
  }

  // 添加记忆
  async addMemory(content: string, category?: string, tags?: string[]): Promise<MemoryRecord> {
    if (!this.config.apiKey) {
      throw new Error('API密钥未配置，请先配置API密钥');
    }

    try {
      const memory: MemoryRecord = {
        id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        timestamp: Date.now(),
        category,
        tags,
        metadata: {
          source: 'mobile_app',
          version: '1.0.0',
        },
      };

      // 保存到本地存储
      await this.saveMemoryToLocal(memory);
      
      return memory;
    } catch (error) {
      console.error('添加记忆失败:', error);
      throw error;
    }
  }

  // 获取记忆列表
  async getMemories(limit?: number, offset?: number): Promise<MemoryRecord[]> {
    try {
      // 从本地存储加载记忆
      const memories = await this.loadMemoriesFromLocal();
      
      // 排序：最新的在前面
      memories.sort((a, b) => b.timestamp - a.timestamp);
      
      // 分页
      const start = offset || 0;
      const end = limit ? start + limit : memories.length;
      
      return memories.slice(start, end);
    } catch (error) {
      console.error('获取记忆列表失败:', error);
      return [];
    }
  }

  // 获取记忆统计
  async getMemoryStats(): Promise<MemoryStats> {
    try {
      const memories = await this.loadMemoriesFromLocal();
      
      const byCategory: Record<string, number> = {};
      memories.forEach(memory => {
        const category = memory.category || '未分类';
        byCategory[category] = (byCategory[category] || 0) + 1;
      });

      // 计算最近7天的新增记忆
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentCount = memories.filter(m => m.timestamp > sevenDaysAgo).length;

      return {
        total: memories.length,
        byCategory,
        recentCount,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('获取记忆统计失败:', error);
      return {
        total: 0,
        byCategory: {},
        recentCount: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  // 删除记忆
  async deleteMemory(memoryId: string): Promise<boolean> {
    try {
      const memories = await this.loadMemoriesFromLocal();
      const filteredMemories = memories.filter(m => m.id !== memoryId);
      
      await AsyncStorage.setItem('@memories', JSON.stringify(filteredMemories));
      return true;
    } catch (error) {
      console.error('删除记忆失败:', error);
      return false;
    }
  }

  // 私有方法：保存记忆到本地
  private async saveMemoryToLocal(memory: MemoryRecord): Promise<void> {
    try {
      const memories = await this.loadMemoriesFromLocal();
      memories.push(memory);
      await AsyncStorage.setItem('@memories', JSON.stringify(memories));
    } catch (error) {
      console.error('保存记忆到本地失败:', error);
      throw error;
    }
  }

  // 私有方法：从本地加载记忆
  private async loadMemoriesFromLocal(): Promise<MemoryRecord[]> {
    try {
      const memoriesJson = await AsyncStorage.getItem('@memories');
      return memoriesJson ? JSON.parse(memoriesJson) : [];
    } catch (error) {
      console.error('从本地加载记忆失败:', error);
      return [];
    }
  }

  // 清除所有记忆
  async clearAllMemories(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem('@memories');
      return true;
    } catch (error) {
      console.error('清除所有记忆失败:', error);
      return false;
    }
  }

  // 获取服务状态
  async getServiceStatus() {
    return {
      api_key_configured: !!this.config.apiKey,
      time_service_available: !!this.config.apiKey,
      memory_service_available: true,
      last_checked: new Date().toISOString(),
    };
  }
}

// 创建单例实例
export const mcpApiService = new McpApiService();

export default mcpApiService;