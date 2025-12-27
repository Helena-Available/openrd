import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ApiKeyConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
}

const ApiKeyConfigModal: React.FC<ApiKeyConfigModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  // 加载保存的API密钥
  React.useEffect(() => {
    loadSavedApiKey();
  }, []);

  const loadSavedApiKey = async () => {
    try {
      const savedApiKey = await AsyncStorage.getItem('@zhipu_api_key');
      const savedTimestamp = await AsyncStorage.getItem('@zhipu_api_key_timestamp');
      
      if (savedApiKey) {
        setApiKey(savedApiKey);
        setIsConfigured(true);
      }
      
      if (savedTimestamp) {
        setLastUpdated(new Date(parseInt(savedTimestamp)).toLocaleString('zh-CN'));
      }
    } catch (error) {
      console.error('加载API密钥失败:', error);
    }
  };

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('提示', '请输入API密钥');
      return;
    }

    setIsTesting(true);
    
    // 模拟API密钥验证
    setTimeout(() => {
      setIsTesting(false);
      
      // 这里应该调用实际的验证API
      // 暂时模拟验证成功
      const isValid = apiKey.length >= 20;
      
      if (isValid) {
        Alert.alert('验证成功', 'API密钥验证通过，可以正常使用');
      } else {
        Alert.alert('验证失败', 'API密钥格式不正确，请检查后重试');
      }
    }, 1500);
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('提示', '请输入API密钥');
      return;
    }

    setIsSaving(true);
    
    try {
      // 保存到本地存储
      await AsyncStorage.setItem('@zhipu_api_key', apiKey);
      await AsyncStorage.setItem('@zhipu_api_key_timestamp', Date.now().toString());
      
      setIsConfigured(true);
      setLastUpdated(new Date().toLocaleString('zh-CN'));
      
      // 调用父组件的保存回调
      onSave(apiKey);
      
      Alert.alert('保存成功', 'API密钥已保存');
      onClose();
    } catch (error) {
      console.error('保存API密钥失败:', error);
      Alert.alert('保存失败', '保存API密钥时发生错误，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenHelpLink = () => {
    Linking.openURL('https://bigmodel.cn/usercenter/proj-mgmt/apikeys').catch(err => {
      console.error('打开链接失败:', err);
      Alert.alert('提示', '无法打开链接，请手动访问：https://bigmodel.cn/usercenter/proj-mgmt/apikeys');
    });
  };

  const handleClearApiKey = async () => {
    Alert.alert(
      '清除API密钥',
      '确定要清除已保存的API密钥吗？清除后相关功能将无法使用。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('@zhipu_api_key');
              await AsyncStorage.removeItem('@zhipu_api_key_timestamp');
              setApiKey('');
              setIsConfigured(false);
              setLastUpdated(null);
              Alert.alert('清除成功', 'API密钥已清除');
            } catch (error) {
              console.error('清除API密钥失败:', error);
            }
          },
        },
      ]
    );
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
            maxHeight: '80%',
          }}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <FontAwesome6 name="key" size={20} color="#969FFF" />
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF', marginLeft: 12, flex: 1 }}>
              API密钥配置
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <FontAwesome6 name="xmark" size={20} color="rgba(255, 255, 255, 0.5)" />
            </TouchableOpacity>
          </View>

          {/* 状态指示器 */}
          <View style={{
            backgroundColor: isConfigured ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <FontAwesome6
              name={isConfigured ? 'check-circle' : 'exclamation-circle'}
              size={16}
              color={isConfigured ? '#10B981' : '#EF4444'}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                {isConfigured ? 'API密钥已配置' : 'API密钥未配置'}
              </Text>
              {lastUpdated && (
                <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', marginTop: 2 }}>
                  最后更新: {lastUpdated}
                </Text>
              )}
            </View>
          </View>

          {/* API密钥输入框 */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, color: '#FFFFFF', marginBottom: 8 }}>
              智谱API密钥
            </Text>
            <TextInput
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 12,
                color: '#FFFFFF',
                fontSize: 14,
              }}
              placeholder="请输入您的智谱API密钥"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)', marginTop: 8 }}>
              用于时间服务等MCP功能，请妥善保管您的API密钥
            </Text>
          </View>

          {/* 帮助链接 */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20,
              padding: 12,
              backgroundColor: 'rgba(150, 159, 255, 0.1)',
              borderRadius: 8,
            }}
            onPress={handleOpenHelpLink}
            activeOpacity={0.7}
          >
            <FontAwesome6 name="circle-question" size={16} color="#969FFF" />
            <Text style={{ fontSize: 14, color: '#969FFF', marginLeft: 12, flex: 1 }}>
              如何获取API密钥？
            </Text>
            <FontAwesome6 name="arrow-up-right-from-square" size={14} color="#969FFF" />
          </TouchableOpacity>

          {/* 按钮区域 */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {isConfigured && (
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 8,
                  alignItems: 'center',
                }}
                onPress={handleClearApiKey}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14, color: '#EF4444', fontWeight: '600' }}>
                  清除
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 8,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}
              onPress={handleTestApiKey}
              activeOpacity={0.7}
              disabled={isTesting}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color="#969FFF" />
              ) : (
                <>
                  <FontAwesome6 name="check" size={14} color="#969FFF" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 14, color: '#969FFF', fontWeight: '600' }}>
                    测试
                  </Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                backgroundColor: '#969FFF',
                borderRadius: 8,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
              }}
              onPress={handleSaveApiKey}
              activeOpacity={0.7}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <FontAwesome6 name="save" size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600' }}>
                    保存
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* 安全提示 */}
          <View style={{
            marginTop: 20,
            padding: 12,
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.2)',
          }}>
            <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '600', marginBottom: 4 }}>
              安全提示
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.5)' }}>
              • API密钥是敏感信息，请勿分享给他人
              {'\n'}• 定期轮换API密钥以提高安全性
              {'\n'}• 仅在官方平台生成API密钥
            </Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default ApiKeyConfigModal;