import AsyncStorage from '@react-native-async-storage/async-storage';

// 病史导出API服务接口
export interface ExportOptions {
  format: 'pdf' | 'json' | 'text';
  startDate: Date;
  endDate: Date;
  patientName: string;
  patientAge?: string;
  patientGender?: string;
  includeMemories: boolean;
  includeTimeline: boolean;
  includeSymptoms: boolean;
}

export interface ExportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  options: ExportOptions;
  createdAt: number;
  completedAt?: number;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  error?: string;
}

export interface ExportHistoryItem {
  id: string;
  fileName: string;
  fileSize: string;
  format: string;
  createdAt: number;
  downloadUrl?: string;
}

class MedicalHistoryApiService {
  private baseUrl = 'http://localhost:3000/api'; // 默认后端API地址

  // 导出病史报告
  async exportMedicalHistory(options: ExportOptions): Promise<ExportJob> {
    try {
      // 创建导出任务
      const job: ExportJob = {
        id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'processing',
        options,
        createdAt: Date.now(),
      };

      // 保存任务到本地
      await this.saveExportJob(job);

      // 模拟导出过程
      setTimeout(async () => {
        try {
          // 模拟导出完成
          const completedJob: ExportJob = {
            ...job,
            status: 'completed',
            completedAt: Date.now(),
            fileName: `病史报告_${options.patientName}_${new Date().toISOString().split('T')[0]}.${options.format}`,
            fileSize: this.generateFileSize(options.format),
            fileUrl: `https://example.com/exports/${job.id}.${options.format}`,
          };

          // 更新任务状态
          await this.updateExportJob(completedJob);
          
          // 保存到导出历史
          await this.addToExportHistory(completedJob);
        } catch (error) {
          console.error('导出过程失败:', error);
          
          // 更新为失败状态
          const failedJob: ExportJob = {
            ...job,
            status: 'failed',
            completedAt: Date.now(),
            error: error instanceof Error ? error.message : '导出失败',
          };
          
          await this.updateExportJob(failedJob);
        }
      }, 3000);

      return job;
    } catch (error) {
      console.error('创建导出任务失败:', error);
      throw error;
    }
  }

  // 获取导出任务状态
  async getExportJobStatus(jobId: string): Promise<ExportJob | null> {
    try {
      const jobs = await this.loadExportJobs();
      return jobs.find(job => job.id === jobId) || null;
    } catch (error) {
      console.error('获取导出任务状态失败:', error);
      return null;
    }
  }

  // 获取导出历史
  async getExportHistory(limit?: number, offset?: number): Promise<ExportHistoryItem[]> {
    try {
      const history = await this.loadExportHistory();
      
      // 排序：最新的在前面
      history.sort((a, b) => b.createdAt - a.createdAt);
      
      // 分页
      const start = offset || 0;
      const end = limit ? start + limit : history.length;
      
      return history.slice(start, end);
    } catch (error) {
      console.error('获取导出历史失败:', error);
      return [];
    }
  }

  // 下载导出文件
  async downloadExportFile(jobId: string): Promise<{ success: boolean; message: string }> {
    try {
      const job = await this.getExportJobStatus(jobId);
      
      if (!job) {
        return { success: false, message: '导出任务不存在' };
      }
      
      if (job.status !== 'completed') {
        return { success: false, message: '导出任务未完成' };
      }
      
      if (!job.fileUrl) {
        return { success: false, message: '文件URL不存在' };
      }

      // 这里应该实现实际的文件下载逻辑
      // 暂时返回成功消息
      return {
        success: true,
        message: `文件已准备下载：${job.fileName} (${job.fileSize})`,
      };
    } catch (error) {
      console.error('下载文件失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '下载失败',
      };
    }
  }

  // 删除导出历史记录
  async deleteExportHistoryItem(itemId: string): Promise<boolean> {
    try {
      const history = await this.loadExportHistory();
      const filteredHistory = history.filter(item => item.id !== itemId);
      
      await AsyncStorage.setItem('@export_history', JSON.stringify(filteredHistory));
      return true;
    } catch (error) {
      console.error('删除导出历史记录失败:', error);
      return false;
    }
  }

