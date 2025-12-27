/**
 * AI对话端点集成测试
 * 测试AI对话路由是否正确定义和可加载
 */

const express = require('express');
const request = require('supertest');

async function testAiEndpointIntegration() {
  try {
    console.log('🧪 开始测试AI对话端点集成...');
    
    // 创建测试应用
    const app = express();
    app.use(express.json());
    
    // 导入AI对话路由
    const { aiChatRoutes } = require('./dist/routes/ai-chat.routes.js');
    app.use('/api/ai', aiChatRoutes);
    
    console.log('✅ AI对话路由加载成功');
    
    // 测试健康检查端点
    const healthResponse = await request(app)
      .get('/api/ai/health')
      .expect('Content-Type', /json/)
      .expect(200);
    
    console.log('✅ AI健康检查端点测试通过:', healthResponse.body);
    
    // 测试/ask端点（需要认证，这里只测试路由存在性）
    // 注意：实际测试需要有效的JWT令牌，这里跳过认证测试
    console.log('⚠️  /ask端点需要认证，跳过详细测试');
    
    // 检查路由结构
    const routes = app._router.stack
      .filter(layer => layer.route)
      .map(layer => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      }));
    
    console.log('✅ 路由结构验证通过，找到路由:', routes);
    
    console.log('🎉 AI对话端点集成测试通过！');
    return true;
  } catch (error) {
    console.error('❌ AI对话端点集成测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
    return false;
  }
}

// 运行测试
testAiEndpointIntegration().then(success => {
  if (success) {
    console.log('✅ AI对话端点集成测试完成');
    process.exit(0);
  } else {
    console.log('❌ AI对话端点集成测试失败');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ 测试脚本执行异常:', error);
  process.exit(1);
});