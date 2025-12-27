/**
 * 病史导出服务
 * 提供病史报告生成、格式化和导出功能
 */

import { getMemoryManager } from './memory-manager.service.js';
import { getTimeService } from './time-service.js';
import { getPool } from '../db/pool.js';
import type {
  MemoryMetadata,
  ExtractedSymptom,
  MemoryType,
} from '../types/mcp.types.js';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// ==================== 类型定义 ====================

/** 病史导出选项 */
export interface MedicalHistoryExportOptions {
  /** 导出格式 */
  format?: 'pdf' | 'json' | 'text';
  /** 时间范围 */
  timeRange?: {
    start: string; // ISO日期字符串
    end: string;   // ISO日期字符串
  };
  /** 是否包含详细记忆 */
  includeMemories?: boolean;
  /** 是否包含症状时间线 */
  includeTimeline?: boolean;
  /** 患者信息（可选） */
  patientInfo?: {
    name?: string;
    age?: number;
    gender?: string;
  };
}

/** 病史报告数据结构 */
export interface MedicalHistoryReport {
  patientId: string;
  generatedAt: string;
  timeRange: { start: string; end: string };
  patientInfo: { name?: string; age?: number; gender?: string };
  symptomTimeline: Array<{
    symptom: string;
    firstReported: string;
    lastReported: string;
    frequency: string;
    severity: string;
    description: string;
  }>;
  memorySummary: Array<{
    date: string;
    content: string;
    symptoms: string[];
    keyPoints: string[];
  }>;
  medicalHistory: {
    preExistingConditions: string[];
    medications: string[];
    allergies: string[];
    familyHistory: string[];
  };
  summary: string;
  recommendations: string[];
  exportMetadata: {
    format: 'pdf' | 'json' | 'text';
    fileSize: number;
    downloadUrl: string;
  };
}

/** 数据库导出记录 */
export interface ExportRecord {
  id: string;
  userId: string;
  exportType: 'full' | 'timeline' | 'summary';
  fileFormat: 'pdf' | 'json' | 'txt';
  filePath: string;
  fileSize: number;
  memoryIds: string[];
  exportOptions: Record<string, any>;
  generatedAt: Date;
  expiresAt: Date | null;
  downloadCount: number;
}

// ==================== 病史导出服务类 ====================

/** 病史导出服务 */
export class MedicalHistoryService {
  private memoryManager = getMemoryManager();
  private timeService = getTimeService();

  constructor() {}

  /**
   * 生成病史报告
   * @param userId 用户ID
   * @param options 导出选项
   * @returns 病史报告数据
   */
  async generateMedicalHistory(
    userId: string,
    options: MedicalHistoryExportOptions = {}
  ): Promise<MedicalHistoryReport> {
    const {
      format = 'pdf',
      timeRange,
      includeMemories = true,
      includeTimeline = true,
      patientInfo = {},
    } = options;

    // 确定时间范围
    const defaultEnd = new Date().toISOString();
    const defaultStart = new Date();
    defaultStart.setMonth(defaultStart.getMonth() - 6); // 默认过去6个月
    const startDate = timeRange?.start || defaultStart.toISOString();
    const endDate = timeRange?.end || defaultEnd;

    // 获取记忆数据
    const memories = includeMemories
      ? await this.memoryManager.retrieveMemories({
          userId,
          startDate,
          endDate,
          limit: 100, // 最多100条记忆
          types: ['symptom', 'conversation', 'medical_event'] as MemoryType[],
        })
      : { memories: [], total: 0 };

    // 构建症状时间线
    const symptomTimeline = includeTimeline
      ? await this.buildSymptomTimeline(userId, startDate, endDate)
      : [];

    // 构建记忆摘要
    const memorySummary = includeMemories
      ? await this.buildMemorySummary(memories.memories)
      : [];

    // 生成总结和建议
    const summary = await this.generateReportSummary(
      symptomTimeline,
      memorySummary,
      patientInfo
    );
    const recommendations = await this.generateRecommendations(
      symptomTimeline,
      memorySummary
    );

    // 获取当前时间
    const currentTime = await this.timeService.getCurrentTime(userId);
    const generatedAt = currentTime.current_time;

    // 构建病史报告
    const report: MedicalHistoryReport = {
      patientId: userId,
      generatedAt,
      timeRange: { start: startDate, end: endDate },
      patientInfo,
      symptomTimeline,
      memorySummary,
      medicalHistory: {
        preExistingConditions: [],
        medications: [],
        allergies: [],
        familyHistory: [],
      },
      summary,
      recommendations,
      exportMetadata: {
        format,
        fileSize: 0, // 将在导出后更新
        downloadUrl: '', // 将在保存后生成
      },
    };

    return report;
  }