  // 清除所有导出历史
  async clearAllExportHistory(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem('@export_history');
      await AsyncStorage.removeItem('@export_jobs');
      return true;
    } catch (error) {
      console.error('清除导出历史失败:', error);
      return false;
    }
  }

  // 获取导出统计
  async getExportStats() {
    try {
      const history = await this.loadExportHistory();
      const jobs = await this.loadExportJobs();
      
      const byFormat: Record<string, number> = {};
      history.forEach(item => {
        byFormat[item.format] = (byFormat[item.format] || 0) + 1;
      });

      const byStatus: Record<string, number> = {};
      jobs.forEach(job => {
        byStatus[job.status] = (byStatus[job.status] || 0) + 1;
      });

      // 计算最近30天的导出数量
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentCount = history.filter(item => item.createdAt > thirtyDaysAgo).length;

      // 计算总文件大小
      const totalSize = history.reduce((total, item) => {
        const size = parseFloat(item.fileSize);
        return total + (isNaN(size) ? 0 : size);
      }, 0);

      return {
        totalExports: history.length,
        byFormat,
        byStatus,
        recentCount,
        totalSize: `${totalSize.toFixed(1)} MB`,
        lastExport: history.length > 0 ? new Date(history[0].createdAt).toLocaleString('zh-CN') : '从未导出',
      };
    } catch (error) {
      console.error('获取导出统计失败:', error);
      return {
        totalExports: 0,
        byFormat: {},
        byStatus: {},
        recentCount: 0,
        totalSize: '0 MB',
        lastExport: '从未导出',
      };
    }
  }

  // 私有方法：生成文件大小
  private generateFileSize(format: string): string {
    const sizes: Record<string, number> = {
      pdf: 2.4,
      json: 1.2,
      text: 0.8,
    };
    
    const baseSize = sizes[format] || 1.0;
    const variation = 0.5;
    const finalSize = baseSize + (Math.random() * variation);
    
    return `${finalSize.toFixed(1)} MB`;
  }

  // 私有方法：保存导出任务
  private async saveExportJob(job: ExportJob): Promise<void> {
    try {
      const jobs = await this.loadExportJobs();
      jobs.push(job);
      await AsyncStorage.setItem('@export_jobs', JSON.stringify(jobs));
    } catch (error) {
      console.error('保存导出任务失败:', error);
      throw error;
    }
  }

  // 私有方法：更新导出任务
  private async updateExportJob(updatedJob: ExportJob): Promise<void> {
    try {
      const jobs = await this.loadExportJobs();
      const index = jobs.findIndex(job => job.id === updatedJob.id);
      
      if (index !== -1) {
        jobs[index] = updatedJob;
        await AsyncStorage.setItem('@export_jobs', JSON.stringify(jobs));
      }
    } catch (error) {
      console.error('更新导出任务失败:', error);
      throw error;
    }
  }

  // 私有方法：添加到导出历史
  private async addToExportHistory(job: ExportJob): Promise<void> {
    try {
      if (job.status !== 'completed' || !job.fileName) {
        return;
      }

      const historyItem: ExportHistoryItem = {
        id: job.id,
        fileName: job.fileName,
        fileSize: job.fileSize || '未知',
        format: job.options.format,
        createdAt: job.completedAt || Date.now(),
        downloadUrl: job.fileUrl,
      };

      const history = await this.loadExportHistory();
      history.push(historyItem);
      
      await AsyncStorage.setItem('@export_history', JSON.stringify(history));
    } catch (error) {
      console.error('添加到导出历史失败:', error);
      throw error;
    }
  }

  // 私有方法：加载导出任务
  private async loadExportJobs(): Promise<ExportJob[]> {
    try {
      const jobsJson = await AsyncStorage.getItem('@export_jobs');
      return jobsJson ? JSON.parse(jobsJson) : [];
    } catch (error) {
      console.error('加载导出任务失败:', error);
      return [];
    }
  }

  // 私有方法：加载导出历史
  private async loadExportHistory(): Promise<ExportHistoryItem[]> {
    try {
      const historyJson = await AsyncStorage.getItem('@export_history');
      return historyJson ? JSON.parse(historyJson) : [];
    } catch (error) {
      console.error('加载导出历史失败:', error);
      return [];
    }
  }
}

// 创建单例实例
export const medicalHistoryApiService = new MedicalHistoryApiService();

export default medicalHistoryApiService;