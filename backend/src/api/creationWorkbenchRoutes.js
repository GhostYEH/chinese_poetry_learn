/**
 * AI诗词创作工作台后端路由
 * 扩展创作辅助接口，支持灵感生成、结构引导、续写推荐、接龙创作等新功能
 */

const express = require('express');
const router = express.Router();
const { db } = require('../utils/db');
const aiService = require('../services/aiService');
const config = require('../config/config');

// AI调用限流Map
const aiRateLimitMap = new Map();

/**
 * 清理过期的限流记录
 */
setInterval(() => {
  const now = Date.now();
  for (const [userId, records] of aiRateLimitMap.entries()) {
    const filteredRecords = records.filter(record => now - record < 60000);
    if (filteredRecords.length === 0) {
      aiRateLimitMap.delete(userId);
    } else {
      aiRateLimitMap.set(userId, filteredRecords);
    }
  }
}, 3600000);

/**
 * 检查AI调用限流
 */
function checkAIRateLimit(userId) {
  const now = Date.now();
  if (!aiRateLimitMap.has(userId)) {
    aiRateLimitMap.set(userId, []);
  }
  const records = aiRateLimitMap.get(userId);
  const filteredRecords = records.filter(record => now - record < 60000);
  aiRateLimitMap.set(userId, filteredRecords);
  if (filteredRecords.length >= 5) return false;
  filteredRecords.push(now);
  aiRateLimitMap.set(userId, filteredRecords);
  return true;
}

/**
 * 可选认证中间件
 */
function optionalAuthenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = config.jwt.secret || 'your-secret-key';
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
          req.user = { userId: config.auth.defaultUserId || 1, username: 'default' };
        } else {
          req.user = { userId: decoded.userId, username: decoded.username };
        }
        next();
      });
    } else {
      req.user = { userId: config.auth.defaultUserId || 1, username: 'default' };
      next();
    }
  } catch (error) {
    req.user = { userId: config.auth.defaultUserId || 1, username: 'default' };
    next();
  }
}

/**
 * 转义用户输入
 */