  /**
   * 导出病史报告到指定格式
   * @param userId 用户ID
   * @param report 病史报告数据
   * @param format 导出格式
   * @returns 导出文件路径和元数据
   */
  async exportMedicalHistory(
    userId: string,
    report: MedicalHistoryReport,
    format: 'pdf' | 'json' | 'text'
  ): Promise<{ filePath: string; fileSize: number; downloadUrl: string }> {
    // 确保导出目录存在
    const exportsDir = path.join(process.cwd(), 'exports');
    await fs.mkdir(exportsDir, { recursive: true });

    const exportId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `medical-history-${userId}-${timestamp}.${format}`;
    const filePath = path.join(exportsDir, filename);

    let fileSize = 0;

    switch (format) {
      case 'pdf':
        await this.exportToPdf(report, filePath);
        break;
      case 'json':
        await this.exportToJson(report, filePath);
        break;
      case 'text':
        await this.exportToText(report, filePath);
        break;
    }

    // 获取文件大小
    const stats = await fs.stat(filePath);
    fileSize = stats.size;

    // 生成下载URL（相对路径）
    const downloadUrl = `/api/medical-history/exports/${exportId}/download`;

    return { filePath, fileSize, downloadUrl };
  }

  /**
   * 保存导出记录到数据库
   * @param userId 用户ID
   * @param exportData 导出数据
   * @returns 导出记录ID
   */
  async saveExportRecord(
    userId: string,
    exportData: {
      format: 'pdf' | 'json' | 'text';
      filePath: string;
      fileSize: number;
      downloadUrl: string;
      memoryIds?: string[];
      exportOptions?: Record<string, any>;
      expiresAt?: Date;
    }
  ): Promise<string> {
    const pool = getPool();
    const {
      format,
      filePath,
      fileSize,
      downloadUrl,
      memoryIds = [],
      exportOptions = {},
      expiresAt,
    } = exportData;

    // 确定导出类型（基于选项）
    const exportType = exportOptions.includeTimeline ? 'timeline' : 
                      exportOptions.includeMemories ? 'full' : 'summary';

    // 转换文件格式到数据库格式
    const dbFormat = format === 'text' ? 'txt' : format;

    const result = await pool.query(
      `INSERT INTO medical_history_exports (
        user_id, export_type, file_format, file_path, file_size,
        memory_ids, export_options, generated_at, expires_at, download_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        userId,
        exportType,
        dbFormat,
        filePath,
        fileSize,
        memoryIds,
        exportOptions,
        new Date(),
        expiresAt || null,
        0,
      ]
    );

    return result.rows[0].id;
  }

  /**
   * 获取用户的导出历史
   * @param userId 用户ID
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 导出记录列表
   */
  async getExportHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ExportRecord[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM medical_history_exports 
       WHERE user_id = $1 
       ORDER BY generated_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map(this.mapDbRowToExportRecord);
  }

  /**
   * 获取特定导出记录
   * @param exportId 导出记录ID
   * @param userId 用户ID（用于权限验证）
   * @returns 导出记录
   */
  async getExportRecord(
    exportId: string,
    userId?: string
  ): Promise<ExportRecord | null> {
    const pool = getPool();
    const query = userId
      ? `SELECT * FROM medical_history_exports WHERE id = $1 AND user_id = $2`
      : `SELECT * FROM medical_history_exports WHERE id = $1`;
    const params = userId ? [exportId, userId] : [exportId];

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return null;

    return this.mapDbRowToExportRecord(result.rows[0]);
  }

  /**
   * 增加导出记录的下载计数
   * @param exportId 导出记录ID
   */
  async incrementDownloadCount(exportId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE medical_history_exports 
       SET download_count = download_count + 1 
       WHERE id = $1`,
      [exportId]
    );
  }

  /**
   * 删除过期的导出记录
   * @returns 删除的记录数
   */
  async cleanupExpiredExports(): Promise<number> {
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM medical_history_exports 
       WHERE expires_at IS NOT NULL AND expires_at < NOW() 
       RETURNING id`
    );
    return result.rows.length;
  }

  // ==================== 内部辅助方法 ====================

  /** 构建症状时间线 */
  private async buildSymptomTimeline(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<MedicalHistoryReport['symptomTimeline']> {
    // 获取症状时间线条目
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM symptom_timeline 
       WHERE user_id = $1 
         AND occurred_at BETWEEN $2 AND $3
       ORDER BY occurred_at DESC`,
      [userId, startDate, endDate]
    );

