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

    const prompt = `你是中国古典诗词创作大师，精通唐诗宋词意象体系。用户要在「${escapedTheme}」主题下写一首「${escapedGenre}」。

请为这一首**具体**的诗生成个性化灵感材料，**所有内容必须紧扣「${escapedTheme}」主题**。

输出**唯一**一个 JSON 对象（不要 markdown、不要任何其他文字）：

{
  "keywords": [
    "围绕「${escapedTheme}」主题的第1个核心意象（要求：画面感强、可入诗，如具体景物或情感）",
    "围绕「${escapedTheme}」主题的第2个核心意象",
    "围绕「${escapedTheme}」主题的第3个核心意象",
    "围绕「${escapedTheme}」主题的第4个感官/动态意象（视觉/听觉/嗅觉/触觉/动或静）",
    "围绕「${escapedTheme}」主题的第5个虚实/远近意象",
    "围绕「${escapedTheme}」主题的第6个情感相关词",
    "围绕「${escapedTheme}」主题的第7个时空/季节词",
    "围绕「${escapedTheme}」主题的第8个有创意的意外意象"
  ],
  "theme": "用40-60字诗意展开「${escapedTheme}」主题，写出可入诗的具体画面、情感层次、时空跨度。不要写诗，只要描述画面",
  "mood": "这首诗的情感基调，2-4字（如：苍凉、温暖、沉郁、清新、寂寥）",
  "openingIdeas": [
    "紧扣「${escapedTheme}」，从时令/季节切入的开篇方向，如'以某时节景物引出'，10-15字",
    "紧扣「${escapedTheme}」，从空间/地点切入的开篇方向，10-15字",
    "紧扣「${escapedTheme}」，从情感/心绪切入的开篇方向，10-15字",
    "紧扣「${escapedTheme}」，从动静对比或意外角度切入的开篇方向，10-15字"
  ],
  "avoid": [
    "写「${escapedTheme}」时最常见的空洞套话，提醒避开，如'无病呻吟的大词'",
    "写「${escapedTheme}」时常见的陈腐意象，如'直接说愁思而不借景抒情'",
    "写「${escapedTheme}」时容易跑题的方向，提醒避开"
  ],
  "suggestions": [
    "紧扣「${escapedTheme}」的结构安排建议：起承转合每句的核心任务，20-30字",
    "紧扣「${escapedTheme}」的押韵技巧：推荐适合的韵部及原因，20-30字",
    "紧扣「${escapedTheme}」的炼字方法：哪个字最值得推敲及理由，20-30字",
    "紧扣「${escapedTheme}」的意境营造：如何用具体意象代替抽象概念，20-30字"
  ]
}

要求：keywords 不得出现"春风""杨柳""明月"等万金油意象，必须是「${escapedTheme}」主题下真正有画面感的词；openingIdeas 要真的针对这个主题；avoid 要指出「${escapedTheme}」主题写作中的具体陷阱。`;

    const result = await aiService.callAIGenerateJSON(prompt,
      '你是一位中国古典诗词创作大师，精通唐诗宋词的意象体系。你为每一首诗生成的灵感材料都是独一无二的、紧扣主题的，绝不输出空洞的万金油意象（如"春风杨柳"），而是根据用户具体主题给出真正有画面感的意象。',
      { temperature: 0.85, maxTokens: 1500 }
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
        keywords: ['意象', '情感', '时空', '物象', '声息', '光影', '动静', '虚实'],
        theme: `围绕「${escapedTheme}」展开诗意画面，先定取景与情感再下笔。`,
        mood: '请配置 AI 后获得更贴切基调',
        openingIdeas: ['从眼前一处小景切入', '从一声一物引出心绪', '从对比或转折起笔', '从回忆或想象入手'],
        avoid: ['空泛口号式抒情', '意象堆砌无主线', '陈词滥调无新意'],
        suggestions: [
          '后端需在环境变量 SILICONFLOW_API_KEY 中配置硅基流动 API 密钥',
          '配置后请重新点击「生成灵感」',
          '参考文档：https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions',
          '建议先确定情感基调再选择意象'
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
    const { genre, theme, keywords, mood } = req.body;

    if (!checkAIRateLimit(userId)) {
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后重试' });
    }

    if (!genre) {
      return res.status(400).json({ success: false, message: '缺少体裁参数' });
    }

    const escapedGenre = escapeString(genre);
    const escapedTheme = escapeString(theme || '');
    const escapedKeywords = Array.isArray(keywords) ? keywords.join('、') : '';
    const escapedMood = escapeString(mood || '');

    // 基础结构模板
    const baseTemplates = {
      '五言绝句': { lines: 4, charactersPerLine: 5, rhymeScheme: '二四句押韵' },
      '七言绝句': { lines: 4, charactersPerLine: 7, rhymeScheme: '二四句押韵' },
      '五言律诗': { lines: 8, charactersPerLine: 5, rhymeScheme: '偶数句押韵，首句可入韵' },
      '七言律诗': { lines: 8, charactersPerLine: 7, rhymeScheme: '偶数句押韵，首句可入韵' },
      '宋词': { lines: 0, charactersPerLine: 0, rhymeScheme: '依词牌' }
    };

    const baseTemplate = baseTemplates[escapedGenre] || baseTemplates['五言绝句'];

    // 使用AI生成个性化结构引导
    const prompt = `你是中国古典诗词创作大师，精通唐诗宋词格律与起承转合技法。用户要创作一首「${escapedGenre}」，主题是「${escapedTheme}」。

已有创作素材：
- 关键词：${escapedKeywords || '用户尚未指定，将根据主题推断'}
- 情感基调：${escapedMood || '用户尚未指定，将根据主题推断'}

请为这首**具体**的诗输出个性化结构引导，**所有描述必须紧扣「${escapedTheme}」主题及其具体意象**。

输出**唯一**一个 JSON 对象（不要 markdown、不要任何其他文字）：

{
  "name": "${escapedGenre}",
  "lines": ${baseTemplate.lines},
  "charactersPerLine": ${baseTemplate.charactersPerLine},
  "rhymeScheme": "${baseTemplate.rhymeScheme}",
  "introduction": "用50-80字介绍${escapedGenre}的格律要点，结合「${escapedTheme}」主题具体说明：适合用哪些画面/意象/情感来写，字数与韵脚有何特殊要求",
  "structure": [
    {
      "position": "第一句（起）",
      "role": "起",
      "description": "针对「${escapedTheme}」主题：具体说明起句如何切入。分析这一主题最适合从哪个具体画面或角度开篇（如：从时令景物、从空间环境、从人物状态等），给出2-3个可选方向",
      "example": "一首经典诗中，与「${escapedTheme}」主题最相近的起句，注明诗名和作者",
      "themeHint": "针对「${escapedTheme}」主题的具体起笔操作建议，如'先写什么景物/声音/颜色来定调'，15-25字"
    },
    {
      "position": "第二句（承）",
      "role": "承",
      "description": "针对「${escapedTheme}」主题：承接起句后如何展开描写。具体说明这一主题的承句适合用哪些意象层层铺陈，是渲染氛围还是深化情感",
      "example": "一首经典诗中，与「${escapedTheme}」主题最相近的承句，注明诗名和作者",
      "themeHint": "针对「${escapedTheme}」主题的具体承接操作建议，如'用什么意象来延伸画面'，15-25字"
    },
    {
      "position": "第三句（转）",
      "role": "转",
      "description": "针对「${escapedTheme}」主题：转句如何打破前两句的平稳。具体分析这一主题最适合哪种转折方式（时空跳跃、情感反转、视角切换、以动写静等），给出具体操作方向",
      "example": "一首经典诗中，与「${escapedTheme}」主题最相近的转句，注明诗名和作者",
      "themeHint": "针对「${escapedTheme}」主题的具体转折方向，如'从哪个角度引入新意象或新情感'，15-25字"
    },
    {
      "position": "第四句（合）",
      "role": "合",
      "description": "针对「${escapedTheme}」主题：合句如何收束全诗、升华情感。具体说明这一主题的结尾适合用哪种方式收尾（情景交融、以景结情、直抒胸臆、余韵悠长等）",
      "example": "一首经典诗中，与「${escapedTheme}」主题最相近的合句，注明诗名和作者",
      "themeHint": "针对「${escapedTheme}」主题的具体收束建议，如'用什么意象或情感来定格全诗'，15-25字"
    }
  ],
  "tips": [
    "紧扣「${escapedTheme}」主题的结构技巧：起承转合每句的核心任务分配，20-35字",
    "紧扣「${escapedTheme}」主题的意象选择：最适合这一主题的3-4个核心意象及运用方式，25-40字",
    "紧扣「${escapedTheme}」主题的情感表达：如何把抽象情感化为具体意象而不空洞说教，25-40字",
    "紧扣「${escapedTheme}」主题的语言锤炼：哪个字最值得推敲（如动词、颜色词、数词等），说明理由，20-35字",
    "紧扣「${escapedTheme}」主题的意境营造：如何用2-3个核心意象构建统一画面感，25-40字"
  ],
  "rhyme": "紧扣「${escapedTheme}」主题推荐韵部：分析这一主题适合押哪个韵部（ang/i/u/ai/ie等），以及为什么是这个韵部，30-50字",
  "rhymeExamples": ["推荐韵部1：适合「${escapedTheme}」主题的韵脚，列出4-5个该韵部中与主题最相关的常用韵字", "推荐韵部2：备选韵部，列出4-5个相关韵字"],
  "keywordSuggestions": [
    {"keyword": "${escapedKeywords ? escapedKeywords.split('、')[0] || '主题核心意象' : '主题核心意象'}", "usage": "紧扣「${escapedTheme}」主题，说明这个词在诗中适合放在哪一句、用什么方式呈现（如：动静结合、远近对比），20-30字"},
    {"keyword": "${escapedKeywords ? escapedKeywords.split('、')[1] || '主题延伸意象' : '主题延伸意象'}", "usage": "紧扣「${escapedTheme}」主题，说明这个词如何与核心意象配合、增强画面层次，20-30字"},
    {"keyword": "${escapedKeywords ? escapedKeywords.split('、')[2] || '情感/时空意象' : '情感/时空意象'}", "usage": "紧扣「${escapedTheme}」主题，说明这个词如何承载情感或构建时空感，20-30字"}
  ],
  "avoid": [
    "写「${escapedTheme}」主题时最常见的空洞套话（如直接说愁思而不借景），要犀利指出，15-25字",
    "写「${escapedTheme}」主题时容易犯的陈腐意象或老套表达，要具体指出是什么，15-25字",
    "写「${escapedTheme}」主题时结构上最容易犯的错误（如起句太重/转得太突兀），15-25字"
  ],
  "advancedTips": [
    "进阶技巧1：针对有基础写作者，紧扣「${escapedTheme}」主题的深层技法（如：以动写静、虚实相生、对写等），25-40字",
    "进阶技巧2：针对修辞手法，紧扣「${escapedTheme}」主题最适合用的比喻/对仗/互文等，25-40字",
    "进阶技巧3：针对意境层次，紧扣「${escapedTheme}」主题如何构建由近及远/由实入虚的多层画面，25-40字"
  ]
}

要求：examples 中的范例诗句必须是真实存在的、主题或情感与「${escapedTheme}」相近的唐宋诗词名句，不是通用范例；themeHint 要给出真正可以照着做的操作指令，不是泛泛而谈。`;

    const result = await aiService.callAIGenerateJSON(prompt,
      '你是一位中国古典诗词创作大师，精通唐诗宋词格律与起承转合技法。你的结构引导极其具体、实用：你给出的每一句起承转合建议都能让用户照着写；你的范例诗句必须是真实存在的唐宋名句；你绝不会输出空洞的通用套话，而是根据每个主题给出真正有画面感的、个性化的指导。',
      { temperature: 0.8, maxTokens: 3000 }
    );

    if (result) {
      return res.json({ success: true, data: result });
    }

    // AI不可用时的fallback
    const fallbackData = {
      name: escapedGenre,
      lines: baseTemplate.lines,
      charactersPerLine: baseTemplate.charactersPerLine,
      rhymeScheme: baseTemplate.rhymeScheme,
      introduction: `${escapedGenre}是古典诗歌中的经典形式，讲究起承转合、情景交融。围绕「${escapedTheme}」主题创作时，要注意选择恰当的意象，营造独特的意境。`,
      structure: [
        { position: '第一句（起）', role: '起', description: '点明题意，交代时地背景，引出主题', example: '白日依山尽，黄河入海流', themeHint: `从${escapedTheme}的一个具体场景切入` },
        { position: '第二句（承）', role: '承', description: '承接上文，展开描写，渲染氛围', example: '欲穷千里目，更上一层楼', themeHint: `深化${escapedTheme}的意境` },
        { position: '第三句（转）', role: '转', description: '转折变化，另辟蹊径，引入新意', example: '海日生残夜，江春入旧年', themeHint: `从另一角度诠释${escapedTheme}` },
        { position: '第四句（合）', role: '合', description: '总结全诗，点明主旨，情感升华', example: '会当凌绝顶，一览众山小', themeHint: `点明${escapedTheme}的深层意蕴` }
      ],
      tips: [
        '注意起承转合的层次递进',
        '选择与主题契合的意象',
        '情感表达要含蓄深婉',
        '语言要精炼，字字珠玑',
        '注意押韵和平仄协调'
      ],
      rhyme: '建议选择与主题意境相符的韵部，如写壮阔景象可用ang韵，写婉约情感可用i韵',
      rhymeExamples: ['ang韵：长、阳、香、苍', 'i韵：时、思、知、枝'],
      keywordSuggestions: [
        { keyword: '意象', usage: '选择具有画面感的意象入诗' },
        { keyword: '情感', usage: '将情感融入景物描写中' },
        { keyword: '时空', usage: '注意时空的转换与呼应' }
      ],
      avoid: ['空泛口号式抒情', '意象堆砌无主线', '陈词滥调无新意'],
      advancedTips: [
        '运用虚实相生的手法，增强诗歌张力',
        '注意意象的层次感，远近高低错落有致',
        '善用对比和衬托，突出主题情感'
      ]
    };

    return res.json({ success: true, data: fallbackData });
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
    const { userLine, allLines, genre, theme, lineNumber } = req.body;

    if (!checkAIRateLimit(userId)) {
      return res.status(429).json({ success: false, message: '请求过于频繁' });
    }

    if (!userLine && !allLines) {
      return res.status(400).json({ success: false, message: '缺少诗句内容' });
    }

    const escapedLine = escapeString(userLine || '');
    const escapedGenre = escapeString(genre || '五言绝句');
    const escapedTheme = escapeString(theme || '一般主题');
    const lineLength = escapedGenre.includes('七') ? 7 : 5;
    const currentLineNum = lineNumber || 1;

    // 获取所有已创作的诗句
    let existingLinesText = '';
    if (allLines && Array.isArray(allLines) && allLines.length > 0) {
      existingLinesText = allLines.map((l, i) => `第${i + 1}句：${l}`).join('\n');
    } else if (escapedLine) {
      existingLinesText = `第${currentLineNum - 1}句：${escapedLine}`;
    }

    // 分析当前是第几句，决定创作策略
    const totalLines = escapedGenre.includes('律诗') ? 8 : 4;
    const position = currentLineNum;
    let positionRole = '';
    let positionHint = '';
    
    if (position === 1) {
      positionRole = '起句';
      positionHint = '开篇点题，交代时地背景，引出主题，为后续发展留有余地';
    } else if (position === 2) {
      positionRole = '承句';
      positionHint = '承接上文，展开描写，渲染氛围，深化主题';
    } else if (position === 3) {
      positionRole = '转句';
      positionHint = '转折变化，另辟蹊径，引入新意，打破平静';
    } else if (position >= 4 && position < totalLines) {
      positionRole = '续句';
      positionHint = '延续意境，层层推进，注意对仗工整';
    } else {
      positionRole = '合句';
      positionHint = '总结全诗，点明主旨，情感升华，余韵悠长';
    }

    const prompt = `你是一位精通中国古典诗词的专家，正在与用户进行接龙创作。

【创作信息】
- 体裁：${escapedGenre}（共${totalLines}句）
- 主题："${escapedTheme}"
- 当前位置：第${position}句（${positionRole}）
- 每句字数：${lineLength}字

【已创作的诗句】
${existingLinesText || '（这是第一句，由AI开篇）'}

【创作要求】
1. 字数要求：必须恰好${lineLength}个字
2. 内容要求：
   - ${positionHint}
   - 紧扣"${escapedTheme}"主题，与已创作内容形成有机整体
   - 意象要呼应前文，情感要层层推进
3. 韵律要求：
   - 分析前文的韵脚，保持韵律和谐
   - ${position === 1 ? '首句可入韵也可不入韵' : position === totalLines ? '末句必须押韵收束' : '偶数句押韵，注意平仄协调'}
4. 风格要求：
   - 语言典雅，意境深远
   - 避免与前文意象重复
   - ${position === 1 ? '开篇要新颖，吸引读者注意' : position === totalLines ? '结尾要有余韵，令人回味' : '承上启下，自然过渡'}

【输出格式】
请严格按以下JSON格式返回，不要添加任何其他文字：
{
  "aiLine": "AI生成的诗句（${lineLength}字）",
  "rhymeHint": "押韵说明（指出韵脚和韵部，10-15字）",
  "moodHint": "情感走向说明（10-15字）",
  "imageryUsed": "使用的意象（5-10字）"
}`;

    const result = await aiService.callAIGenerateJSON(prompt,
      '你是一位精通中国古典诗词的专家，擅长接龙创作。你的诗句总是意境优美、韵律和谐、与前文完美衔接。',
      { temperature: 0.85, maxTokens: 500 }
    );

    if (result && result.aiLine) {
      return res.json({
        success: true,
        data: {
          aiLine: result.aiLine,
          rhymeHint: result.rhymeHint || '',
          moodHint: result.moodHint || '',
          imageryUsed: result.imageryUsed || ''
        }
      });
    }

    return res.json({
      success: true,
      data: {
        aiLine: '春风送暖入屠苏',
        rhymeHint: '押u韵',
        moodHint: '温暖明快',
        imageryUsed: '春风、屠苏酒'
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

// ==================== AI润色接口 ====================

/**
 * AI润色诗词
 * POST /api/creation/polish
 */
router.post('/polish', optionalAuthenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { poem, genre, theme, type } = req.body;

    if (!checkAIRateLimit(userId)) {
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后重试' });
    }

    if (!poem) {
      return res.status(400).json({ success: false, message: '缺少诗词内容' });
    }

    const escapedPoem = escapeString(poem);
    const escapedGenre = escapeString(genre || '五言绝句');
    const escapedTheme = escapeString(theme || '一般主题');
    const polishType = type || 'optimize';

    const prompt = `你是一位精通中国古典诗词的润色专家。请对以下诗词进行润色优化。

【原诗】
${escapedPoem}

【体裁】${escapedGenre}
【主题】${escapedTheme}
【润色类型】${polishType === 'rewrite' ? '重新创作' : '优化润色'}

【润色要求】
1. 保持原诗的主题和情感基调不变
2. 优化用词，使语言更加精炼典雅
3. 调整韵律，使节奏更加和谐
4. 增强意境，使画面感更强
5. ${polishType === 'rewrite' ? '可以大幅修改，但保持主题一致' : '尽量保留原诗结构和主要意象'}

【输出格式】
请严格按以下JSON格式返回，不要添加任何其他文字：
{
  "poem": "润色后的诗词正文（每句一行）",
  "explanation": "润色说明（30-60字，说明主要修改了哪些地方，为什么这样修改）",
  "changes": [
    {"original": "原词/原句", "polished": "润色后的词/句", "reason": "修改理由（10-20字）"}
  ]
}`;

    const result = await aiService.callAIGenerateJSON(prompt,
      '你是一位精通中国古典诗词的润色专家，擅长优化诗词的用词、韵律和意境，同时保持原诗的风格和主题。',
      { temperature: 0.7, maxTokens: 1000 }
    );

    if (result && result.poem) {
      result.original = escapedPoem;
      return res.json({ success: true, data: result });
    }

    return res.json({
      success: true,
      data: {
        poem: escapedPoem,
        original: escapedPoem,
        explanation: 'AI润色服务暂时不可用，请稍后重试',
        changes: []
      }
    });
  } catch (error) {
    console.error('[creationRoutes] 润色失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

module.exports = router;
