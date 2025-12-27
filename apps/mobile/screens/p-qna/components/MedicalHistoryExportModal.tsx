import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';

interface MedicalHistoryExportModalProps {
  visible: boolean;
  onClose: () => void;
  onExport: (exportOptions: ExportOptions) => void;
}

interface ExportOptions {
  format: 'pdf' | 'json' | 'text';
  startDate: Date;
  endDate: Date;
  patientName: string;
  patientAge: string;
  patientGender: string;
  includeMemories: boolean;
  includeTimeline: boolean;
  includeSymptoms: boolean;
}

const MedicalHistoryExportModal: React.FC<MedicalHistoryExportModalProps> = ({
  visible,
  onClose,
  onExport,
}) => {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前
    endDate: new Date(),
    patientName: '',
    patientAge: '',
    patientGender: '',
    includeMemories: true,
    includeTimeline: true,
    includeSymptoms: true,
  });
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    fileUrl?: string;
    fileName?: string;
    fileSize?: string;
    exportTime?: string;
  } | null>(null);

  const handleFormatSelect = (format: 'pdf' | 'json' | 'text') => {
    setExportOptions({ ...exportOptions, format });
  };

  const handleStartDateChange = () => {
    // 这里应该实现日期选择器
    Alert.alert('提示', '日期选择功能需要集成日期选择器组件');
  };

  const handleEndDateChange = () => {
    // 这里应该实现日期选择器
    Alert.alert('提示', '日期选择功能需要集成日期选择器组件');
  };

  const handleToggleOption = (option: keyof Pick<ExportOptions, 'includeMemories' | 'includeTimeline' | 'includeSymptoms'>) => {
    setExportOptions({
      ...exportOptions,
      [option]: !exportOptions[option],
    });
  };

  const handleExport = async () => {
    // 验证必填字段
    if (!exportOptions.patientName.trim()) {
      Alert.alert('提示', '请输入患者姓名');
      return;
    }

    if (exportOptions.startDate > exportOptions.endDate) {
      Alert.alert('提示', '开始日期不能晚于结束日期');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportResult(null);

    // 模拟导出进度
    const progressInterval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 300);

    // 模拟导出过程
    setTimeout(() => {
      clearInterval(progressInterval);
      setIsExporting(false);
      setExportProgress(100);

      // 模拟导出结果
      const result = {
        success: true,
        fileUrl: 'https://example.com/export/medical-history.pdf',
        fileName: `病史报告_${exportOptions.patientName}_${new Date().toISOString().split('T')[0]}.${exportOptions.format}`,
        fileSize: '2.4 MB',
        exportTime: new Date().toLocaleString('zh-CN'),
      };

      setExportResult(result);
      
      // 调用父组件的导出回调
      onExport(exportOptions);
      
      Alert.alert('导出成功', '病史报告已成功导出');
    }, 3000);
  };

  const handleDownload = () => {
    if (exportResult?.fileUrl) {
      Alert.alert('下载文件', `文件已准备就绪：${exportResult.fileName}\n大小：${exportResult.fileSize}`);
      // 这里应该实现实际的文件下载逻辑
    }
  };

  const handleReset = () => {
    setExportOptions({
      format: 'pdf',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      patientName: '',
      patientAge: '',
      patientGender: '',
      includeMemories: true,
      includeTimeline: true,
      includeSymptoms: true,
    });
    setExportResult(null);
    setExportProgress(0);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={{
            backgroundColor: '#1A1A2E',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            maxHeight: '90%',
          }}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 标题栏 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <FontAwesome6 name="file-export" size={20} color="#969FFF" />
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF', marginLeft: 12, flex: 1 }}>
                病史报告导出
              </Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <FontAwesome6 name="xmark" size={20} color="rgba(255, 255, 255, 0.5)" />
              </TouchableOpacity>
            </View>

            {/* 导出结果展示 */}
            {exportResult && (
              <View style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                padding: 16,
                borderRadius: 8,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: 'rgba(16, 185, 129, 0.2)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <FontAwesome6 name="check-circle" size={20} color="#10B981" />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginLeft: 12 }}>
                    导出成功
                  </Text>
                </View>
                
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 4 }}>
                    文件名：{exportResult.fileName}
                  </Text>
                  <Text style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 4 }}>
                    文件大小：{exportResult.fileSize}
                  </Text>
                  <Text style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>
                    导出时间：{exportResult.exportTime}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={{
                    backgroundColor: '#10B981',
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: 'center',
                    marginTop: 8,
                  }}
                  onPress={handleDownload}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }}>
                    下载文件
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 导出进度 */}
            {isExporting && (
              <View style={{
                backgroundColor: 'rgba(150, 159, 255, 0.1)',
                padding: 16,
                borderRadius: 8,
                marginBottom: 20,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <ActivityIndicator size="small" color="#969FFF" />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginLeft: 12 }}>
                    正在导出病史报告...
                  </Text>
                </View>
                
                <View style={{ marginBottom: 8 }}>
                  <View style={{
                    height: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}>
                    <View style={{
                      width: `${exportProgress}%`,
                      height: '100%',
                      backgroundColor: '#969FFF',
                      borderRadius: 4,
                    }} />
                  </View>
                  <Text style={{
                    fontSize: 12,
                    color: 'rgba(255, 255, 255, 0.7)',
                    textAlign: 'center',
                    marginTop: 4,
                  }}>
                    {exportProgress}%
                  </Text>
                </View>
                
                <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' }}>
                  请稍候，正在生成报告...
                </Text>
              </View>
            )}

            {/* 导出格式选择 */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: '#FFFFFF', marginBottom: 12 }}>
                导出格式
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(['pdf', 'json', 'text'] as const).map((format) => (
                  <TouchableOpacity
                    key={format}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      backgroundColor: exportOptions.format === format ? '#969FFF' : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 8,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: exportOptions.format === format ? '#969FFF' : 'rgba(255, 255, 255, 0.1)',
                    }}
                    onPress={() => handleFormatSelect(format)}
                    activeOpacity={0.7}
                  >
                    <FontAwesome6
                      name={format === 'pdf' ? 'file-pdf' : format === 'json' ? 'code' : 'file-lines'}
                      size={16}
                      color={exportOptions.format === format ? '#FFFFFF' : '#969FFF'}
                    />
                    <Text style={{
                      fontSize: 12,
                      color: exportOptions.format === format ? '#FFFFFF' : '#969FFF',
                      marginTop: 4,
                      fontWeight: '600',
                    }}>
                      {format.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 时间范围选择 */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: '#FFFFFF', marginBottom: 12 }}>
                时间范围
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                  onPress={handleStartDateChange}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', marginBottom: 4 }}>
                    开始日期
                  </Text>
                  <Text style={{ fontSize: 14, color: '#FFFFFF' }}>
                    {formatDate(exportOptions.startDate)}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                  onPress={handleEndDateChange}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', marginBottom: 4 }}>
                    结束日期
                  </Text>
                  <Text style={{ fontSize: 14, color: '#FFFFFF' }}>
                    {formatDate(exportOptions.endDate)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 导出选项 */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, color: '#FFFFFF', marginBottom: 12 }}>
                导出选项
              </Text>
              <View style={{ gap: 8 }}>
                {[
                  { key: 'includeMemories' as const, label: '包含记忆详情', icon: 'brain' },
                  { key: 'includeTimeline' as const, label: '包含症状时间线', icon: 'timeline' },
                  { key: 'includeSymptoms' as const, label: '包含症状描述', icon: 'stethoscope' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    }}
                    onPress={() => handleToggleOption(option.key)}
                    activeOpacity={0.7}
                  >
                    <View style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      backgroundColor: exportOptions[option.key] ? '#969FFF' : 'rgba(255, 255, 255, 0.1)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                      {exportOptions[option.key] && (
                        <FontAwesome6 name="check" size={12} color="#FFFFFF" />
                      )}
                    </View>
                    <FontAwesome6 name={option.icon} size={14} color="#969FFF" style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 14, color: '#FFFFFF', flex: 1 }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 按钮区域 */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 8,
                  alignItems: 'center',
                }}
                onPress={handleReset}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14, color: '#969FFF', fontWeight: '600' }}>
                  重置
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{
                  flex: 2,
                  paddingVertical: 12,
                  backgroundColor: '#969FFF',
                  borderRadius: 8,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
                onPress={handleExport}
                activeOpacity={0.7}
                disabled={isExporting}
              >
                {isExporting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <FontAwesome6 name="file-export" size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }}>
                      开始导出
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* 使用说明 */}
            <View style={{
              padding: 12,
              backgroundColor: 'rgba(150, 159, 255, 0.05)',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: 'rgba(150, 159, 255, 0.2)',
            }}>
              <Text style={{ fontSize: 12, color: '#969FFF', fontWeight: '600', marginBottom: 4 }}>
                使用说明
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
                • PDF格式适合打印和分享
                {'\n'}• JSON格式适合数据分析和导入其他系统
                {'\n'}• 文本格式适合快速查看和编辑
                {'\n'}• 导出过程可能需要几分钟，请耐心等待
              </Text>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default MedicalHistoryExportModal;