    // 按症状分组
    const symptomsByDescription = new Map<string, any[]>();
    for (const entry of result.rows) {
      const desc = entry.symptom_description;
      if (!symptomsByDescription.has(desc)) {
        symptomsByDescription.set(desc, []);
      }
      symptomsByDescription.get(desc)!.push(entry);
    }

    // 构建时间线
    const timeline: MedicalHistoryReport['symptomTimeline'] = [];
    for (const [description, entries] of symptomsByDescription) {
      const sorted = entries.sort(
        (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      // 计算频率
      const frequency = this.calculateFrequency(sorted);

      timeline.push({
        symptom: description,
        firstReported: first.occurred_at,
        lastReported: last.occurred_at,
        frequency,
        severity: this.getSeverityText(last.severity),
        description: this.generateSymptomDescription(description, sorted),
      });
    }

    return timeline;
  }

  /** 构建记忆摘要 */
  private async buildMemorySummary(
    memories: MemoryMetadata[]
  ): Promise<MedicalHistoryReport['memorySummary']> {
    return memories.slice(0, 20).map((memory) => ({
      date: memory.metadata?.createdAt || new Date().toISOString(),
      content: memory.content?.summary || '无摘要',
      symptoms: memory.content?.extractedSymptoms?.map((s: ExtractedSymptom) => s.description) || [],
      keyPoints: [
        memory.content?.summary || '无关键点',
        ...(memory.content?.concerns || []),
      ],
    }));
  }

  /** 生成报告总结 */
  private async generateReportSummary(
    symptomTimeline: MedicalHistoryReport['symptomTimeline'],
    memorySummary: MedicalHistoryReport['memorySummary'],
    patientInfo: MedicalHistoryReport['patientInfo']
  ): Promise<string> {
    const symptomCount = symptomTimeline.length;
    const memoryCount = memorySummary.length;

    const patientName = patientInfo.name || '患者';
    const ageText = patientInfo.age ? `${patientInfo.age}岁` : '';
    const genderText = patientInfo.gender || '';

    let summary = `本报告为${patientName}${ageText}${genderText ? genderText : ''}的病史总结。`;

    if (symptomCount > 0) {
      const symptomNames = symptomTimeline.map(s => s.symptom).join('、');
      summary += ` 共记录${symptomCount}种症状：${symptomNames}。`;
    }

    if (memoryCount > 0) {
      summary += ` 基于${memoryCount}条历史记忆生成。`;
    }

    // 添加时间范围说明
    if (symptomTimeline.length > 0) {
      const firstSymptom = symptomTimeline[symptomTimeline.length - 1];
      const lastSymptom = symptomTimeline[0];
      summary += ` 症状记录时间从${new Date(firstSymptom.firstReported).toLocaleDateString('zh-CN')}到${new Date(lastSymptom.lastReported).toLocaleDateString('zh-CN')}。`;
    }

    summary += ` 本报告旨在帮助患者与医生更有效地交流病情，不作为医疗诊断依据。`;

    return summary;
  }

  /** 生成建议 */
  private async generateRecommendations(
    symptomTimeline: MedicalHistoryReport['symptomTimeline'],
    memorySummary: MedicalHistoryReport['memorySummary']
  ): Promise<string[]> {
    const recommendations: string[] = [
      '请携带本报告就医，帮助医生快速了解您的病情历史',
      '定期记录症状变化，建立个人健康档案',
      '如症状加重或出现新症状，请及时就医',
    ];

    if (symptomTimeline.length > 0) {
      recommendations.push('建议向医生详细描述症状时间线和频率');
    }

    if (memorySummary.length > 5) {
      recommendations.push('丰富的病史记录有助于医生做出更准确的诊断');
    }

    return recommendations;
  }

  /** 计算症状频率 */
  private calculateFrequency(entries: any[]): string {
    if (entries.length <= 1) return '单次';
    
    const firstDate = new Date(entries[0].occurred_at);
    const lastDate = new Date(entries[entries.length - 1].occurred_at);
    const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff < 1) return '日内多次';
    if (daysDiff < 7) return '频繁';
    if (daysDiff < 30) return '每周数次';
    if (daysDiff < 90) return '每月数次';
    return '偶发';
  }

  /** 获取严重程度文本 */
  private getSeverityText(severity: number | null): string {
    if (!severity) return '未知';
    if (severity <= 3) return '轻度';
    if (severity <= 6) return '中度';
    return '重度';
  }

  /** 生成症状描述 */
  private generateSymptomDescription(description: string, entries: any[]): string {
    const count = entries.length;
    const severities = entries.map(e => e.severity).filter(Boolean);
    const avgSeverity = severities.length > 0 
      ? severities.reduce((a, b) => a + b, 0) / severities.length 
      : null;
    
    let desc = `${description}，共记录${count}次`;
    if (avgSeverity) {
      desc += `，平均严重程度${this.getSeverityText(avgSeverity)}`;
    }
    return desc;
  }

