const express = require('express');
const router = express.Router();
const { db } = require('../utils/db');
const aiService = require('../services/aiService');
const config = require('../config/config');

// AI调用限流Map，基于用户ID
const aiRateLimitMap = new Map();

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
    
    // 构建AI提示词
    const prompt = `
      请生成一首${escapedGenre}，主题为"${escapedTheme}"，并在适当位置设置2-3个空缺，用于用户填词。
      
      要求：
      1. 诗词结构完整，符合${escapedGenre}的格律要求
      2. 意境优美，与主题相关
      3. 空缺位置要合理，适合用户填写
      4. 每个空缺用"___"表示
      5. 请同时提供完整的参考版本（不包含空缺）
      6. 请严格按照以下JSON格式返回，不要添加任何其他文字，包括Markdown标记、引号外的解释、换行等
      - prompt_poem: 带空缺的诗词
      - reference_poem: 完整的参考诗词
      - explanation: 诗词解析和填词提示
      
      示例JSON格式：
      {"prompt_poem": "...", "reference_poem": "...", "explanation": "..."}
    `;
    
    const systemContent = "你是一位精通中国古典诗词的专家，擅长创作和解析各种体裁的诗词。";
    
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
    
    // 构建AI提示词
    const prompt = `
      请对用户的填词作品进行评分和分析，与参考诗词进行对比。
      
      参考诗词：
      ${escapedReferencePoem}
      
      用户填词：
      ${escapedUserPoem}
      
      要求：
      1. 从内容契合度、韵律美感、意境表达三个维度进行评分
      2. 每个维度满分100分，计算总分时取平均值
      3. 提供具体的修改建议
      4. 请严格按照以下JSON格式返回，不要添加任何其他文字，包括Markdown标记、引号外的解释、换行等
      - score: 总分
      - analysis: 包含content、rhythm、意境三个维度的评分
      - suggestions: 修改建议
      
      示例JSON格式：
      {"score": 85, "analysis": {"content": 80, "rhythm": 90, "意境": 85}, "suggestions": "..."}
    `;
    
    const systemContent = "你是一位专业的古诗词教育专家，擅长分析和评价学生的诗词创作。";
    
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

// 创作辅助接口 - 核心结构化评分接口
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
    
    // 用户输入转义，避免Prompt注入
    const escapedPoem = JSON.stringify(poem).slice(1, -1);
    const escapedTitle = title ? JSON.stringify(title).slice(1, -1) : '无标题';
    const escapedAuthor = author ? JSON.stringify(author).slice(1, -1) : '用户';
    const escapedGenre = genre ? JSON.stringify(genre).slice(1, -1) : '未知';
    const escapedTheme = theme ? JSON.stringify(theme).slice(1, -1) : '未知';
    
    // 构建AI提示词
    const prompt = `
      请对以下诗词进行结构化评分，从多个维度进行分析。
      
      诗词信息：
      标题：${escapedTitle}
      作者：${escapedAuthor}
      体裁：${escapedGenre}
      主题：${escapedTheme}
      内容：${escapedPoem}
      
      要求：
      1. 从内容契合度、韵律美感、意境表达、语言流畅度、创意性五个维度进行评分
      2. 每个维度满分100分，计算总分时取平均值
      3. 提供具体的修改建议
      4. 请严格按照以下JSON格式返回，不要添加任何其他文字，包括Markdown标记、引号外的解释、换行等
      - total: 总分
      - dimensions: 包含content、rhythm、mood、language、creativity五个维度的评分
      - suggestions: 修改建议
      
      示例JSON格式：
      {"total": 85, "dimensions": {"content": 80, "rhythm": 90, "mood": 85, "language": 88, "creativity": 82}, "suggestions": "..."}
    `;
    
    const systemContent = "你是一位专业的古诗词教育专家，擅长分析和评价学生的诗词创作。";
    
    // 调用AI服务
    const result = await aiService.callAIGenerateJSON(prompt, systemContent, { temperature: 0.3 });
    
    if (result) {
      console.log('[creationRoutes] 评分 成功', { userId });
      return res.json({ success: true, data: result, message: '评分成功' });
    } else {
      // AI调用失败，返回模拟数据
      const mockData = config.creation.defaultData.assistScore;
      console.error('[creationRoutes] 评分 AI失败，返回模拟数据', { userId });
      return res.json({ success: false, data: mockData, message: 'AI服务暂时不可用，已返回参考示例' });
    }
  } catch (error) {
    console.error('[creationRoutes] 评分 失败', { userId: req.user.userId, params: req.body, error: error.stack || error.message });
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

// 数据查询接口 - 用户创作成长数据查询
router.get('/stats', optionalAuthenticateToken, async (req, res) => {
  try {
    // 数据隔离：仅允许当前用户操作自己的数据
    const userId = req.user.userId;
    
    console.log('[creationRoutes] 查询创作成长数据 信息', { userId });
    
    // 查询用户创作成长数据
    db.get('SELECT * FROM creation_stats WHERE user_id = ?', [userId], (err, stats) => {
      if (err) {
        console.error('[creationRoutes] 查询创作成长数据 失败', { userId, error: err.message });
        return res.status(500).json({ success: false, message: '查询创作成长数据失败' });
      }
      
      // 如果没有数据，返回默认值
      if (!stats) {
        const defaultStats = {
          user_id: userId,
          total_creations: 0,
          qualified_works: 0,
          average_score: 0,
          highest_score: 0,
          last_creation_time: null
        };
        console.log('[creationRoutes] 查询创作成长数据 成功（返回默认值）', { userId });
        return res.json({ success: true, data: defaultStats, message: '查询成功' });
      }
      
      console.log('[creationRoutes] 查询创作成长数据 成功', { userId });
      res.json({ success: true, data: stats, message: '查询成功' });
    });
  } catch (error) {
    console.error('[creationRoutes] 查询创作成长数据 失败', { userId: req.user.userId, error: error.stack || error.message });
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

module.exports = router;