/**
 * 病史导出路由
 * 提供病史报告生成、导出和管理功能
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getMedicalHistoryService } from '../services/medical-history.service.js';
import type { MedicalHistoryExportOptions } from '../services/medical-history.service.js';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';

const router = Router();

// ==================== 辅助函数 ====================

/** 验证导出选项 */
function validateExportOptions(options: any): { valid: boolean; error?: string } {
  if (!options) return { valid: true };
  
  // 验证格式
  if (options.format && !['pdf', 'json', 'text'].includes(options.format)) {
    return { valid: false, error: 'format必须是pdf、json或text' };
  }
  
  // 验证时间范围
  if (options.timeRange) {
    const { start, end } = options.timeRange;
    if (start && !isValidDate(start)) {
      return { valid: false, error: 'timeRange.start必须是有效的ISO日期字符串' };
    }
    if (end && !isValidDate(end)) {
      return { valid: false, error: 'timeRange.end必须是有效的ISO日期字符串' };
    }
    if (start && end && new Date(start) > new Date(end)) {
      return { valid: false, error: 'timeRange.start不能晚于timeRange.end' };
    }
  }
  
  // 验证患者信息
  if (options.patientInfo) {
    const { age, gender } = options.patientInfo;
    if (age !== undefined && (typeof age !== 'number' || age < 0 || age > 150)) {
      return { valid: false, error: 'age必须是0-150之间的数字' };
    }
    if (gender && !['男', '女', '其他'].includes(gender)) {
      return { valid: false, error: 'gender必须是男、女或其他' };
    }
  }
  
  return { valid: true };
}

/** 验证日期字符串 */
function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/** 获取用户ID（从认证中间件） */
function getUserId(req: any): string {
  return req.user?.id;
}

// ==================== API端点 ====================

/**
 * POST /api/medical-history/generate
 * 生成病史报告
 */
router.post(
  '/generate',
  authenticate,
  async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: '用户未认证' });
      }

      const options: MedicalHistoryExportOptions = req.body || {};
      
      // 验证选项
      const validation = validateExportOptions(options);
      if (!validation.valid) {
        return res.status(400).json({ 
          success: false, 
          message: '请求参数无效',
          detail: validation.error 
        });
      }

      const service = getMedicalHistoryService();
      
      // 生成病史报告
      const report = await service.generateMedicalHistory(userId, options);
      
      // 导出为指定格式
      const format = options.format || 'pdf';
      const exportResult = await service.exportMedicalHistory(userId, report, format);
      
      // 保存导出记录
      const memoryIds = report.memorySummary.map(m => m.date); // 简化处理，实际应使用真实记忆ID
      const exportRecordId = await service.saveExportRecord(userId, {
        format,
        filePath: exportResult.filePath,
        fileSize: exportResult.fileSize,
        downloadUrl: exportResult.downloadUrl,
        memoryIds,
        exportOptions: options,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
      });

      // 更新报告中的导出元数据
      report.exportMetadata.fileSize = exportResult.fileSize;
      report.exportMetadata.downloadUrl = exportResult.downloadUrl;

      return res.status(201).json({
        success: true,
        data: {
          report,
          exportRecord: {
            id: exportRecordId,
            downloadUrl: exportResult.downloadUrl,
            fileSize: exportResult.fileSize,
            format,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
        },
      });
    } catch (error: any) {
      console.error('病史报告生成失败:', error);
      return res.status(500).json({
        success: false,
        message: '病史报告生成失败',
        detail: error.message,
      });
    }
  }
);

/**
 * GET /api/medical-history/exports
 * 获取用户的导出历史
 */
router.get(
  '/exports',
  authenticate,
  async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, message: '用户未认证' });
      }

      const { limit = '20', offset = '0' } = req.query;
      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({ 
          success: false, 
          message: 'limit必须是1-100之间的数字' 
        });
      }
      if (isNaN(offsetNum) || offsetNum < 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'offset必须是非负整数' 
        });
      }

      const service = getMedicalHistoryService();
      const exports = await service.getExportHistory(userId, limitNum, offsetNum);

      return res.json({
        success: true,
        data: {
          exports,
          pagination: {
            limit: limitNum,
            offset: offsetNum,
            total: exports.length,
          },
        },
      });
    } catch (error: any) {
      console.error('获取导出历史失败:', error);
      return res.status(500).json({
        success: false,
        message: '获取导出历史失败',
        detail: error.message,
      });
    }
  }
);

/**
 * GET /api/medical-history/exports/:exportId
 * 获取特定导出记录
 */
router.get(
  '/exports/:exportId',
  authenticate,
  async (req, res) => {
    try {
      const userId = getUserId(req);
      const { exportId } = req.params;

      const service = getMedicalHistoryService();
      const exportRecord = await service.getExportRecord(exportId, userId);

      if (!exportRecord) {
        return res.status(404).json({
          success: false,
          message: '导出记录不存在或无权访问',
        });
      }

      return res.json({
        success: true,
        data: { exportRecord },
      });
    } catch (error: any) {
      console.error('获取导出记录失败:', error);
      return res.status(500).json({
        success: false,
        message: '获取导出记录失败',
        detail: error.message,
      });
    }
  }
);

/**
 * GET /api/medical-history/exports/:exportId/download
 * 下载导出的文件
 */
router.get(
  '/exports/:exportId/download',
  authenticate,
  async (req, res) => {
    try {
      const userId = getUserId(req);
      const { exportId } = req.params;

      const service = getMedicalHistoryService();
      const exportRecord = await service.getExportRecord(exportId, userId);

      if (!exportRecord) {
        return res.status(404).json({
          success: false,
          message: '导出记录不存在或无权访问',
        });
      }

      // 检查文件是否存在
      try {
        await fs.access(exportRecord.filePath);
      } catch {
        return res.status(404).json({
          success: false,
          message: '导出文件不存在',
        });
      }

      // 增加下载计数
      await service.incrementDownloadCount(exportId);

      // 确定Content-Type
      const contentTypeMap: Record<string, string> = {
        pdf: 'application/pdf',
        json: 'application/json',
        txt: 'text/plain',
      };
      const contentType = contentTypeMap[exportRecord.fileFormat] || 'application/octet-stream';

      // 设置下载头
      const filename = path.basename(exportRecord.filePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', exportRecord.fileSize);

      // 流式传输文件
      const fileStream = createReadStream(exportRecord.filePath);
      fileStream.pipe(res);
      
      // 处理流错误
      fileStream.on('error', (error: any) => {
        console.error('文件流错误:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: '文件下载失败',
          });
        }
      });
    } catch (error: any) {
      console.error('下载导出文件失败:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: '下载导出文件失败',
          detail: error.message,
        });
      }
    }
  }
);

/**
 * POST /api/medical-history/cleanup
 * 清理过期的导出记录（管理员功能）
 */
router.post(
  '/cleanup',
  authenticate,
  async (req, res) => {
    try {
      const userId = getUserId(req);
      // 在实际项目中，这里应检查用户权限（例如是否为管理员）
      // 简化处理：允许所有认证用户调用
      
      const service = getMedicalHistoryService();
      const cleanedCount = await service.cleanupExpiredExports();

      return res.json({
        success: true,
        data: {
          message: `已清理${cleanedCount}个过期的导出记录`,
          cleanedCount,
        },
      });
    } catch (error: any) {
      console.error('清理导出记录失败:', error);
      return res.status(500).json({
        success: false,
        message: '清理导出记录失败',
        detail: error.message,
      });
    }
  }
);

export { router as medicalHistoryRoutes };