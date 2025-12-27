/**
 * MCP服务功能测试脚本
 * 使用CommonJS模块进行测试
 */

const { getMcpClient } = require('./dist/services/mcp-client.service.js');
const { getTimeService } = require('./dist/services/time-service.js');
const { getMemoryManager } = require('./dist/services/memory-manager.service.js');

async function testMcpServices() {
  try {
    console.log('🧪 开始测试MCP服务功能...');
    
    // 测试1: MCP客户端实例化
    const mcpClient = getMcpClient();
    console.log('✅ MCP客户端实例化成功');
    
    // 测试2: 时间服务实例化
    const timeService = getTimeService();
    console.log('✅ 时间服务实例化成功');
    
    // 测试3: 记忆管理器实例化
    const memoryManager = getMemoryManager();
    console.log('✅ 记忆管理器实例化成功');
    
    // 测试4: 获取MCP配置
    const config = timeService.getConfig();
    console.log('✅ MCP配置获取成功:', {
      enabled: config.enabled,
      timeEndpoint: config.services.time.endpoint,
      memoryEndpoint: config.services.memory.endpoint
    });
    
    // 测试5: 测试降级时间获取
    const fallbackTime = await timeService.getCurrentTime('test-user');
    console.log('✅ 降级时间获取成功:', {
      current_time: fallbackTime.current_time,
      timezone: fallbackTime.timezone
    });
    
    // 测试6: 测试记忆检索（降级模式）
    const memories = await memoryManager.retrieveMemories({
      userId: 'test-user-id',
      limit: 5
    });
    console.log('✅ 记忆检索成功（降级模式）:', {
      memoryCount: memories.memories.length
    });
    
    console.log('🎉 所有MCP服务功能测试通过！');
    return true;
  } catch (error) {
    console.error('❌ MCP服务测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
    return false;
  }
}

// 运行测试
testMcpServices().then(success => {
  if (success) {
    console.log('✅ MCP服务功能测试完成');
    process.exit(0);
  } else {
    console.log('❌ MCP服务功能测试失败');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ 测试脚本执行异常:', error);
  process.exit(1);
});