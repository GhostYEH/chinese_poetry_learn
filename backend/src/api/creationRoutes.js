const express = require('express');
const router = express.Router();
const { db } = require('../utils/db');
const aiService = require('../services/aiService');
const config = require('../config/config');

// AI调用限流Map，基于用户ID
const aiRateLimitMap = new Map();

/** 从 score_data JSON 中解析总分（与前端 CreationRecords.getTotalScore 一致） */
function parseCreationScoreData(score_data) {
  if (score_data == null || score_data === '') return null;
  try {
    const d = typeof score_data === 'string' ? JSON.parse(score_data) : score_data;
    const raw = d.score ?? d.total;
    if (raw === undefined || raw === null) return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  } catch (e) {
    return null;
  }
}

/** 达标分数线：与仪表盘「达标作品」统计一致 */
const CREATION_QUALIFIED_MIN_SCORE = 60;

// 每小时清理一次过期的限流记录
setInterval(() => {
  const now = Date.now();
  for (const [userId, records] of aiRateLimitMap.entries()) {
    // 过滤掉超过1分钟的记录
    const filteredRecords = records.filter(record => now - record < 60000);
    if (filteredRecords.length === 0) {
      aiRateLimitMap.delete(userId);
    } else {
      aiRateLimitMap.set(userId, filteredRecords);
    }
  }
  console.log('[creationRoutes] 清理过期限流记录完成');
}, 3600000);

/**
 * 检查AI调用限流
 * @param {object} req - 请求对象
 * @returns {boolean} true表示允许通过，false表示超过限流
 */
function checkAIRateLimit(req) {
  const userId = req.user.userId;
  const now = Date.now();
  
  if (!aiRateLimitMap.has(userId)) {
    aiRateLimitMap.set(userId, []);
  }
  
  const records = aiRateLimitMap.get(userId);
  // 过滤掉超过1分钟的记录
  const filteredRecords = records.filter(record => now - record < 60000);
  aiRateLimitMap.set(userId, filteredRecords);
  
  // 每分钟最多调用5次AI接口
  if (filteredRecords.length >= 5) {
    return false;
  }
  
  // 添加当前调用记录
  filteredRecords.push(now);
  aiRateLimitMap.set(userId, filteredRecords);
  return true;
}

// 自定义认证中间件，允许无认证时使用默认用户
// 注意：无token/无效token时使用默认用户，仅用于演示/开发环境，生产环境建议禁用
function optionalAuthenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = config.jwt.secret || 'your-secret-key';
      
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
          // 令牌无效，使用默认用户
          req.user = { userId: config.auth.defaultUserId || 1, username: 'default' };
          next();
        } else {
          // 令牌有效，使用解码后的用户信息
          req.user = {
            userId: decoded.userId,
            username: decoded.username
          };
          next();
        }
      });
    } else {
      // 无令牌，使用默认用户
      req.user = { userId: config.auth.defaultUserId || 1, username: 'default' };
      next();
    }
  } catch (error) {
    console.error('认证失败:', error);
    // 认证失败，使用默认用户
    req.user = { userId: config.auth.defaultUserId || 1, username: 'default' };
    next();
  }
}