function escapeString(str) {
  if (!str) return '';
  return String(str).replace(/[<>'"]/g, '');
}

// ==================== 灵感生成接口 ====================

/**
 * 步骤1：灵感生成 - 生成关键词
 * POST /api/creation/inspiration/generate
 */
router.post('/inspiration/generate', optionalAuthenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { theme, genre } = req.body;

    if (!checkAIRateLimit(userId)) {
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后重试' });
    }

    if (!theme || !genre) {
      return res.status(400).json({ success: false, message: '缺少主题或体裁参数' });
    }

    const escapedTheme = escapeString(theme);
    const escapedGenre = escapeString(genre);

    const prompt = `你是古典诗词创作导师。用户要在「${escapedTheme}」主题下写一首「${escapedGenre}」。

请输出**唯一**一个 JSON 对象（不要 markdown、不要解释），字段如下：
{
  "keywords": ["5个与主题强相关的意象/情感词，避免空洞套话"],
  "theme": "用20-40字把主题诗意化展开，点出可写的画面或情感转折",
  "mood": "整首诗的情感基调（如：苍凉旷远 / 含蓄婉转），15字内",
  "openingIdeas": ["3个不同的开篇切入角度，各一句提示，不要写诗正文"],
  "avoid": ["2-3个写该主题时容易犯的俗套或陈词，提醒避开"],
  "suggestions": ["3条具体可操作的写作建议：结构、押韵、炼字各至少一条"]
}

要求：关键词要可入诗；openingIdeas 要互不重复；avoid 要真诚犀利。`;

    const result = await aiService.callAIGenerateJSON(prompt,
      '你是一位精通中国古典诗词的创作导师，擅长从主题发散创意，拒绝陈词滥调。',
      { temperature: 0.75, maxTokens: 1200 }
    );

    if (result) {
      const data = {
        keywords: Array.isArray(result.keywords) ? result.keywords : [],
        theme: result.theme || '',
        mood: result.mood || '',
        openingIdeas: Array.isArray(result.openingIdeas) ? result.openingIdeas : [],
        avoid: Array.isArray(result.avoid) ? result.avoid : [],
        suggestions: Array.isArray(result.suggestions) ? result.suggestions : []
      };
      return res.json({ success: true, data });
    }

    return res.json({
      success: true,
      data: {
        keywords: ['意象', '情感', '时空', '物象', '声息'],
        theme: `围绕「${escapedTheme}」展开诗意画面，先定取景与情感再下笔。`,
        mood: '请配置 AI 后获得更贴切基调',
        openingIdeas: ['从眼前一处小景切入', '从一声一物引出心绪', '从对比或转折起笔'],
        avoid: ['空泛口号式抒情', '意象堆砌无主线'],
        suggestions: [
          '后端需在环境变量 SILICONFLOW_API_KEY 中配置硅基流动 API 密钥',
          '配置后请重新点击「生成灵感」',
          '参考文档：https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions'
        ]
      }
    });
  } catch (error) {
    console.error('[creationRoutes] 灵感生成失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ==================== 结构引导接口 ====================

/**
 * 步骤2：结构引导 - 获取写作结构提示
 * POST /api/creation/structure/guide
 */
router.post('/structure/guide', optionalAuthenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { genre, theme } = req.body;

    if (!checkAIRateLimit(userId)) {
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后重试' });
    }

    if (!genre) {
      return res.status(400).json({ success: false, message: '缺少体裁参数' });
    }

    const escapedGenre = escapeString(genre);
    const escapedTheme = escapeString(theme || '');

    // 根据体裁返回结构模板
    const structureTemplates = {
      '五言绝句': {
        name: '五言绝句',
        lines: 4,
        charactersPerLine: 5,
        rhymeScheme: '二四句押韵',
        structure: [
          { position: '首句', role: '起', description: '点明题意，交代时地', example: '白日依山尽，黄河入海流' },
          { position: '第二句', role: '承', description: '承接上文，展开描写', example: '欲穷千里目，更上一层楼' },
          { position: '第三句', role: '转', description: '转折变化，另辟蹊径', example: '海日生残夜，江春入旧年' },
          { position: '末句', role: '合', description: '总结全诗，点明主旨', example: '会当凌绝顶，一览众山小' }
        ],
        tips: [
          '注意起承转合的层次',
          '每句5字，字字珠玑',
          '追求言简意丰的效果'
        ]
      },
      '七言绝句': {
        name: '七言绝句',
        lines: 4,
        charactersPerLine: 7,
        rhymeScheme: '二四句押韵',
        structure: [
          { position: '首句', role: '起', description: '点明题意，总领全诗', example: '故人西辞黄鹤楼，烟花三月下扬州' },
          { position: '第二句', role: '承', description: '承接叙事或写景', example: '孤帆远影碧空尽，唯见长江天际流' },
          { position: '第三句', role: '转', description: '转折递进，宕开一笔', example: '醉卧沙场君莫笑，古来征战几人回' },
          { position: '末句', role: '合', description: '以景结情或直抒胸臆', example: '羌笛何须怨杨柳，春风不度玉门关' }
        ],
        tips: [
          '注意首联的铺陈',
          '第三句是全诗的关键转折',
          '末句要有余韵'
        ]
      },
      '五言律诗': {
        name: '五言律诗',
        lines: 8,
        charactersPerLine: 5,
        rhymeScheme: '偶数句押韵，首句可入韵',
        structure: [
          { position: '首联', role: '起', description: '首联：点题起势', example: '风急天高猿啸哀，渚清沙白鸟飞回' },
          { position: '颔联', role: '承', description: '颔联：承接扩展', example: '无边落木萧萧下，不尽长江滚滚来' },
          { position: '颈联', role: '转', description: '颈联：转折深化', example: '万里悲秋常作客，百年多病独登台' },
          { position: '尾联', role: '合', description: '尾联：总结抒情', example: '艰难苦恨繁霜鬓，潦倒新停浊酒杯' }
        ],
        tips: [
          '中间两联必须对仗',
          '注意意境的层次递进',
          '情感要逐渐加深'
        ]
      },
      '七言律诗': {
        name: '七言律诗',
        lines: 8,
        charactersPerLine: 7,
        rhymeScheme: '偶数句押韵，首句可入韵',
        structure: [
          { position: '首联', role: '起', description: '首联：交代背景，引出主题', example: '相见时难别亦难，东风无力百花残' },
          { position: '颔联', role: '承', description: '颔联：承接扩展，渲染氛围', example: '春蚕到死丝方尽，蜡炬成灰泪始干' },
          { position: '颈联', role: '转', description: '颈联：转折深化，升华情感', example: '晓镜但愁云鬓改，夜吟应觉月光寒' },
          { position: '尾联', role: '合', description: '尾联：点明主旨，回应开头', example: '蓬山此去无多路，青鸟殷勤为探看' }
        ],
        tips: [
          '中间两联要对仗工整',
          '注意意象的精心选择',
          '情感表达要含蓄深婉'
        ]
      },
      '宋词': {
        name: '宋词',
        lines: 0,
        charactersPerLine: 0,
        rhymeScheme: '依词牌',
        structure: [
          { position: '起', role: '上阙起', description: '写景叙事，奠定基调', example: '大江东去，浪淘尽，千古风流人物' },
          { position: '承', role: '上阙承', description: '展开描写，层层铺垫', example: '故垒西边，人道是，三国周郎赤壁' },
          { position: '转', role: '下阙转', description: '转折抒情，由景入情', example: '遥想公瑾当年，小乔初嫁了' },
          { position: '合', role: '下阙合', description: '总结全词，点明主旨', example: '人生如梦，一尊还酹江月' }
        ],
        tips: [
          '根据词牌确定句式',
          '注意上下阙的分工',
          '讲究豪放或婉约的风格'
        ]
      }
    };

    const template = structureTemplates[escapedGenre] || structureTemplates['五言绝句'];

    // 如果有主题，生成针对性建议
    if (escapedTheme) {
      const prompt = `
请根据主题"${escapedTheme}"和体裁${escapedGenre}，提供具体的写作指导。

请严格按以下JSON格式返回：
{
  "customTips": ["针对该主题的具体建议1", "针对该主题的具体建议2"]
}
`;

      const aiResult = await aiService.callAIGenerateJSON(prompt,
        '你是一位古典诗词写作指导老师。',
        { temperature: 0.7 }
      );

      if (aiResult && aiResult.customTips) {
        template.tips = [...template.tips, ...aiResult.customTips];
      }
    }

    return res.json({ success: true, data: template });
  } catch (error) {
    console.error('[creationRoutes] 结构引导失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ==================== 续写推荐接口 ====================

/**
 * AI续写推荐 - 用户输入一句，AI推荐下一句
 * POST /api/creation/recommend/next-line
 */
router.post('/recommend/next-line', optionalAuthenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentLines, genre, theme, maxLength } = req.body;

    if (!checkAIRateLimit(userId)) {
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后重试' });
    }

    if (!currentLines) {
      return res.status(400).json({ success: false, message: '缺少当前诗句' });
    }

    const escapedLines = escapeString(currentLines);
    const escapedGenre = escapeString(genre || '五言绝句');
    const escapedTheme = escapeString(theme || '一般主题');
    const lineLength = maxLength || (escapedGenre.includes('七') ? 7 : 5);

    // 分析已有诗句的韵脚和意境
    const lines = escapedLines.split('\n').filter(l => l.trim());
    const lastLine = lines[lines.length - 1] || '';
    const lineCount = lines.length;

    const prompt = `
用户正在创作一首${escapedGenre}，主题是"${escapedTheme}"。

用户已经写了以下诗句：
${escapedLines}

这是第${lineCount + 1}句，需要${lineLength}个字。

请根据已有诗句的意境、韵律和主题，生成3个下一句的候选选项。

请严格按以下JSON格式返回，不要添加任何其他文字：
{
  "suggestions": [
    {"line": "候选句1", "reason": "推荐理由1", "mood": "意境描述"},
    {"line": "候选句2", "reason": "推荐理由2", "mood": "意境描述"},
    {"line": "候选句3", "reason": "推荐理由3", "mood": "意境描述"}
  ],
  "rhymeHint": "押韵提示",
  "moodHint": "情感走向提示"
}
`;

    const result = await aiService.callAIGenerateJSON(prompt,
      '你是一位精通古典诗词创作的专家，擅长续写诗句。',
      { temperature: 0.8, maxTokens: 800 }
    );

    if (result && Array.isArray(result.suggestions) && result.suggestions.length) {
      const mapped = result.suggestions
        .map((s) => ({
          line: (s && s.line) ? String(s.line).trim() : '',
          reason: (s && s.reason) ? String(s.reason).trim() : '',
          mood: (s && s.mood) ? String(s.mood).trim() : ''
        }))
        .filter((s) => s.line);
      return res.json({
        success: true,
        data: {
          suggestions: mapped.length ? mapped : [{ line: '（AI未返回有效续写，请重试）', reason: '', mood: '' }],
          rhymeHint: result.rhymeHint || '',
          moodHint: result.moodHint || ''
        }
      });
    }

    return res.json({
      success: true,
      data: {
        suggestions: [
          {
            line: '（续写暂不可用）',
            reason: '请在后端配置 SILICONFLOW_API_KEY 后重试',
            mood: ''
          }
        ],
        rhymeHint: '注意与上句字数、押韵一致',
        moodHint: '承接上文意境'
      }
    });
  } catch (error) {
    console.error('[creationRoutes] 续写推荐失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

/**
 * 实时续写提示（轻量级）
 * POST /api/creation/realtime/tips
 */
router.post('/realtime/tips', optionalAuthenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { partialLine, genre } = req.body;

    if (!checkAIRateLimit(userId)) {
      return res.status(429).json({ success: false, message: '请求过于频繁' });
    }

    const escapedLine = escapeString(partialLine || '');
    const escapedGenre = escapeString(genre || '五言绝句');
    const lineLength = escapedGenre.includes('七') ? 7 : 5;

    const prompt = `
用户正在写诗，当前部分输入是："${escapedLine}"
目标是写${lineLength}字一句的诗句。

请提供一些实时的创作提示，帮助用户完成这一句。

请严格按以下JSON格式返回：
{
  "tips": ["提示1", "提示2", "提示3"],
  "remainingChars": "还需要填的字数",
  "rhymeReminder": "押韵提醒"
}
`;

    const result = await aiService.callAIGenerateJSON(prompt,
      '你是一位诗词创作助手，提供简洁实用的创作建议。',
      { temperature: 0.6, maxTokens: 300 }
    );

    if (result) {
      return res.json({ success: true, data: result });
    }

    return res.json({
      success: true,
      data: {
        tips: ['注意字数', '考虑押韵', '保持意境连贯'],
        remainingChars: lineLength - escapedLine.length,
        rhymeReminder: '参考已有诗句的韵脚'
      }
    });
  } catch (error) {
    console.error('[creationRoutes] 实时提示失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ==================== 接龙创作接口 ====================

/**
 * 接龙创作 - 获取AI第一句
 * POST /api/creation/chain/start
 */
router.post('/chain/start', optionalAuthenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { genre, theme } = req.body;

    if (!checkAIRateLimit(userId)) {
      return res.status(429).json({ success: false, message: '请求过于频繁' });
    }

    const escapedGenre = escapeString(genre || '五言绝句');
    const escapedTheme = escapeString(theme || '自然风光');
    const lineLength = escapedGenre.includes('七') ? 7 : 5;

    const prompt = `
请为接龙创作模式生成一首${escapedGenre}的第一句诗。

主题："${escapedTheme}"

要求：
1. ${lineLength}个字，简洁有意境
2. 留有续写的空间
3. 韵律优美，朗朗上口

请严格按以下JSON格式返回：
{
  "aiLine": "生成的诗句",
  "mood": "这一句的情感基调",
  "rhyme": "押韵的韵部（如：ang, i, u等）"
}
`;

    const result = await aiService.callAIGenerateJSON(prompt,
      '你是一位诗词创作专家，擅长创作能引发续写的诗句。',
      { temperature: 0.9, maxTokens: 400 }
    );

    if (result) {
      return res.json({ success: true, data: result });
    }

    return res.json({
      success: true,
      data: {
        aiLine: '春风拂面柳丝轻',
        mood: '轻柔明快',
        rhyme: 'ing'
      }
    });
  } catch (error) {
    console.error('[creationRoutes] 接龙开始失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

/**
 * 接龙创作 - 获取AI下一句
 * POST /api/creation/chain/next
 */
router.post('/chain/next', optionalAuthenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { userLine, genre, theme, lineNumber } = req.body;

    if (!checkAIRateLimit(userId)) {
      return res.status(429).json({ success: false, message: '请求过于频繁' });
    }

    if (!userLine) {
      return res.status(400).json({ success: false, message: '缺少用户诗句' });
    }

    const escapedLine = escapeString(userLine);
    const escapedGenre = escapeString(genre || '五言绝句');
    const escapedTheme = escapeString(theme || '一般主题');
    const lineLength = escapedGenre.includes('七') ? 7 : 5;

    const prompt = `
用户正在进行诗词接龙创作。

当前信息：
- 体裁：${escapedGenre}
- 主题："${escapedTheme}"
- 用户刚写的句子："${escapedLine}"
- 这是第${lineNumber || 1}轮

请根据用户写的句子，生成AI的回应句。

要求：
1. ${lineLength}个字
2. 要与用户的句子形成呼应或对仗
3. 意境要有所推进或转折
4. 押韵要自然

请严格按以下JSON格式返回：
{
  "aiLine": "AI生成的诗句",
  "rhymeHint": "押韵提示",
  "moodHint": "情感走向提示"
}
`;

    const result = await aiService.callAIGenerateJSON(prompt,
      '你是一位诗词接龙创作专家，擅长与用户互动创作。',
      { temperature: 0.8, maxTokens: 400 }
    );

    if (result) {
      return res.json({
        success: true,
        data: {
          aiLine: result.aiLine,
          rhymeHint: result.rhymeHint || '',
          moodHint: result.moodHint || ''
        }
      });
    }

    return res.json({
      success: true,
      data: {
        aiLine: 'AI续写示例句',
        rhymeHint: '注意押韵',
        moodHint: '情感延续'
      }
    });
  } catch (error) {
    console.error('[creationRoutes] 接龙续写失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ==================== 飞花令创作接口 ====================

/**
 * 飞花令创作 - 获取随机关键字
 * POST /api/creation/feihua/keyword
 */
router.post('/feihua/keyword', optionalAuthenticateToken, async (req, res) => {
  try {
    const { difficulty = '中等' } = req.body;

    const keywordSets = {
      '简单': ['春', '秋', '月', '花', '风', '云', '山', '水', '鸟', '酒'],
      '中等': ['柳', '雨', '雪', '雁', '梦', '泪', '思', '归', '愁', '恨'],
      '困难': ['烛', '笙', '瑟', '箫', '鸿', '鹤', '蝶', '蝉', '枫', '荻']
    };

    const keywords = keywordSets[difficulty] || keywordSets['中等'];
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];

    // 生成相关词
    const relatedPrompt = `
关键字是"${keyword}"，请给出5个与这个关键字在古典诗词中常常一起出现的意象词。

请严格按以下JSON格式返回：
{
  "relatedWords": ["相关词1", "相关词2", "相关词3", "相关词4", "相关词5"]
}
`;

    const aiResult = await aiService.callAIGenerateJSON(relatedPrompt,
      '你是一位古典诗词专家。',
      { temperature: 0.5, maxTokens: 200 }
    );

    return res.json({
      success: true,
      data: {
        keyword,
        relatedWords: aiResult?.relatedWords || ['明月', '清风', '杨柳', '落花', '流水']
      }
    });
  } catch (error) {
    console.error('[creationRoutes] 飞花令关键字失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

/**
 * 飞花令创作 - 评分
 * POST /api/creation/feihua/score
 */
router.post('/feihua/score', optionalAuthenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { poem, keyword, genre } = req.body;

    if (!checkAIRateLimit(userId)) {
      return res.status(429).json({ success: false, message: '请求过于频繁' });
    }

    if (!poem) {
      return res.status(400).json({ success: false, message: '缺少诗词内容' });
    }

    const escapedPoem = escapeString(poem);
    const escapedKeyword = escapeString(keyword || '');
    const escapedGenre = escapeString(genre || '五言绝句');

    const prompt = `请对以下飞花令诗词作品进行严格评审。

【关键字】"${escapedKeyword}"（必须出现）
【体裁】${escapedGenre}
【正文】
${escapedPoem}

【评分维度】

一、关键字运用（keyword，0-100）
- 95-100：关键字出现3次以上，位置变化丰富（首/中/末/单独成句），每次出现都与全诗意境自然融合
- 85-94：关键字出现2-3次，位置较合理，能与全诗意境融合
- 75-84：关键字出现2次，位置尚可，但融合度一般
- 60-74：关键字仅出现1次，或出现多次但位置生硬、与意境脱节
- 40-59：关键字出现但位置突兀，明显为完成任务而插入
- 0-39：关键字未出现

二、内容契合度（content，0-100）
- 95-100：意象精准绝伦，情感与主题浑然一体，字字紧扣
- 85-94：意象基本精准，情感较真挚，与主题较为契合
- 75-84：意象尚可，情感一般，与主题有一定关联但缺乏深度
- 65-74：意象偏离主题，情感空洞，与主题关联薄弱
- 50-64：内容与主题貌合神离，意象杂乱
- 30-49：内容与主题严重不符
- 0-29：完全跑题

三、韵律美感（rhythm，0-100）
- 95-100：格律严丝合缝，押韵工稳，节奏如行云流水
- 85-94：基本符合格律，押韵正确，节奏流畅
- 75-84：偶有格律小瑕疵，押韵基本正确
- 65-74：格律有明显问题，韵脚不工整
- 50-64：格律混乱，韵脚生硬
- 30-49：毫无格律可言
- 0-29：句子支离破碎

四、意境表达（mood，0-100）
- 95-100：意境深远，画面感极强，余韵悠长
- 85-94：意境较好，有画面感，能引发一定共鸣
- 75-84：意境尚可，但不够深远
- 65-74：意境浅薄，共鸣感弱
- 50-64：无意境可言
- 30-49：意象堆砌，无情感
- 0-29：毫无意境

五、创意性（creativity，0-100）
- 95-100：立意独到，视角新颖，令人拍案叫绝
- 85-94：有一定新意，能在传统题材中翻出新意
- 75-84：较为常规，有小亮点
- 65-74：陈词滥调较多，模仿痕迹明显
- 50-64：套话连篇
- 30-49：几乎照搬名句
- 0-29：抄袭或严重雷同

【总分】五维度之和÷5，保留一位小数。

【修改建议】（必须包含以下内容，格式严格）
1. 亮点：关键字运用的亮点（不超过25字）
2. 不足：2-3个具体问题，指出具体位置和问题（50-80字）
3. 建议：具体修改方向（不超过30字）

严格JSON格式：
{"total":总分数值,"dimensions":{"keyword":分数,"content":分数,"rhythm":分数,"mood":分数,"creativity":分数},"suggestions":"【亮点】...（≤25字）\n【不足】...（50-80字）\n【建议】...（≤30字）"}`;

    const result = await aiService.callAIGenerateJSON(prompt,
      '你是一位极其严格的飞花令诗词评审专家。飞花令要求关键字贯穿全诗，每一处出现都要与上下文意境完美融合。你的评分标准极其严格。',
      { temperature: 0.1, maxTokens: 800 }
    );

    if (result) {
      return res.json({ success: true, data: result });
    }

    return res.json({
      success: true,
      data: {
        total: 0,
        dimensions: { keyword: 0, content: 0, rhythm: 0, mood: 0, creativity: 0 },
        suggestions: '【亮点】无\n【不足】AI 暂不可用，请配置 SILICONFLOW_API_KEY 后重试\n【建议】检查网络与密钥'
      }
    });
  } catch (error) {
    console.error('[creationRoutes] 飞花令评分失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// ==================== AI生成完整诗词 ====================

/**
 * 步骤3：AI生成完整诗词
 * POST /api/creation/generate
 */
router.post('/generate', optionalAuthenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { theme, genre, keywords, structure } = req.body;

    if (!checkAIRateLimit(userId)) {
      return res.status(429).json({ success: false, message: '请求过于频繁' });
    }

    if (!theme || !genre) {
      return res.status(400).json({ success: false, message: '缺少主题或体裁' });
    }

    const escapedTheme = escapeString(theme);
    const escapedGenre = escapeString(genre);
    const escapedKeywords = Array.isArray(keywords) ? keywords.join('、') : '';
    const escapedStructure = escapeString(structure || '');

    const prompt = `
请根据以下信息创作一首${escapedGenre}：

主题："${escapedTheme}"
关键词：${escapedKeywords || '无'}
结构提示：${escapedStructure || '遵循传统格律'}

要求：
1. 符合${escapedGenre}的格律要求
2. 意境优美，情感真挚
3. 语言精炼，富有诗意
4. 如有标题，请一并给出

请严格按以下JSON格式返回：
{
  "poem": "诗词正文（每句一行）",
  "title": "诗词标题",
  "explanation": "简要说明诗词的意境和表达"
}
`;

    const result = await aiService.callAIGenerateJSON(prompt,
      '你是一位精通中国古典诗词创作的诗人。',
      { temperature: 0.8, maxTokens: 800 }
    );

    if (result) {
      return res.json({ success: true, data: result });
    }

    return res.json({
      success: true,
      data: {
        poem: '春风又绿江南岸\n明月何时照我还\n孤帆远影碧空尽\n唯见长江天际流',
        title: '春日感怀',
        explanation: '以春风和明月为意象，表达了诗人对故乡的思念之情'
      }
    });
  } catch (error) {
    console.error('[creationRoutes] 诗词生成失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

module.exports = router;
