/**
 * 导出格式化器
 * 提供病史报告到不同格式的转换功能
 */

import type { MedicalHistoryReport } from '../services/medical-history.service.js';
import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';

// ==================== 类型定义 ====================

/** 导出格式选项 */
export interface ExportFormatterOptions {
  /** 是否添加水印 */
  watermark?: boolean;
  /** 文档标题 */
  title?: string;
  /** 字体大小 */
  fontSize?: number;
  /** 页边距（点） */
  margin?: number;
}

// ==================== PDF格式化器 ====================

/**
 * 格式化病史报告为PDF
 * @param report 病史报告
 * @param filePath 输出文件路径
 * @param options 格式化选项
 */
export async function formatAsPdf(
  report: MedicalHistoryReport,
  filePath: string,
  options: ExportFormatterOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: options.margin || 50,
        info: {
          Title: options.title || '病史报告',
          Author: 'OpenRD 健康助手',
          Subject: '患者病史报告',
          Keywords: '病史,医疗,健康,报告',
          Creator: 'OpenRD API',
          CreationDate: new Date(),
        },
      });

      // 创建写入流
      const stream = createWriteStream(filePath);
      doc.pipe(stream);

      // 添加水印（如果需要）
      if (options.watermark) {
        addWatermark(doc);
      }

      // 生成PDF内容
      generatePdfContent(doc, report, options);

      // 完成文档
      doc.end();

      stream.on('finish', () => resolve());
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

/** 添加水印 */
function addWatermark(doc: PDFKit.PDFDocument): void {
  doc.save();
  doc.rotate(45);
  doc.opacity(0.1);
  doc.fontSize(60);
  doc.fillColor('gray');
  doc.text('OpenRD 健康助手', 50, 300);
  doc.restore();
  doc.opacity(1);
}

