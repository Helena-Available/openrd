import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MemoryStatusIndicatorProps {
  onPress?: () => void;
  compact?: boolean;
}

interface MemoryStats {
  enabled: boolean;
  totalMemories: number;
  recentMemories: number;
  lastUpdated: string | null;
}

const MemoryStatusIndicator: React.FC<MemoryStatusIndicatorProps> = ({
  onPress,
  compact = false,
}) => {
  const [memoryStats, setMemoryStats] = React.useState<MemoryStats>({
    enabled: false,
    totalMemories: 0,
    recentMemories: 0,
    lastUpdated: null,
  });
  const [isLoading, setIsLoading] = React.useState(true);

  // 加载记忆状态
  React.useEffect(() => {
    loadMemoryStats();
  }, []);

  const loadMemoryStats = async () => {
    try {
      setIsLoading(true);
      
      // 从本地存储加载记忆状态
      const memoryEnabled = await AsyncStorage.getItem('@memory_enabled');
      const memoriesCount = await AsyncStorage.getItem('@memories_count');
      const lastUpdated = await AsyncStorage.getItem('@memories_last_updated');
      
      // 模拟数据 - 实际应该从API获取
      setTimeout(() => {
        setMemoryStats({
          enabled: memoryEnabled === 'true',
          totalMemories: memoriesCount ? parseInt(memoriesCount) : 3,
          recentMemories: 1,
          lastUpdated: lastUpdated || new Date().toISOString(),
        });
        setIsLoading(false);
      }, 500);
      
    } catch (error) {
      console.error('加载记忆状态失败:', error);
      setIsLoading(false);
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // 默认行为：显示记忆详情
      showMemoryDetails();
    }
  };

  const showMemoryDetails = () => {
    Alert.alert(
      '记忆功能状态',
      `记忆功能：${memoryStats.enabled ? '已启用' : '已禁用'}\n` +
      `记忆总数：${memoryStats.totalMemories} 条\n` +
      `最近新增：${memoryStats.recentMemories} 条\n` +
      (memoryStats.lastUpdated ? `最后更新：${new Date(memoryStats.lastUpdated).toLocaleString('zh-CN')}` : ''),
      [
        { text: '关闭', style: 'cancel' },
        { text: '管理记忆', onPress: () => Alert.alert('提示', '记忆管理功能即将上线') },
        { text: memoryStats.enabled ? '禁用记忆' : '启用记忆', onPress: toggleMemoryStatus },
      ]
    );
  };

  const toggleMemoryStatus = async () => {
    try {
      const newEnabled = !memoryStats.enabled;
      await AsyncStorage.setItem('@memory_enabled', newEnabled.toString());
      
      setMemoryStats(prev => ({
        ...prev,
        enabled: newEnabled,
      }));
      
      Alert.alert('提示', `记忆功能已${newEnabled ? '启用' : '禁用'}`);
    } catch (error) {
      console.error('切换记忆状态失败:', error);
      Alert.alert('错误', '切换记忆状态失败，请重试');
    }
  };

  const formatLastUpdated = () => {
    if (!memoryStats.lastUpdated) return '从未更新';
    
    const date = new Date(memoryStats.lastUpdated);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffMins < 24 * 60) return `${Math.floor(diffMins / 60)}小时前`;
    return `${Math.floor(diffMins / (24 * 60))}天前`;
  };

  if (isLoading) {
    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: compact ? 8 : 12,
          paddingVertical: compact ? 4 : 8,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <FontAwesome6 name="spinner" size={compact ? 12 : 14} color="#969FFF" />
        {!compact && (
          <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', marginLeft: 8 }}>
            加载中...
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  if (compact) {
    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 4,
          backgroundColor: memoryStats.enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: memoryStats.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
        }}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <FontAwesome6
          name={memoryStats.enabled ? 'brain' : 'brain'}
          size={12}
          color={memoryStats.enabled ? '#10B981' : 'rgba(255, 255, 255, 0.5)'}
        />
        {memoryStats.totalMemories > 0 && (
          <View style={{
            position: 'absolute',
            top: -4,
            right: -4,
            backgroundColor: '#EF4444',
            borderRadius: 6,
            minWidth: 12,
            height: 12,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 2,
          }}>
            <Text style={{ fontSize: 8, color: '#FFFFFF', fontWeight: '600' }}>
              {memoryStats.totalMemories}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: memoryStats.enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: memoryStats.enabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
      }}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <FontAwesome6
          name={memoryStats.enabled ? 'brain' : 'brain'}
          size={14}
          color={memoryStats.enabled ? '#10B981' : 'rgba(255, 255, 255, 0.5)'}
          style={{ marginRight: 8 }}
        />
        
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
            {memoryStats.enabled ? '记忆已启用' : '记忆已禁用'}
          </Text>
          <Text style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.5)', marginTop: 2 }}>
            {memoryStats.totalMemories}条记忆 • {formatLastUpdated()}
          </Text>
        </View>
      </View>
      
      {memoryStats.totalMemories > 0 && (
        <View style={{
          backgroundColor: memoryStats.enabled ? '#10B981' : 'rgba(255, 255, 255, 0.1)',
          borderRadius: 10,
          minWidth: 20,
          height: 20,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 8,
        }}>
          <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: '600' }}>
            {memoryStats.totalMemories}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default MemoryStatusIndicator;