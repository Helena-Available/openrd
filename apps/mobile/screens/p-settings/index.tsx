

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from './styles';

// 导入API密钥配置模态框
import ApiKeyConfigModal from '../p-qna/components/ApiKeyConfigModal';

const SettingsScreen = () => {
  const router = useRouter();
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [isMemoryEnabled, setIsMemoryEnabled] = useState(true);

  const handlePrivacySettingsPress = () => {
    router.push('/p-privacy_settings');
  };

  const handlePersonalizationSettingsPress = () => {
    Alert.alert('提示', '个性化设置功能即将上线，敬请期待！');
  };

  const handleAboutUsPress = () => {
    router.push('/p-about_us');
  };

  const handleLogoutPress = () => {
    setIsLogoutModalVisible(true);
  };

  const handleCancelLogout = () => {
    setIsLogoutModalVisible(false);
  };

  const handleConfirmLogout = async () => {
    try {
      // 清除本地存储的用户信息
      await AsyncStorage.removeItem('@userToken');
      await AsyncStorage.removeItem('@userInfo');
      
      setIsLogoutModalVisible(false);
      
      // 跳转到登录页面，使用replace避免返回
      router.replace('/p-login_register');
    } catch (error) {
      console.error('退出登录失败:', error);
      Alert.alert('错误', '退出登录失败，请重试');
    }
  };

  const handleEditProfilePress = () => {
    Alert.alert('提示', '个人资料编辑功能即将上线，敬请期待！');
  };

  const handleModalOverlayPress = () => {
    setIsLogoutModalVisible(false);
  };

  // 新功能处理函数
  const handleApiKeyConfigPress = () => {
    setShowApiKeyModal(true);
  };

  const handleApiKeySave = (savedApiKey: string) => {
    setApiKey(savedApiKey);
    Alert.alert('保存成功', 'API密钥已保存，时间服务功能已启用');
  };

  const handleMemoryToggle = async () => {
    try {
      const newEnabled = !isMemoryEnabled;
      await AsyncStorage.setItem('@memory_enabled', newEnabled.toString());
      setIsMemoryEnabled(newEnabled);
      Alert.alert('提示', `记忆功能已${newEnabled ? '启用' : '禁用'}`);
    } catch (error) {
      console.error('切换记忆状态失败:', error);
      Alert.alert('错误', '切换记忆状态失败，请重试');
    }
  };

  const handleExportHistoryPress = () => {
    Alert.alert('导出历史', '导出历史查看功能即将上线');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 顶部标题区域 */}
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text style={styles.pageTitle}>设置</Text>
            <Text style={styles.pageSubtitle}>管理您的应用偏好和账户设置</Text>
          </View>
        </View>

        {/* 用户信息卡片 */}
        <View style={styles.userInfoSection}>
          <View style={styles.userInfoCard}>
            <View style={styles.userProfileInfo}>
              <Image
                source={{ uri: 'https://s.coze.cn/image/Pqg4BKyFb3M/' }}
                style={styles.userAvatar}
              />
              <View style={styles.userDetails}>
                <Text style={styles.userName}>张先生</Text>
                <Text style={styles.userId}>ID: FSHD2024001</Text>
                <Text style={styles.userJoinDate}>加入时间：2024年1月15日</Text>
              </View>
              <TouchableOpacity 
                style={styles.editProfileButton}
                onPress={handleEditProfilePress}
                activeOpacity={0.7}
              >
                <FontAwesome6 name="pen" size={14} color="#969FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 设置选项列表 */}
        <View style={styles.settingsListSection}>
          <View style={styles.settingsList}>
            {/* 隐私设置 */}
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handlePrivacySettingsPress}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemContent}>
                <View style={styles.settingItemLeft}>
                  <View style={[styles.settingIconContainer, styles.blueIconContainer]}>
                    <FontAwesome6 name="shield-halved" size={18} color="#60A5FA" />
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>隐私设置</Text>
                    <Text style={styles.settingSubtitle}>管理数据授权和隐私偏好</Text>
                  </View>
                </View>
                <FontAwesome6 name="chevron-right" size={14} color="rgba(255, 255, 255, 0.5)" />
              </View>
            </TouchableOpacity>

            {/* 个性化设置 */}
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={handlePersonalizationSettingsPress}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemContent}>
                <View style={styles.settingItemLeft}>
                  <View style={[styles.settingIconContainer, styles.greenIconContainer]}>
                    <FontAwesome6 name="palette" size={18} color="#4ADE80" />
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>个性化设置</Text>
                    <Text style={styles.settingSubtitle}>大字体、语音读屏、高对比度</Text>
                  </View>
                </View>
                <FontAwesome6 name="chevron-right" size={14} color="rgba(255, 255, 255, 0.5)" />
              </View>
            </TouchableOpacity>

            {/* 关于我们 */}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleAboutUsPress}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemContent}>
                <View style={styles.settingItemLeft}>
                  <View style={[styles.settingIconContainer, styles.purpleIconContainer]}>
                    <FontAwesome6 name="circle-info" size={18} color="#A78BFA" />
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>关于我们</Text>
                    <Text style={styles.settingSubtitle}>产品介绍、版本信息、联系方式</Text>
                  </View>
                </View>
                <FontAwesome6 name="chevron-right" size={14} color="rgba(255, 255, 255, 0.5)" />
              </View>
            </TouchableOpacity>

            {/* API密钥配置 */}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleApiKeyConfigPress}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemContent}>
                <View style={styles.settingItemLeft}>
                  <View style={[styles.settingIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                    <FontAwesome6 name="key" size={18} color="#F59E0B" />
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>API密钥配置</Text>
                    <Text style={styles.settingSubtitle}>智谱API密钥，用于时间服务</Text>
                  </View>
                </View>
                <FontAwesome6 name="chevron-right" size={14} color="rgba(255, 255, 255, 0.5)" />
              </View>
            </TouchableOpacity>

            {/* 记忆功能开关 */}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleMemoryToggle}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemContent}>
                <View style={styles.settingItemLeft}>
                  <View style={[styles.settingIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                    <FontAwesome6 name="brain" size={18} color="#10B981" />
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>记忆功能</Text>
                    <Text style={styles.settingSubtitle}>{isMemoryEnabled ? '已启用' : '已禁用'}</Text>
                  </View>
                </View>
                <View style={{
                  width: 40,
                  height: 20,
                  backgroundColor: isMemoryEnabled ? '#10B981' : 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 10,
                  alignItems: isMemoryEnabled ? 'flex-end' : 'flex-start',
                  justifyContent: 'center',
                  paddingHorizontal: 2,
                }}>
                  <View style={{
                    width: 16,
                    height: 16,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 8,
                  }} />
                </View>
              </View>
            </TouchableOpacity>

            {/* 导出历史 */}
            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleExportHistoryPress}
              activeOpacity={0.7}
            >
              <View style={styles.settingItemContent}>
                <View style={styles.settingItemLeft}>
                  <View style={[styles.settingIconContainer, { backgroundColor: 'rgba(150, 159, 255, 0.2)' }]}>
                    <FontAwesome6 name="file-export" size={18} color="#969FFF" />
                  </View>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>导出历史</Text>
                    <Text style={styles.settingSubtitle}>查看之前的病史报告导出记录</Text>
                  </View>
                </View>
                <FontAwesome6 name="chevron-right" size={14} color="rgba(255, 255, 255, 0.5)" />
              </View>
            </TouchableOpacity>

            {/* 退出登录 */}
            <TouchableOpacity 
              style={styles.logoutItem}
              onPress={handleLogoutPress}
              activeOpacity={0.7}
            >
              <View style={styles.logoutItemContent}>
                <FontAwesome6 name="right-from-bracket" size={18} color="#EF4444" />
                <Text style={styles.logoutText}>退出登录</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 版本信息 */}
        <View style={styles.versionInfoSection}>
          <View style={styles.versionInfo}>
            <Text style={styles.versionText}>FSHD-openrd v1.0.0</Text>
            <Text style={styles.copyrightText}>© 2024 FSHD-openrd. 保留所有权利</Text>
          </View>
        </View>
      </ScrollView>

      {/* 退出登录确认弹窗 */}
      <Modal
        visible={isLogoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelLogout}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleModalOverlayPress}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity 
              style={styles.modalContent}
              activeOpacity={1}
              onPress={() => {}} // 阻止事件冒泡
            >
              <View style={styles.modalIconContainer}>
                <FontAwesome6 name="right-from-bracket" size={24} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>确认退出登录</Text>
              <Text style={styles.modalMessage}>您确定要退出当前账户吗？</Text>
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={handleCancelLogout}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.confirmButton}
                  onPress={handleConfirmLogout}
                  activeOpacity={0.7}
                >
                  <Text style={styles.confirmButtonText}>退出登录</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* API密钥配置模态框 */}
      <ApiKeyConfigModal
        visible={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSave={handleApiKeySave}
      />
    </SafeAreaView>
  );
};

export default SettingsScreen;