  /** 导出为PDF */
  private async exportToPdf(report: MedicalHistoryReport, filePath: string): Promise<void> {
    // 临时实现：创建简单的PDF文件
    // 实际项目中应使用pdfkit等库生成格式化的PDF
    const pdfContent = this.generatePdfContent(report);
    await fs.writeFile(filePath, pdfContent);
  }

  /** 导出为JSON */
  private async exportToJson(report: MedicalHistoryReport, filePath: string): Promise<void> {
    const jsonContent = JSON.stringify(report, null, 2);
    await fs.writeFile(filePath, jsonContent);
  }

  /** 导出为文本 */
  private async exportToText(report: MedicalHistoryReport, filePath: string): Promise<void> {
    const textContent = this.generateTextContent(report);
    await fs.writeFile(filePath, textContent);
  }

  /** 生成PDF内容（简化版） */
  private generatePdfContent(report: MedicalHistoryReport): string {
    // 实际项目中应使用pdfkit生成真正的PDF
    // 这里返回文本内容作为占位符
    return this.generateTextContent(report);
  }

  /** 生成文本内容 */
  private generateTextContent(report: MedicalHistoryReport): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(60));
    lines.push(`病史报告 - ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
    lines.push('='.repeat(60));
    lines.push('');
    
    // 患者信息
    lines.push('【患者信息】');
    lines.push(`患者ID: ${report.patientId}`);
    if (report.patientInfo.name) lines.push(`姓名: ${report.patientInfo.name}`);
    if (report.patientInfo.age) lines.push(`年龄: ${report.patientInfo.age}`);
    if (report.patientInfo.gender) lines.push(`性别: ${report.patientInfo.gender}`);
    lines.push(`报告时间范围: ${report.timeRange.start} 至 ${report.timeRange.end}`);
    lines.push('');
    
    // 症状时间线
    if (report.symptomTimeline.length > 0) {
      lines.push('【症状时间线】');
      report.symptomTimeline.forEach((symptom, index) => {
        lines.push(`${index + 1}. ${symptom.symptom}`);
        lines.push(`   首次报告: ${symptom.firstReported}`);
        lines.push(`   最后报告: ${symptom.lastReported}`);
        lines.push(`   频率: ${symptom.frequency}`);
        lines.push(`   严重程度: ${symptom.severity}`);
        lines.push(`   描述: ${symptom.description}`);
        lines.push('');
      });
    }
    
    // 记忆摘要
    if (report.memorySummary.length > 0) {
      lines.push('【历史记忆摘要】');
      report.memorySummary.forEach((memory, index) => {
        lines.push(`${index + 1}. ${memory.date}`);
        lines.push(`   内容: ${memory.content}`);
        if (memory.symptoms.length > 0) {
          lines.push(`   相关症状: ${memory.symptoms.join('、')}`);
        }
        lines.push('');
      });
    }
    
    // 总结
    lines.push('【报告总结】');
    lines.push(report.summary);
    lines.push('');
    
    // 建议
    lines.push('【就医建议】');
    report.recommendations.forEach((rec, index) => {
      lines.push(`${index + 1}. ${rec}`);
    });
    lines.push('');
    
    lines.push('='.repeat(60));
    lines.push('注：本报告基于用户提供的信息生成，仅供参考，不作为医疗诊断依据。');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }

  /** 映射数据库行到导出记录 */
  private mapDbRowToExportRecord(row: any): ExportRecord {
    return {
      id: row.id,
      userId: row.user_id,
      exportType: row.export_type,
      fileFormat: row.file_format,
      filePath: row.file_path,
      fileSize: row.file_size,
      memoryIds: row.memory_ids || [],
      exportOptions: row.export_options || {},
      generatedAt: row.generated_at,
      expiresAt: row.expires_at,
      downloadCount: row.download_count,
    };
  }
}

// ==================== 导出单例实例 ====================

/** 全局病史导出服务实例 */
let medicalHistoryServiceInstance: MedicalHistoryService | null = null;

/** 获取病史导出服务实例（单例模式） */
export function getMedicalHistoryService(): MedicalHistoryService {
  if (!medicalHistoryServiceInstance) {
    medicalHistoryServiceInstance = new MedicalHistoryService();
  }
  
  return medicalHistoryServiceInstance;
}

/** 重置病史导出服务实例（主要用于测试） */
export function resetMedicalHistoryService(): void {
  medicalHistoryServiceInstance = null;
}