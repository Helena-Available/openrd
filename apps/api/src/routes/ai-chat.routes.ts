import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import { getTimeService } from '../services/time-service.js';
import { getMemoryManager } from '../services/memory-manager.service.js';
import { getMcpConfig } from '../config/mcp.config.js';

const router = Router();

// ============ Helpers ============

// 去 BOM + trim，避免 JSON.parse 爆炸
const cleanJsonText = (s: string) => s.replace(/^\uFEFF/, '').trim();

// 找 pythonScript 的真实路径（更稳）
const resolvePythonScriptPath = () => {
  const p1 = path.resolve(process.cwd(), 'knowledge', 'knowledge.py');
  const p2 = path.resolve(process.cwd(), 'apps', 'api', 'knowledge', 'knowledge.py');

  if (fs.existsSync(p1)) return p1;
  if (fs.existsSync(p2)) return p2;
  return p1; // 兜底
};

// 轻量 UUID 判断（避免 dev-user 这种炸 DB）
const isUuid = (s: unknown) =>
  typeof s === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

// DeepSeek(OpenAI兼容) client
const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY || '',
  baseURL: process.env.AI_API_BASE_URL || 'https://api.siliconflow.cn/v1',
});

if (!process.env.AI_API_KEY) {
  process.stdout.write('⚠️ Missing AI_API_KEY in env. DeepSeek call will fail.\n');
}

// ============ Main Route ============