// 新手模式接口 - 生成带空缺的完整引导诗
router.post('/novice/generate', optionalAuthenticateToken, async (req, res) => {
  try {
    // 数据隔离：仅允许当前用户操作自己的数据
    const userId = req.user.userId;
    const { theme, genre } = req.body;
    
    // 检查AI调用限流
    if (!checkAIRateLimit(req)) {
      console.error('[creationRoutes] 生成引导诗 失败', { userId, error: '请求过于频繁，请稍后重试' });
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后重试' });
    }
    
    console.log('[creationRoutes] 生成引导诗 信息', { userId, params: { theme, genre } });
    
    if (!theme || !genre) {
      console.error('[creationRoutes] 生成引导诗 失败', { userId, error: '缺少主题或体裁参数' });
      return res.status(400).json({ success: false, message: '缺少主题或体裁参数' });
    }
    
    // 用户输入转义，避免Prompt注入
    const escapedTheme = theme;
    const escapedGenre = genre;
    
    // 严格的新手引导诗 prompt（韵律引导 + 主题绑定）
    const prompt = `请为"${escapedTheme}"主题生成一首${escapedGenre}，在适当位置设置2-3个空缺供用户填词。

要求：
1. 格律严谨：必须符合${escapedGenre}的格律要求，字数准确，押韵工整
2. 主题鲜明：全诗意象必须紧扣"${escapedTheme}"这一主题，每句都直接或间接服务主题
3. 空缺设计合理：
   - 空缺仅在实词位置（名词、动词、形容词），虚词（助词、量词）不设空缺
   - 每个空缺字数明确（1-2字），字数要一致（通常差1字）
   - 空缺处填入的词必须与主题直接相关，填错则全诗意境割裂
   - 每个空缺用"___"表示，数量精确
4. 参考版本提供：完整的、无空缺的正确版本
5. 解释必须包含：
   - 整首诗如何层层推进、紧扣"${escapedTheme}"主题
   - 每个空缺的韵脚要求（标出平仄和韵部）
   - 每个空缺的情感方向指引（描述此处应表达什么情感）
   - 填词时如何通过词语选择保持主题连贯

严格返回JSON（不要任何额外文字）：
{"prompt_poem":"带空缺的诗词","reference_poem":"完整正确版本","explanation":"【主题】...（20-40字）\n【结构】...（20-40字）\n【空缺1】位置：第X句第X-X字，韵部：XX，平仄：X，情感方向：...（10-20字）\n【空缺2】位置：...（同理）\n【空缺3】位置：...（若有则写）"}`;

    const systemContent = `你是一位精通中国古典诗词格律的专家，尤其擅长唐代五言、七言绝句。你的格律知识极其扎实，平仄押韵要求一丝不苟。`;
    
    // 调用AI服务
    const result = await aiService.callAIGenerateJSON(prompt, systemContent);
    
    if (result) {
      console.log('[creationRoutes] 生成引导诗 成功', { userId, theme: escapedTheme, genre: escapedGenre });
      return res.json({ success: true, data: result, message: '生成成功' });
    } else {
      // AI调用失败，返回模拟数据
      const mockData = config.creation.defaultData.noviceGenerate(theme, genre);
      console.error('[creationRoutes] 生成引导诗 AI失败，返回模拟数据', { userId, theme: escapedTheme, genre: escapedGenre });
      return res.json({ success: false, data: mockData, message: 'AI服务暂时不可用，已返回参考示例' });
    }
  } catch (error) {
    console.error('[creationRoutes] 生成引导诗 失败', { userId: req.user.userId, params: req.body, error: error.stack || error.message });
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 新手模式接口 - 一次性校验用户填词结果
router.post('/novice/check', optionalAuthenticateToken, async (req, res) => {
  try {
    // 数据隔离：仅允许当前用户操作自己的数据
    const userId = req.user.userId;
    const { userPoem, referencePoem, title, author } = req.body;
    
    // 检查AI调用限流
    if (!checkAIRateLimit(req)) {
      console.error('[creationRoutes] 校验填词结果 失败', { userId, error: '请求过于频繁，请稍后重试' });
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后重试' });
    }
    
    console.log('[creationRoutes] 校验填词结果 信息', { userId, params: { title, author } });
    
    if (!userPoem || !referencePoem) {
      console.error('[creationRoutes] 校验填词结果 失败', { userId, error: '缺少用户填词或参考诗词' });
      return res.status(400).json({ success: false, message: '缺少用户填词或参考诗词' });
    }
    
    // 用户输入转义，避免Prompt注入
    const escapedUserPoem = JSON.stringify(userPoem).slice(1, -1);
    const escapedReferencePoem = JSON.stringify(referencePoem).slice(1, -1);
    const escapedTitle = title ? JSON.stringify(title).slice(1, -1) : '';
    const escapedAuthor = author ? JSON.stringify(author).slice(1, -1) : '';
    
    const prompt = `请对用户在引导诗空缺处的填词进行严格评审，并与参考版本对比评分。

【参考版本】
${escapedReferencePoem}

【用户版本】
${escapedUserPoem}

【填词任务描述】
标题：${escapedTitle}
作者：${escapedAuthor}

【评分维度及标准】

一、内容契合度（content）
- 85-100：填入词语与主题完全契合，意象精准，意境浑然一体
- 70-84：填入词语与主题较为契合，有一定意境
- 55-69：填入词语与主题有偏差，略显游离
- 40-54：填入词语与主题貌合神离，意象混乱
- 0-39：填入词语与主题严重不符

二、韵律美感（rhythm）
- 85-100：平仄完全正确，与前后句衔接自然，韵脚和谐
- 70-84：平仄基本正确，韵脚较和谐
- 55-69：平仄有误，韵脚生硬
- 40-54：平仄错误明显，节奏割裂
- 0-39：韵律全错

三、意境表达（mood）
- 85-100：填词处与全诗意境高度统一，能深化主题，令人回味
- 70-84：填词处与全诗意较为统一，能维持意境
- 55-69：填词处与全诗意有割裂感
- 40-54：填词处破坏全诗意境
- 0-39：填词处令全诗意境崩塌

【总分】三维度之和÷3，保留一位小数。

【修改建议】（必须包含以下内容，格式严格）
1. 亮点：用户填词中真正闪光的地方（不超过20字）
2. 问题：严厉指出核心问题，具体指出是哪个字/哪个词有什么问题（30-60字）
3. 建议：给出修改方向（不超过25字）

严格JSON格式：
{"score":总分数值,"analysis":{"content":分数,"rhythm":分数,"mood":分数},"suggestions":"【亮点】...（≤20字）\n【不足】...（30-60字）\n【建议】...（≤25字）"}`;

    const systemContent = `你是一位极其严格的古诗词评审专家。你以唐诗名篇为最高标准，审视每一个字的平仄、押韵、意象、情感。对空缺处填词的评判极其细致——一字之差，境界天壤之别。`;
    
    // 调用AI服务
    const result = await aiService.callAIGenerateJSON(prompt, systemContent, { temperature: 0.3 });
    
    if (result) {
      console.log('[creationRoutes] 校验填词结果 成功', { userId });
      return res.json({ success: true, data: result, message: '校验成功' });
    } else {
      // AI调用失败，返回模拟数据
      const mockData = config.creation.defaultData.noviceCheck;
      console.error('[creationRoutes] 校验填词结果 AI失败，返回模拟数据', { userId });
      return res.json({ success: false, data: mockData, message: 'AI服务暂时不可用，已返回参考示例' });
    }
  } catch (error) {
    console.error('[creationRoutes] 校验填词结果 失败', { userId: req.user.userId, params: req.body, error: error.stack || error.message });
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 创作辅助接口 - 生成AI参考诗词
router.post('/assist/generate-reference', optionalAuthenticateToken, async (req, res) => {
  try {
    // 数据隔离：仅允许当前用户操作自己的数据
    const userId = req.user.userId;
    const { theme, genre } = req.body;
    
    // 检查AI调用限流
    if (!checkAIRateLimit(req)) {
      console.error('[creationRoutes] 生成参考诗词 失败', { userId, error: '请求过于频繁，请稍后重试' });
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后重试' });
    }
    
    console.log('[creationRoutes] 生成参考诗词 信息', { userId, params: { theme, genre } });
    
    if (!theme || !genre) {
      console.error('[creationRoutes] 生成参考诗词 失败', { userId, error: '缺少主题或体裁参数' });
      return res.status(400).json({ success: false, message: '缺少主题或体裁参数' });
    }
    
    // 用户输入转义，避免Prompt注入
    const escapedTheme = JSON.stringify(theme).slice(1, -1);
    const escapedGenre = JSON.stringify(genre).slice(1, -1);
    
    // 构建AI提示词
    const prompt = `
      请生成一首${escapedGenre}，主题为"${escapedTheme}"，作为用户创作的参考。
      
      要求：
      1. 诗词结构完整，符合${escapedGenre}的格律要求
      2. 意境优美，与主题相关
      3. 语言流畅，易于理解
      4. 请严格按照以下JSON格式返回，不要添加任何其他文字，包括Markdown标记、引号外的解释、换行等
      - poem: 生成的参考诗词
      - analysis: 诗词解析
      
      示例JSON格式：
      {"poem": "...", "analysis": "..."}
    `;
    
    const systemContent = "你是一位精通中国古典诗词的专家，擅长创作各种体裁的诗词。";
    
    // 调用AI服务
    const result = await aiService.callAIGenerateJSON(prompt, systemContent);
    
    if (result) {
      console.log('[creationRoutes] 生成参考诗词 成功', { userId, theme: escapedTheme, genre: escapedGenre });
      return res.json({ success: true, data: result, message: '生成成功' });
    } else {
      // AI调用失败，返回模拟数据
      const mockData = config.creation.defaultData.assistGenerateReference(theme, genre);
      console.error('[creationRoutes] 生成参考诗词 AI失败，返回模拟数据', { userId, theme: escapedTheme, genre: escapedGenre });
      return res.json({ success: false, data: mockData, message: 'AI服务暂时不可用，已返回参考示例' });
    }
  } catch (error) {
    console.error('[creationRoutes] 生成参考诗词 失败', { userId: req.user.userId, params: req.body, error: error.stack || error.message });
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

/** 
 * 核心结构化评分接口（严格评分标准 + 详细解释）
 * POST /api/creation/assist/score
 */
router.post('/assist/score', optionalAuthenticateToken, async (req, res) => {
  try {
    // 数据隔离：仅允许当前用户操作自己的数据
    const userId = req.user.userId;
    const { poem, title, author, genre, theme } = req.body;
    
    // 检查AI调用限流
    if (!checkAIRateLimit(req)) {
      console.error('[creationRoutes] 评分 失败', { userId, error: '请求过于频繁，请稍后重试' });
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后重试' });
    }
    
    console.log('[creationRoutes] 评分 信息', { userId, params: { title, author, genre, theme } });
    
    if (!poem) {
      console.error('[creationRoutes] 评分 失败', { userId, error: '缺少诗词内容' });
      return res.status(400).json({ success: false, message: '缺少诗词内容' });
    }
    
    // 用户输入转义
    const escapedPoem = JSON.stringify(poem).slice(1, -1);
    const escapedTitle = title ? JSON.stringify(title).slice(1, -1) : '无标题';
    const escapedAuthor = author ? JSON.stringify(author).slice(1, -1) : '用户';
    const escapedGenre = genre ? JSON.stringify(genre).slice(1, -1) : '未知';
    const escapedTheme = theme ? JSON.stringify(theme).slice(1, -1) : '未知';

    // 严格评分 + 详细解释的系统 prompt
    const systemContent = `你是一位极其严格、专业的古诗词评审专家。你只对真正优秀的作品给出高分，对大多数普通作品给 50-70 分，对明显敷衍或错误的作品敢于给 30 分以下。你的评价以古典诗词的黄金时代（唐诗）为最高标准，要求格律严谨、意象精准、情感真挚。`;

    const prompt = `请对以下诗词作品进行严格评审打分。

【作品信息】
标题：${escapedTitle}
体裁：${escapedGenre}
主题：${escapedTheme}
正文：
${escapedPoem}

【评分维度及严格标准】

一、内容契合度（content，0-100）
- 95-100：意象选择精妙绝伦，情感表达丝丝入扣，与主题浑然一体，字字紧扣题意
- 85-94：意象基本精准，情感较真挚，与主题较为契合，有少量游离之处
- 75-84：意象选择尚可，情感表达一般，与主题有一定关联但缺乏深度
- 65-74：意象偏离主题或过于堆砌，情感空洞，与主题关联薄弱
- 50-64：内容与主题貌合神离，意象杂乱，情感不真
- 30-49：内容与主题严重不符，意象堆砌不知所云
- 0-29：完全跑题或毫无诗意可言

二、韵律美感（rhythm，0-100）
- 95-100：格律严丝合缝，押韵工稳，节奏如行云流水，朗朗上口
- 85-94：基本符合格律，押韵正确，节奏流畅
- 75-84：偶有格律小瑕疵，押韵基本正确，节奏尚可
- 65-74：格律有明显问题（平仄不合或押韵不工），节奏感一般
- 50-64：格律混乱（多字少字或平仄全错），韵脚生硬
- 30-49：毫无格律可言，节奏全无
- 0-29：句子支离破碎

三、意境表达（mood，0-100）
- 95-100：意境深远，画面感极强，能引发读者强烈共鸣，余韵悠长
- 85-94：意境较好，有画面感，能引发一定共鸣
- 75-84：意境尚可，但不够深远或画面感不足
- 65-74：意境浅薄，表达生硬，共鸣感弱
- 50-64：无意境可言，情感表达生硬或空洞
- 30-49：意象堆砌，无情感，味同嚼蜡
- 0-29：毫无意境

四、语言流畅度（language，0-100）
- 95-100：语言精炼如诗，字字珠玑，用词典雅而准确，千年名句之资
- 85-94：语言流畅，用词准确，有一定文采
- 75-84：语言基本通顺，偶有搭配不当或生造词
- 65-74：用词不当较多，表达时有歧义或生硬
- 50-64：语言粗糙，词不达意，语法错误明显
- 30-49：语言混乱，难以理解
- 0-29：完全不知所云

五、创意性（creativity，0-100）
- 95-100：立意独到，视角新颖，化用经典不着痕迹，令人拍案叫绝
- 85-94：有一定新意，能在传统题材中翻出新意
- 75-84：较为常规，但在用词或表达上有小亮点
- 65-74：陈词滥调较多，模仿痕迹明显
- 50-64：套话连篇，缺乏个人风格
- 30-49：几乎照搬或套用名句
- 0-29：抄袭或严重雷同

【总分计算】总分 = 五维度之和 ÷ 5，保留一位小数。

【修改建议要求】
必须包含以下三个部分，格式严格遵循：
1. 亮点（1-2句）：指出作品中真正闪光的地方，要具体到哪个词/哪个意象/哪句写得精彩
2. 不足（2-4句）：严厉指出2-4个核心问题，要具体到"第X句的XX词语搭配不当"、"韵脚XX字与XX字不和谐"等，不能泛泛而谈
3. 改进方向（1-2句）：给出可操作的修改建议

【JSON格式要求】（严格返回，不要有任何额外文字）：
{"total":总分数值,"dimensions":{"content":分数,"rhythm":分数,"mood":分数,"language":分数,"creativity":分数},"suggestions":"【亮点】...（不超过30字）\n【不足】...（60-100字）\n【建议】...（不超过30字）"}`;

    // 并行调用AI评分和文生图
    const [scoreResult, imageResult] = await Promise.all([
      aiService.callAIGenerateJSON(prompt, systemContent, { temperature: 0.1, maxTokens: 800 }),
      aiService.generatePoemImage(escapedPoem, escapedTitle, escapedAuthor)
    ]);

    if (scoreResult) {
      // 防御：确保总分在合理范围
      if (typeof scoreResult.total !== 'number' || scoreResult.total < 0 || scoreResult.total > 100) {
        const dims = scoreResult.dimensions || {};
        const vals = Object.values(dims).filter(v => typeof v === 'number');
        scoreResult.total = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0;
      }
      const responseData = { ...scoreResult, image: imageResult };
      console.log('[creationRoutes] 评分 成功', { userId, total: scoreResult.total });
      return res.json({ success: true, data: responseData, message: '评分成功' + (imageResult ? '，已生成意境图' : '') });
    } else {
      const mockData = { total: 0, dimensions: { content: 0, rhythm: 0, mood: 0, language: 0, creativity: 0 }, suggestions: 'AI服务暂时不可用，请稍后重试。', image: imageResult || null };
      console.error('[creationRoutes] 评分 AI失败，返回空分', { userId });
      return res.json({ success: false, data: mockData, message: 'AI服务暂时不可用，请稍后重试' });
    }
  } catch (error) {
    console.error('[creationRoutes] 评分 失败', { userId: req.user.userId, params: req.body, error: error.stack || error.message });
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 创作辅助接口 - 生成诗词意境图
router.post('/assist/generate-image', optionalAuthenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { poem, title, author } = req.body;
    
    console.log('[creationRoutes] 生成意境图 信息', { userId, params: { title, author } });
    
    if (!poem) {
      console.error('[creationRoutes] 生成意境图 失败', { userId, error: '缺少诗词内容' });
      return res.status(400).json({ success: false, message: '缺少诗词内容' });
    }
    
    const escapedPoem = poem;
    const escapedTitle = title || '无标题';
    const escapedAuthor = author || '用户';
    
    // 调用文生图服务
    const imageResult = await aiService.generatePoemImage(escapedPoem, escapedTitle, escapedAuthor);
    
    if (imageResult) {
      console.log('[creationRoutes] 生成意境图 成功', { userId });
      return res.json({ 
        success: true, 
        data: imageResult, 
        message: '意境图生成成功' 
      });
    } else {
      console.error('[creationRoutes] 生成意境图 失败', { userId });
      return res.json({ success: false, message: '意境图生成失败，请稍后重试' });
    }
  } catch (error) {
    console.error('[creationRoutes] 生成意境图 失败', { userId: req.user.userId, params: req.body, error: error.stack || error.message });
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 作品管理接口 - 作品保存
router.post('/works/save', optionalAuthenticateToken, async (req, res) => {
  try {
    // 数据隔离：仅允许当前用户操作自己的数据
    const userId = req.user.userId;
    const { title, content, genre, theme, creation_mode, ai_reference, score_data, modification_suggestions } = req.body;
    
    console.log('[creationRoutes] 保存作品 信息', { userId, params: { title, genre, theme, creation_mode } });
    
    if (!title || !content || !genre || !theme || !creation_mode) {
      console.error('[creationRoutes] 保存作品 失败', { userId, error: '缺少必要参数' });
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    const now = new Date().toISOString();
    
    // 保存作品
    const stmt = db.prepare(`
      INSERT INTO user_creations (user_id, title, content, genre, theme, creation_mode, ai_reference, score_data, modification_suggestions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      userId,
      title,
      content,
      genre,
      theme,
      creation_mode,
      ai_reference,
      score_data,
      modification_suggestions,
      now,
      now,
      function(err) {
        if (err) {
          console.error('[creationRoutes] 保存作品 失败', { userId, error: err.message });
          return res.status(500).json({ success: false, message: '保存作品失败' });
        }
        
        console.log('[creationRoutes] 保存作品 成功', { userId, workId: this.lastID });
        res.json({ success: true, data: { id: this.lastID }, message: '作品保存成功' });
      }
    );
  } catch (error) {
    console.error('[creationRoutes] 保存作品 失败', { userId: req.user.userId, params: req.body, error: error.stack || error.message });
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 作品管理接口 - 作品删除
router.delete('/works/:id', optionalAuthenticateToken, async (req, res) => {
  try {
    // 数据隔离：仅允许当前用户操作自己的数据
    const { id } = req.params;
    const userId = req.user.userId;
    
    console.log('[creationRoutes] 删除作品 信息', { userId, params: { id } });
    
    // 检查作品是否存在且属于当前用户
    db.get('SELECT id FROM user_creations WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
      if (err) {
        console.error('[creationRoutes] 删除作品 失败', { userId, error: err.message });
        return res.status(500).json({ success: false, message: '查询作品失败' });
      }
      
      if (!row) {
        console.error('[creationRoutes] 删除作品 失败', { userId, error: '作品不存在或不属于当前用户' });
        return res.status(404).json({ success: false, message: '作品不存在或不属于当前用户' });
      }
      
      // 删除作品
      db.run('DELETE FROM user_creations WHERE id = ?', [id], (err) => {
        if (err) {
          console.error('[creationRoutes] 删除作品 失败', { userId, error: err.message });
          return res.status(500).json({ success: false, message: '删除作品失败' });
        }
        
        console.log('[creationRoutes] 删除作品 成功', { userId, workId: id });
        res.json({ success: true, message: '作品删除成功' });
      });
    });
  } catch (error) {
    console.error('[creationRoutes] 删除作品 失败', { userId: req.user.userId, params: req.params, error: error.stack || error.message });
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 作品管理接口 - 分页列表查询
router.get('/works/list', optionalAuthenticateToken, async (req, res) => {
  try {
    // 数据隔离：仅允许当前用户操作自己的数据
    const { page = 1, pageSize = 10 } = req.query;
    const userId = req.user.userId;
    
    console.log('[creationRoutes] 查询作品列表 信息', { userId, params: { page, pageSize } });
    
    const offset = (page - 1) * pageSize;
    
    // 查询作品列表
    db.all(
      'SELECT id, title, content, genre, theme, creation_mode, score_data, created_at FROM user_creations WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, pageSize, offset],
      (err, works) => {
        if (err) {
          console.error('[creationRoutes] 查询作品列表 失败', { userId, error: err.message });
          return res.status(500).json({ success: false, message: '查询作品列表失败' });
        }
        
        // 查询总数
        db.get('SELECT COUNT(*) as total FROM user_creations WHERE user_id = ?', [userId], (err, count) => {
          if (err) {
            console.error('[creationRoutes] 查询作品总数 失败', { userId, error: err.message });
            return res.status(500).json({ success: false, message: '查询作品总数失败' });
          }
          
          console.log('[creationRoutes] 查询作品列表 成功', { userId, count: works.length, total: count.total });
          res.json({
            success: true,
            data: {
              works,
              pagination: {
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                total: count.total
              }
            },
            message: '查询成功'
          });
        });
      }
    );
  } catch (error) {
    console.error('[creationRoutes] 查询作品列表 失败', { userId: req.user.userId, params: req.query, error: error.stack || error.message });
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 作品管理接口 - 单篇详情查询
router.get('/works/:id', optionalAuthenticateToken, async (req, res) => {
  try {
    // 数据隔离：仅允许当前用户操作自己的数据
    const { id } = req.params;
    const userId = req.user.userId;
    
    console.log('[creationRoutes] 查询作品详情 信息', { userId, params: { id } });
    
    // 查询作品详情
    db.get(
      'SELECT * FROM user_creations WHERE id = ? AND user_id = ?',
      [id, userId],
      (err, work) => {
        if (err) {
          console.error('[creationRoutes] 查询作品详情 失败', { userId, error: err.message });
          return res.status(500).json({ success: false, message: '查询作品详情失败' });
        }
        
        if (!work) {
          console.error('[creationRoutes] 查询作品详情 失败', { userId, error: '作品不存在或不属于当前用户' });
          return res.status(404).json({ success: false, message: '作品不存在或不属于当前用户' });
        }
        
        console.log('[creationRoutes] 查询作品详情 成功', { userId, workId: id });
        res.json({ success: true, data: work, message: '查询成功' });
      }
    );
  } catch (error) {
    console.error('[creationRoutes] 查询作品详情 失败', { userId: req.user.userId, params: req.params, error: error.stack || error.message });
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 数据查询接口 - 用户创作成长数据（按 user_creations 实时聚合，保证与列表一致）
router.get('/stats', optionalAuthenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log('[creationRoutes] 查询创作成长数据 信息', { userId });

    db.all(
      'SELECT score_data, created_at FROM user_creations WHERE user_id = ?',
      [userId],
      (err, rows) => {
        if (err) {
          console.error('[creationRoutes] 查询创作成长数据 失败', { userId, error: err.message });
          return res.status(500).json({ success: false, message: '查询创作成长数据失败' });
        }

        const total_creations = rows.length;
        const scores = [];
        let last_creation_time = null;

        for (const row of rows) {
          const s = parseCreationScoreData(row.score_data);
          if (s !== null) scores.push(s);
          if (row.created_at && (!last_creation_time || row.created_at > last_creation_time)) {
            last_creation_time = row.created_at;
          }
        }

        const qualified_works = scores.filter((s) => s >= CREATION_QUALIFIED_MIN_SCORE).length;
        let average_score = 0;
        if (scores.length) {
          const sum = scores.reduce((a, b) => a + b, 0);
          average_score = Math.round((sum / scores.length) * 10) / 10;
        }
        const highest_score = scores.length ? Math.round(Math.max(...scores)) : 0;

        const payload = {
          user_id: userId,
          total_creations,
          qualified_works,
          average_score,
          highest_score,
          last_creation_time
        };

        console.log('[creationRoutes] 查询创作成长数据 成功', { userId, total_creations });
        res.json({ success: true, data: payload, message: '查询成功' });
      }
    );
  } catch (error) {
    console.error('[creationRoutes] 查询创作成长数据 失败', { userId: req.user.userId, error: error.stack || error.message });
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

module.exports = router;