/** 生成PDF内容 */
function generatePdfContent(
  doc: PDFKit.PDFDocument,
  report: MedicalHistoryReport,
  options: ExportFormatterOptions
): void {
  const fontSize = options.fontSize || 12;
  const titleSize = fontSize + 6;
  const headingSize = fontSize + 2;

  // 标题
  doc.fontSize(titleSize).font('Helvetica-Bold');
  doc.text('病史报告', { align: 'center' });
  doc.moveDown(0.5);

  // 报告信息
  doc.fontSize(fontSize).font('Helvetica');
  doc.text(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
  doc.text(`患者ID: ${report.patientId}`);
  if (report.patientInfo.name) {
    doc.text(`姓名: ${report.patientInfo.name}`);
  }
  if (report.patientInfo.age) {
    doc.text(`年龄: ${report.patientInfo.age}`);
  }
  if (report.patientInfo.gender) {
    doc.text(`性别: ${report.patientInfo.gender}`);
  }
  doc.text(`报告时间范围: ${report.timeRange.start} 至 ${report.timeRange.end}`);
  doc.moveDown(1);

  // 症状时间线
  if (report.symptomTimeline.length > 0) {
    doc.fontSize(headingSize).font('Helvetica-Bold');
    doc.text('症状时间线');
    doc.fontSize(fontSize).font('Helvetica');
    report.symptomTimeline.forEach((symptom, index) => {
      doc.text(`${index + 1}. ${symptom.symptom}`);
      doc.text(`   首次报告: ${symptom.firstReported}`);
      doc.text(`   最后报告: ${symptom.lastReported}`);
      doc.text(`   频率: ${symptom.frequency}`);
      doc.text(`   严重程度: ${symptom.severity}`);
      doc.text(`   描述: ${symptom.description}`);
      doc.moveDown(0.5);
    });
    doc.moveDown(1);
  }

  // 历史记忆摘要
  if (report.memorySummary.length > 0) {
    doc.fontSize(headingSize).font('Helvetica-Bold');
    doc.text('历史记忆摘要');
    doc.fontSize(fontSize).font('Helvetica');
    report.memorySummary.forEach((memory, index) => {
      doc.text(`${index + 1}. ${memory.date}`);
      doc.text(`   内容: ${memory.content}`);
      if (memory.symptoms.length > 0) {
        doc.text(`   相关症状: ${memory.symptoms.join('、')}`);
      }
      doc.moveDown(0.5);
    });
    doc.moveDown(1);
  }

  // 医疗史
  doc.fontSize(headingSize).font('Helvetica-Bold');
  doc.text('医疗史');
  doc.fontSize(fontSize).font('Helvetica');
  const medicalHistory = report.medicalHistory;
  if (medicalHistory.preExistingConditions.length > 0) {
    doc.text(`既往病史: ${medicalHistory.preExistingConditions.join('、')}`);
  }
  if (medicalHistory.medications.length > 0) {
    doc.text(`当前用药: ${medicalHistory.medications.join('、')}`);
  }
  if (medicalHistory.allergies.length > 0) {
    doc.text(`过敏史: ${medicalHistory.allergies.join('、')}`);
  }
  if (medicalHistory.familyHistory.length > 0) {
    doc.text(`家族病史: ${medicalHistory.familyHistory.join('、')}`);
  }
  doc.moveDown(1);

  // 报告总结
  doc.fontSize(headingSize).font('Helvetica-Bold');
  doc.text('报告总结');
  doc.fontSize(fontSize).font('Helvetica');
  doc.text(report.summary);
  doc.moveDown(1);

  // 就医建议
  doc.fontSize(headingSize).font('Helvetica-Bold');
  doc.text('就医建议');
  doc.fontSize(fontSize).font('Helvetica');
  report.recommendations.forEach((rec, index) => {
    doc.text(`${index + 1}. ${rec}`);
  });
  doc.moveDown(2);

  // 页脚
  doc.fontSize(fontSize - 2).font('Helvetica-Oblique');
  doc.text('注：本报告基于用户提供的信息生成，仅供参考，不作为医疗诊断依据。', {
    align: 'center',
  });
  doc.text(`生成时间: ${new Date().toISOString()}`, { align: 'center' });
}

// ==================== JSON格式化器 ====================

/**
 * 格式化病史报告为JSON
 * @param report 病史报告
 * @param filePath 输出文件路径
 * @param options 格式化选项
 */
export async function formatAsJson(
  report: MedicalHistoryReport,
  filePath: string,
  options: ExportFormatterOptions = {}
): Promise<void> {
  const jsonData = {
    ...report,
    // 添加导出元数据
    exportMetadata: {
      ...report.exportMetadata,
      generatedAt: new Date().toISOString(),
      format: 'json',
      version: '1.0',
    },
  };

  const jsonString = JSON.stringify(jsonData, null, 2);
  await fs.writeFile(filePath, jsonString, 'utf-8');
}

// ==================== 文本格式化器 ====================

/**
 * 格式化病史报告为文本
 * @param report 病史报告
 * @param filePath 输出文件路径
 * @param options 格式化选项
 */
export async function formatAsText(
  report: MedicalHistoryReport,
  filePath: string,
  options: ExportFormatterOptions = {}
): Promise<void> {
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
  
  // 医疗史
  lines.push('【医疗史】');
  const medicalHistory = report.medicalHistory;
  if (medicalHistory.preExistingConditions.length > 0) {
    lines.push(`既往病史: ${medicalHistory.preExistingConditions.join('、')}`);
  }
  if (medicalHistory.medications.length > 0) {
    lines.push(`当前用药: ${medicalHistory.medications.join('、')}`);
  }
  if (medicalHistory.allergies.length > 0) {
    lines.push(`过敏史: ${medicalHistory.allergies.join('、')}`);
  }
  if (medicalHistory.familyHistory.length > 0) {
    lines.push(`家族病史: ${medicalHistory.familyHistory.join('、')}`);
  }
  lines.push('');
  
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
  lines.push(`生成时间: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  
  const textContent = lines.join('\n');
  await fs.writeFile(filePath, textContent, 'utf-8');
}

// ==================== 工具函数 ====================

/**
 * 根据格式选择合适的格式化器
 * @param format 导出格式
 * @returns 格式化函数
 */
export function getFormatter(
  format: 'pdf' | 'json' | 'text'
): (report: MedicalHistoryReport, filePath: string, options?: ExportFormatterOptions) => Promise<void> {
  switch (format) {
    case 'pdf':
      return formatAsPdf;
    case 'json':
      return formatAsJson;
    case 'text':
      return formatAsText;
    default:
      throw new Error(`不支持的导出格式: ${format}`);
  }
}

/**
 * 获取文件扩展名
 * @param format 导出格式
 * @returns 文件扩展名
 */
export function getFileExtension(format: 'pdf' | 'json' | 'text'): string {
  return format;
}

/**
 * 获取Content-Type
 * @param format 导出格式
 * @returns MIME类型
 */
export function getContentType(format: 'pdf' | 'json' | 'text'): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    json: 'application/json',
    text: 'text/plain',
  };
  return map[format] || 'application/octet-stream';
}