router.post(
  '/ask',
  (req, _res, next) => {
    process.stdout.write('\n🔥 HIT POST /api/ai/ask (pre-auth)\n');
    next();
  },
  authenticate,
  async (req, res) => {
    try {
      process.stdout.write('✅ auth passed\n');

      const { question, userContext } = req.body || {};
      if (!question || !String(question).trim()) {
        return res.status(400).json({ success: false, message: '问题不能为空' });
      }

      const userId = (req as any).user?.id;
      process.stdout.write(`👤 userId = ${String(userId)} (uuid=${isUuid(userId)})\n`);
      process.stdout.write(`❓ question = ${String(question)}\n`);
      process.stdout.write(`🔧 cwd = ${process.cwd()}\n`);

      const pythonScript = resolvePythonScriptPath();
      process.stdout.write(`📄 pythonScript = ${pythonScript}\n`);
      process.stdout.write(`📄 pythonScript exists = ${fs.existsSync(pythonScript)}\n`);

      const PYTHON_EXE =
        'C:\\Users\\lucas\\Desktop\\fshd-kb-env\\.venv\\Scripts\\python.exe';
      process.stdout.write(`🐍 pythonExe = ${PYTHON_EXE}\n`);
      process.stdout.write(`🐍 pythonExe exists = ${fs.existsSync(PYTHON_EXE)}\n`);

      /**
       * 1) 调 python：只负责检索
       *    ✅ resolve 出：parsed + rawChunks + chunksText + filteredChunks + ragContext
       */
      const kb = await new Promise<{
        parsed: any;
        rawChunks: any[];
        chunksText: string[];
        filteredChunks: string[];
        ragContext: string;
      }>((resolve, reject) => {
        execFile(PYTHON_EXE, [pythonScript, String(question)], (error, stdout, stderr) => {
          process.stdout.write(`🧾 stderr(first500) = ${(stderr || '').slice(0, 500)}\n`);
          process.stdout.write(`🧾 stdout(first500) = ${(stdout || '').slice(0, 500)}\n`);

          if (error) return reject({ error, stdout, stderr });

          try {
            const cleaned = cleanJsonText(stdout || '');
            const parsed = JSON.parse(cleaned);

            // ✅ 这里必须用 parsed（不能用 pythonResult）
            const rawChunks = Array.isArray(parsed?.chunks) ? parsed.chunks : [];

            // ✅ 兼容两种：string[] 或 {content, metadata}[]
            const chunksText = rawChunks
              .map((c: any) => (typeof c === 'string' ? c : c?.content))
              .filter(Boolean) as string[];

            // ✅ 过滤明显是目录/导航
            const isJunk = (t: string) =>
              /目录|上一篇|下一篇|连载|排版|撰文|责任编辑|点击阅读|更多内容/.test(t);

            const filteredChunks = chunksText.filter((t) => !isJunk(t));

            // ✅ 打印确认：DeepSeek 看得到什么
            process.stdout.write(
              `🧠 chunksText=${chunksText.length}, filtered=${filteredChunks.length}\n`,
            );
            process.stdout.write(
              `🧠 chunk0=${(filteredChunks[0] || chunksText[0] || '').slice(0, 120)}\n`,
            );

            // ✅ 真正喂给 DeepSeek 的上下文
            const ragContext = (filteredChunks.length ? filteredChunks : chunksText)
              .slice(0, 5)
              .map((t, i) => `【片段${i + 1}】${t}`)
              .join('\n\n');

            return resolve({ parsed, rawChunks, chunksText, filteredChunks, ragContext });
          } catch (e) {
            return reject({ error: e, stdout, stderr });
          }
        });
      });

      process.stdout.write(`📦 python chunks(raw) = ${kb.rawChunks.length}\n`);

      /**
       * 2) 调 DeepSeek：用 ragContext（过滤后的chunks）生成回答
       */
      const contextText =
        kb.ragContext && kb.ragContext.trim().length > 0
          ? kb.ragContext
          : '（检索未命中任何相关片段）';

      // ============ MCP集成：获取记忆和时间 ============
      const mcpConfig = getMcpConfig();
      let memories: any[] = [];
      let currentTime = '';
      
      if (mcpConfig.enabled && userId && isUuid(userId)) {
        try {
          // 获取记忆
          const memoryManager = getMemoryManager();
          const memoryResult = await memoryManager.retrieveMemories({
            userId,
            limit: 5,
            types: ['symptom', 'conversation'],
          });
          memories = memoryResult.memories;
          
          // 获取当前时间
          const timeService = getTimeService();
          const timeResponse = await timeService.getCurrentTime(userId);
          currentTime = timeResponse.formatted || timeResponse.current_time;
        } catch (mcpError) {
          console.warn('MCP服务调用失败，继续使用基础提示词:', mcpError);
        }
      }
      
      // 构建增强的系统提示词
      const systemPrompt = `你是一个专业、友善的FSHD（面肩肱型肌营养不良症）健康科普助手。请严格遵循：
1) 优先依据"知识库资料片段"作答；不要编造不在片段中的事实
2) 用中文、分点、通俗易懂
3) 给出可执行的下一步建议（该看什么科/问医生什么/做什么检查）
4) 每次都要提醒：这不是医疗诊断，需咨询专业医生
5) 若片段不足以支持结论，明确说"知识库中未找到依据"

【记忆使用指导】
- 请参考【历史记忆摘要】中的信息，了解用户之前的症状和健康状况
- 如果用户提到新的症状或健康变化，请在回答中确认并建议记录
- 结合历史记忆提供个性化的建议，识别症状模式和时间趋势

【时间感知指导】
- 当前时间是【${currentTime || '未知'}】，请在处理时间相关问题时参考此时间
- 如果用户提到时间相关症状（如"最近一周"、"昨天开始"），请结合当前时间进行计算和理解
- 帮助用户建立清晰的时间线认知，将症状与具体时间段关联

【病史梳理指导】
- 请自动识别用户提到的症状及其时间关系，帮助梳理症状时间线
- 如果用户描述了多个症状和时间点，请在回答中简要总结时间线
- 将新症状与历史症状进行对比分析，识别变化趋势

【记忆更新指导】
- 从对话中识别关键医疗信息（症状、时间、患者陈述）
- 在回答中建议记录重要的新信息，以便未来提供更精准的帮助
- 避免重复询问用户已经提供过的信息`;

      // 构建增强的用户提示词
      const memoryContext = memories.length > 0
        ? memories.map((mem, idx) => `记忆${idx + 1}: ${mem.summary || mem.content?.summary || '无摘要'}`).join('\n')
        : '暂无相关历史记忆';
      
      const userPrompt = `【用户信息】${JSON.stringify(userContext || {})}

【当前时间】${currentTime || '未知'}

【历史记忆摘要】
${memoryContext}

【知识库资料片段】
${contextText}

【用户问题】
${String(question)}

【病史梳理要求】
请根据以上信息：
1. 识别用户提到的症状及其时间关系
2. 如有新的症状信息，请简要总结并建议记录
3. 在回答中体现对历史记忆和时间上下文的理解

请结合用户的历史记忆和时间上下文，提供个性化的回答。
- 直接回答（条理清晰）
- 如果资料不足：说明不足点 + 下一步建议
- 非医疗诊断`;

      let finalAnswer = '';
      try {
        process.stdout.write('🤖 calling DeepSeek...\n');
        const completion = await openai.chat.completions.create({
          model: process.env.AI_API_MODEL || 'deepseek-ai/DeepSeek-V3',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1200,
        });
        process.stdout.write('🤖 DeepSeek done.\n');

        finalAnswer =
          completion.choices?.[0]?.message?.content?.trim() ||
          '抱歉，我暂时无法生成回答。';
      } catch (e: any) {
        console.error('❌ DeepSeek call failed:', e?.message || e);
        finalAnswer =
          kb.parsed?.answer ||
          '抱歉，AI 服务暂时不可用，请稍后重试。';
      }

      // ============ MCP集成：存储对话记忆 ============
      if (mcpConfig.enabled && userId && isUuid(userId) && finalAnswer) {
        try {
          const memoryManager = getMemoryManager();
          // 构建记忆内容
          const memoryContent = {
            originalText: `${question}\n\n${finalAnswer}`,
            concerns: [],
            summary: `用户咨询: ${question.substring(0, 100)}...`,
          };
          
          await memoryManager.storeMemory({
            userId,
            type: 'conversation',
            content: memoryContent,
            conversationId: undefined, // 实际项目中可以使用会话ID
            source: 'ai-extracted',
          });
          
          console.log('对话记忆存储成功');
        } catch (storeError) {
          console.warn('存储对话记忆失败:', storeError);
        }
      }

      // 构建引用链接信息
      const references = kb.rawChunks.map((chunk: any, index: number) => {
        const metadata = chunk.metadata || {};
        return {
          id: index,
          sourceFile: metadata.source_file || metadata.sourceFile || '未知文档',
          chunkIndex: metadata.chunk_index || metadata.chunkIndex || 0,
          preview: chunk.content ? chunk.content.substring(0, 100) + '...' : '',
          url: `/api/knowledge/chunk/${index}`, // 暂时占位
        };
      });

      return res.json({
        success: true,
        data: {
          question: String(question),
          answer: finalAnswer,
          // ✅ 给前端：保留原始 chunks（可能是对象数组）
          knowledgeChunks: kb.rawChunks,
          // ✅ 引用链接信息
          references,
          // ✅ 额外给你调试：DeepSeek 实际吃到的上下文
          ragContextPreview: contextText.slice(0, 1200),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error('❌ /api/ai/ask error:', err?.error || err);
      return res.status(500).json({
        success: false,
        message: 'AI服务暂时不可用',
        detail: err?.error?.message || String(err?.error || err),
      });
    }
  },
);

router.get('/health', (_req, res) => {
  res.json({ service: 'AI Chat', status: 'active', timestamp: new Date().toISOString() });
});

export { router as aiChatRoutes };
