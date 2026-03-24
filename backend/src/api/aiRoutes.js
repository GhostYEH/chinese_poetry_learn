const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const crypto = require('crypto');
const axios = require('axios');

// 加载环境变量
require('dotenv').config();

// 图像生成相关缓存和任务管理
const imageCache = new Map();
const generationTasks = new Map();
const userRateLimits = new Map();
const MAX_REQUESTS_PER_MINUTE = 5;

// 服务端缓存（使用内存Map作为默认缓存，支持Redis降级）
let charInfoCache = new Map();
let redisClient = null;

// 尝试连接Redis
function initRedis() {
  try {
    const redis = require('redis');
    redisClient = redis.createClient();
    redisClient.on('error', (err) => {
      console.error('Redis连接失败，降级为内存缓存:', err.message);
      redisClient = null;
    });
    redisClient.connect().catch(err => {
      console.error('Redis连接失败，降级为内存缓存:', err.message);
      redisClient = null;
    });
  } catch (error) {
    console.error('Redis模块加载失败，使用内存缓存:', error.message);
  }
}

// 初始化Redis连接
initRedis();

// 生成缓存key
function generateCacheKey(prompt) {
  return crypto.createHash('md5').update(prompt).digest('hex');
}

// 获取缓存
async function getCache(key) {
  if (redisClient) {
    try {
      const value = await redisClient.get(key);
      if (value) {
        return JSON.parse(value);
      }
    } catch (error) {
      console.error('Redis获取缓存失败:', error.message);
    }
  }
  return charInfoCache.get(key);
}

// 设置缓存
async function setCache(key, value) {
  const data = JSON.stringify(value);
  if (redisClient) {
    try {
      await redisClient.set(key, data, { EX: 7 * 24 * 60 * 60 }); // 7天过期
      return;
    } catch (error) {
      console.error('Redis设置缓存失败:', error.message);
    }
  }
  // 内存缓存
  charInfoCache.set(key, value);
  // 限制内存缓存大小
  if (charInfoCache.size > 1000) {
    // 删除最早的缓存
    const firstKey = charInfoCache.keys().next().value;
    charInfoCache.delete(firstKey);
  }
}

// AI 诗词讲解接口 - 生活化诗意解释
router.post('/explainPoem/daily_life_explanation', async (req, res) => {
  await aiService.handleAIExplanation(req, res, 'daily_life_explanation');
});

// AI 诗词讲解接口 - 关键词深度解析
router.post('/explainPoem/keyword_analysis', async (req, res) => {
  await aiService.handleAIExplanation(req, res, 'keyword_analysis');
});

// AI 诗词讲解接口 - 意境赏析
router.post('/explainPoem/artistic_conception', async (req, res) => {
  await aiService.handleAIExplanation(req, res, 'artistic_conception');
});

// AI 诗词讲解接口 - 引导性思考题
router.post('/explainPoem/thinking_questions', async (req, res) => {
  await aiService.handleAIExplanation(req, res, 'thinking_questions');
});

// AI 诗词讲解接口 - 完整讲解（保留原接口）
router.post('/explainPoem', async (req, res) => {
  await aiService.handleAIExplanation(req, res, '');
});

// AI 诗词讲解接口 - 批量获取所有讲解类型（优化性能）
router.post('/explainPoem/batch', async (req, res) => {
  try {
    const { poem, title, author } = req.body;
    
    if (!poem) {
      return res.status(400).json({ message: '缺少诗词内容' });
    }
    
    console.log('接收到批量AI讲解请求:', {
      title: title || '无标题',
      author: author || '无作者',
      poemLength: poem.length
    });
    
    // 并行处理所有讲解类型
    const [dailyLifeResult, keywordResult, artisticResult, questionsResult] = await Promise.all([
      aiService.getAIExplanation(poem, title, author, 'daily_life_explanation'),
      aiService.getAIExplanation(poem, title, author, 'keyword_analysis'),
      aiService.getAIExplanation(poem, title, author, 'artistic_conception'),
      aiService.getAIExplanation(poem, title, author, 'thinking_questions')
    ]);
    
    // 合并结果
    const batchResult = {
      daily_life_explanation: dailyLifeResult.daily_life_explanation,
      keyword_analysis: keywordResult.keyword_analysis,
      artistic_conception: artisticResult.artistic_conception,
      thinking_questions: questionsResult.thinking_questions
    };
    
    res.json(batchResult);
  } catch (error) {
    console.error('批量获取AI讲解失败:', error);
    res.status(500).json({ message: '获取AI讲解失败' });
  }
});

// AI 背诵检测接口
const authenticateToken = require('../middleware/auth');

// 自定义认证中间件，允许无认证时使用默认用户
function optionalAuthenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = 'your-secret-key';
      
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
          // 令牌无效，使用默认用户
          req.user = { userId: 1, username: 'default' };
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
      req.user = { userId: 1, username: 'default' };
      next();
    }
  } catch (error) {
    console.error('认证失败:', error);
    // 认证失败，使用默认用户
    req.user = { userId: 1, username: 'default' };
    next();
  }
}

router.post('/recite-check', optionalAuthenticateToken, async (req, res) => {
  try {
    const { original, input, poem_id, poem_title, poem_author } = req.body;
    
    console.log('接收到背诵检测请求:', {
      original: original ? original.substring(0, 50) + (original.length > 50 ? '...' : '') : 'null',
      input: input ? input.substring(0, 50) + (input.length > 50 ? '...' : '') : 'null',
      poem_id: poem_id,
      poem_title: poem_title
    });
    
    if (!original || !input) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    // 第一层：程序比对（作为基础）
    const programResult = aiService.checkRecitation(original, input);
    
    // 第二层：AI 智能判断
    let aiResult = null;
    try {
      // 获取学生的学习记录
      let learningRecord = null;
      if (poem_id) {
        const learningService = require('../services/learningService');
        // 从请求中获取用户ID（如果有认证）
        const userId = req.user ? req.user.userId : 1; // 默认用户ID为1
        learningRecord = await learningService.getLearningRecord(userId, poem_id);
      }
      
      aiResult = await aiService.getAIRecitationCheck(original, input, poem_title, poem_author, learningRecord);
      console.log('AI 背诵检测结果:', aiResult);
    } catch (aiError) {
      console.error('AI 背诵检测失败:', aiError);
      // AI 失败时使用程序结果
      const aiService = require('../services/aiService');
      aiResult = aiService.getMockRecitationCheck(original, input, learningRecord);
    }
    
    // 合并结果
    const result = {
      score: aiResult.score || programResult.score,
      wrongChars: aiResult.wrongChars || programResult.wrongChars,
      missing: aiResult.missing || programResult.missing,
      extra: aiResult.extra || programResult.extra,
      aiAdvice: aiResult.aiAdvice || 'AI 反馈生成失败，仅返回程序检测结果'
    };
    
    // 处理错题逻辑
    if (poem_id && result.score < 90) {
      const mistakesService = require('../services/mistakesService');
      mistakesService.addMistake(
        poem_id,
        result.score,
        poem_title || '未知',
        poem_author || '未知',
        original,
        input
      );
    }
    
    // 记录学习行为（包括背诵检测）
    if (poem_id) {
      const learningService = require('../services/learningService');
      // 从请求中获取用户ID（如果有认证）
      const userId = req.user ? req.user.userId : 1; // 默认用户ID为1
      learningService.recordLearningAction(userId, poem_id, 'recite', result.score);
    }
    
    res.json(result);
  } catch (error) {
    console.error('处理背诵检测请求失败:', error);
    res.status(500).json({ message: '处理请求失败' });
  }
});

// AI 对话式助教接口（支持连续追问）
router.post('/tutor', async (req, res) => {
  try {
    const { poem, title, author, question, history = [] } = req.body;
    
    console.log('接收到AI助教请求:', {
      hasPoem: !!poem,
      hasTitle: !!title,
      hasAuthor: !!author,
      hasQuestion: !!question,
      historyLength: history.length
    });
    
    if (!poem || !question) {
      return res.status(400).json({ message: '缺少诗词内容或问题' });
    }
    
    const response = await aiService.getAIResponse(poem, title, author, question, history);
    
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('处理AI助教请求失败:', error);
    res.status(500).json({ message: '处理AI助教请求失败' });
  }
});

// AI 按维度解释接口
router.post('/explain/dimension', async (req, res) => {
  try {
    const { poem, title, author, dimension } = req.body;
    
    console.log('接收到按维度解释请求:', {
      hasPoem: !!poem,
      hasTitle: !!title,
      hasAuthor: !!author,
      dimension
    });
    
    if (!poem || !dimension) {
      return res.status(400).json({ message: '缺少诗词内容或维度' });
    }
    
    const validDimensions = ['情感', '意象', '写法', '结构', '考点', '背诵技巧'];
    if (!validDimensions.includes(dimension)) {
      return res.status(400).json({ message: '无效的维度' });
    }
    
    const response = await aiService.getDimensionExplanation(poem, title, author, dimension);
    
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('处理按维度解释请求失败:', error);
    res.status(500).json({ message: '处理按维度解释请求失败' });
  }
});

// AI 学习建议接口
router.post('/advice', async (req, res) => {
  try {
    const { poem, title, author } = req.body;
    
    console.log('接收到学习建议请求:', {
      hasPoem: !!poem,
      hasTitle: !!title,
      hasAuthor: !!author
    });
    
    if (!poem) {
      return res.status(400).json({ message: '缺少诗词内容' });
    }
    
    const response = await aiService.getLearningAdvice(poem, title, author);
    
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('处理学习建议请求失败:', error);
    res.status(500).json({ message: '处理学习建议请求失败' });
  }
});

// AI 简化解释接口
router.post('/simplify', async (req, res) => {
  try {
    const { poem, title, author, originalExplanation } = req.body;
    
    console.log('接收到简化解释请求:', {
      hasPoem: !!poem,
      hasTitle: !!title,
      hasAuthor: !!author,
      hasOriginalExplanation: !!originalExplanation
    });
    
    if (!poem || !originalExplanation) {
      return res.status(400).json({ message: '缺少诗词内容或原解释' });
    }
    
    const response = await aiService.getSimplifiedExplanation(poem, title, author, originalExplanation);
    
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('处理简化解释请求失败:', error);
    res.status(500).json({ message: '处理简化解释请求失败' });
  }
});

// AI 改写诗意接口
router.post('/rewrite', async (req, res) => {
  try {
    const { poem, title, author } = req.body;
    
    if (!poem) {
      return res.status(400).json({ message: '缺少诗词内容' });
    }
    
    console.log('接收到AI改写诗意请求:', {
      title: title || '无标题',
      author: author || '无作者',
      poemLength: poem.length
    });
    
    const result = await aiService.getAIrewritePoem(poem, title, author);
    
    res.json(result);
  } catch (error) {
    console.error('处理AI改写诗意请求失败:', error);
    res.status(500).json({ message: '处理请求失败' });
  }
});

// AI 字符信息接口
router.post('/char-info', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ message: '缺少prompt参数' });
    }
    
    // 生成缓存key
    const cacheKey = generateCacheKey(prompt);
    
    // 尝试从缓存获取
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      console.log('字符信息请求命中缓存');
      return res.json({ content: cachedData });
    }
    
    console.log('接收到字符信息请求:', { prompt });
    
    // 调用AI服务获取字符信息
    const response = await aiService.getCharInfo(prompt);
    
    // 存入缓存
    await setCache(cacheKey, response);
    
    res.json({ content: response });
  } catch (error) {
    console.error('处理字符信息请求失败:', error);
    res.status(500).json({ message: '处理请求失败' });
  }
});

// AI 字符信息批量接口
router.post('/char-info/batch', async (req, res) => {
  try {
    const { poem, title, author } = req.body;
    
    if (!poem || !title || !author) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    console.log('接收到字符信息批量请求:', { title, author, poemLength: poem.length });
    
    // 提取诗词中的所有不重复汉字
    const chars = new Set();
    const lines = poem.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      for (const char of line) {
        // 只保留中文字符
        if (char >= '\u4e00' && char <= '\u9fff') {
          chars.add(char);
        }
      }
    }
    
    const charArray = Array.from(chars);
    console.log('提取到的汉字数量:', charArray.length);
    
    // 批量处理字符信息
    const results = {};
    const batchSize = 5; // 控制并发数
    
    for (let i = 0; i < charArray.length; i += batchSize) {
      const batchChars = charArray.slice(i, i + batchSize);
      const batchPromises = batchChars.map(async (char) => {
        // 构建prompt
        let currentLine = '';
        for (const line of lines) {
          if (line.includes(char)) {
            currentLine = line;
            break;
          }
        }
        const prompt = `${title}中的"${currentLine}"句中的"${char}"字的读音和释义`;
        
        // 生成缓存key
        const cacheKey = generateCacheKey(prompt);
        
        // 尝试从缓存获取
        let cachedData = await getCache(cacheKey);
        
        if (!cachedData) {
          // 调用AI服务获取字符信息
          cachedData = await aiService.getCharInfo(prompt);
          // 存入缓存
          await setCache(cacheKey, cachedData);
        }
        
        results[char] = cachedData;
      });
      
      // 等待当前批次完成
      await Promise.all(batchPromises);
    }
    
    res.json({ results });
  } catch (error) {
    console.error('处理字符信息批量请求失败:', error);
    res.status(500).json({ message: '处理请求失败' });
  }
});

// 图像生成相关功能

// 检查速率限制
function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = userRateLimits.get(userId) || { count: 0, lastReset: now };
  
  if (now - userLimit.lastReset > 60000) {
    userRateLimits.set(userId, { count: 1, lastReset: now });
    return true;
  }
  
  if (userLimit.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  userLimit.count++;
  userRateLimits.set(userId, userLimit);
  return true;
}

// 生成缓存键
function generateImageCacheKey(poemId, title, author) {
  return crypto.createHash('md5').update(`${poemId}_${title}_${author}`).digest('hex');
}

// 生成图像
async function generateImage(poemId, title, author, content, socket) {
  const cacheKey = generateImageCacheKey(poemId, title, author);
  
  // 检查缓存
  if (imageCache.has(cacheKey)) {
    const cached = imageCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 30 * 24 * 60 * 60 * 1000) {
      socket.emit('image-generate-success', {
        poemId,
        url: cached.url
      });
      return cached.url;
    }
  }
  
  // 检查是否已有任务在进行
  if (generationTasks.has(cacheKey)) {
    socket.emit('image-generate-pending', {
      poemId
    });
    return null;
  }
  
  // 标记任务为进行中
  generationTasks.set(cacheKey, true);
  socket.emit('image-generate-pending', {
    poemId
  });
  
  try {
    const SILICON_FLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
    
    // 检查API密钥是否配置
    if (!SILICON_FLOW_API_KEY || SILICON_FLOW_API_KEY === 'your-siliconflow-api-key-here') {
      console.error('硅基流动API密钥未配置，请在backend/.env文件中设置SILICONFLOW_API_KEY');
      socket.emit('image-generate-fail', {
        poemId,
        error: 'API密钥未配置，请联系管理员配置SILICONFLOW_API_KEY'
      });
      return null;
    }
    
    const prompt = `根据古诗词《${title}》（作者：${author}）的内容生成一幅中国风图像，画面要准确描绘诗中所描述的场景和意境，${content}，中国传统风格，高清细腻，氛围感强，无任何文字、无水印、无logo，画面干净统一，适合做网页背景图`;
    
    console.log('生成图像的prompt:', prompt);
    console.log('使用API密钥:', SILICON_FLOW_API_KEY.substring(0, 10) + '...');
    
    const response = await axios.post('https://api.siliconflow.cn/v1/images/generations', {
      model: 'Kwai-Kolors/Kolors',
      prompt,
      image_size: '1440x720',
      batch_size: 1,
      num_inference_steps: 20,
      guidance_scale: 7.5
    }, {
      headers: {
        'Authorization': `Bearer ${SILICON_FLOW_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('API响应:', response.data);
    
    if (response.data && response.data.images && response.data.images[0]) {
      let imageData = response.data.images[0];
      let imageUrl;
      
      // 检查返回的数据类型
      if (typeof imageData === 'object' && imageData !== null) {
        // API返回的是对象，可能包含URL或Base64数据
        console.log('API返回对象结构:', JSON.stringify(imageData));
        
        if (imageData.url) {
          // 返回的是URL
          imageUrl = imageData.url;
          console.log('使用API返回的URL:', imageUrl);
        } else if (imageData.data) {
          // 返回的是Base64数据
          imageUrl = `data:image/png;base64,${imageData.data}`;
          console.log('使用API返回的Base64数据');
        } else if (imageData.base64) {
          // 返回的是Base64数据（另一种字段名）
          imageUrl = `data:image/png;base64,${imageData.base64}`;
          console.log('使用API返回的Base64数据');
        } else {
          console.error('无法识别的图片数据格式:', imageData);
          throw new Error('API返回的图片数据格式不正确');
        }
      } else if (typeof imageData === 'string') {
        // 直接返回字符串，可能是URL或Base64
        if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
          // 是URL
          imageUrl = imageData;
          console.log('使用API返回的URL:', imageUrl);
        } else {
          // 假设是Base64数据
          imageUrl = `data:image/png;base64,${imageData}`;
          console.log('使用API返回的Base64数据');
        }
      } else {
        console.error('无法识别的图片数据类型:', typeof imageData);
        throw new Error('API返回的图片数据类型不正确');
      }
      
      // 缓存结果
      imageCache.set(cacheKey, {
        url: imageUrl,
        timestamp: Date.now()
      });
      
      socket.emit('image-generate-success', {
        poemId,
        url: imageUrl
      });
      
      return imageUrl;
    } else {
      throw new Error('API返回格式错误');
    }
  } catch (error) {
    console.error('图像生成失败:', error);
    socket.emit('image-generate-fail', {
      poemId,
      error: error.message
    });
    return null;
  } finally {
    generationTasks.delete(cacheKey);
  }
}

// 预生成图像接口
router.post('/image/pregenerate', async (req, res) => {
  try {
    const { poemId, title, author, content, userId = 'default' } = req.body;
    
    if (!poemId || !title || !author || !content) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    // 检查速率限制
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ message: '请求过于频繁，请稍后再试' });
    }
    
    // 使用全局io实例
    if (!global.io) {
      return res.status(500).json({ message: 'Socket连接未初始化' });
    }
    
    const socket = global.io;
    
    // 异步生成图像
    generateImage(poemId, title, author, content, socket);
    
    res.json({ success: true, message: '预生成任务已启动' });
  } catch (error) {
    console.error('预生成图像失败:', error);
    res.status(500).json({ message: '预生成失败' });
  }
});

// 获取缓存图像接口
router.post('/image/get', async (req, res) => {
  try {
    const { poemId, title, author } = req.body;
    
    if (!poemId || !title || !author) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    const cacheKey = generateImageCacheKey(poemId, title, author);
    
    if (imageCache.has(cacheKey)) {
      const cached = imageCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30 * 24 * 60 * 60 * 1000) {
        return res.json({ success: true, url: cached.url });
      }
    }
    
    res.json({ success: false, message: '缓存未命中' });
  } catch (error) {
    console.error('获取缓存图像失败:', error);
    res.status(500).json({ message: '获取失败' });
  }
});

// 轮播图生成接口
router.post('/image/carousel', async (req, res) => {
  try {
    const { poemId, title, author, content, userId = 'default' } = req.body;
    
    if (!poemId || !title || !author || !content) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    // 检查速率限制
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ message: '请求过于频繁，请稍后再试' });
    }
    
    // 使用全局io实例
    if (!global.io) {
      return res.status(500).json({ message: 'Socket连接未初始化' });
    }
    
    const socket = global.io;
    
    // 生成不同风格的图像
    const styleVariations = [
      '水墨画风格',
      '工笔画风格',
      '青绿山水画风格',
      '浅绛山水画风格'
    ];
    
    const randomStyle = styleVariations[Math.floor(Math.random() * styleVariations.length)];
    const prompt = `根据古诗词《${title}》（作者：${author}）的内容生成一幅${randomStyle}的中国风图像，画面要准确描绘诗中所描述的场景和意境，${content}，中国传统风格，高清细腻，氛围感强，无任何文字、无水印、无logo，画面干净统一，适合做网页背景图`;
    
    const SILICON_FLOW_API_KEY = process.env.SILICONFLOW_API_KEY || 'YOUR-API-KEY';
    
    console.log('轮播图生成的prompt:', prompt);
    
    const response = await axios.post('https://api.siliconflow.cn/v1/images/generations', {
      model: 'Kwai-Kolors/Kolors',
      prompt,
      image_size: '1440x720',
      batch_size: 1,
      num_inference_steps: 20,
      guidance_scale: 7.5
    }, {
      headers: {
        'Authorization': `Bearer ${SILICON_FLOW_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('轮播图API响应:', response.data);
    
    if (response.data && response.data.images && response.data.images[0]) {
      let base64Image = response.data.images[0];
      // 检查base64Image的类型，如果是对象，尝试提取其中的base64字符串
      if (typeof base64Image === 'object' && base64Image !== null) {
        // 尝试不同的可能字段名
        if (base64Image.data) {
          base64Image = base64Image.data;
        } else if (base64Image.base64) {
          base64Image = base64Image.base64;
        } else {
          // 将对象转换为字符串，看看具体结构
          console.log('base64Image对象结构:', JSON.stringify(base64Image));
          throw new Error('API返回的图片数据格式不正确');
        }
      }
      // 确保base64Image是字符串
      if (typeof base64Image !== 'string') {
        console.error('base64Image不是字符串:', typeof base64Image);
        throw new Error('API返回的图片数据不是字符串');
      }
      // 将base64转换为数据URL
      const imageUrl = `data:image/png;base64,${base64Image}`;
      
      socket.emit('image-generate-success', {
        poemId,
        url: imageUrl,
        isCarousel: true
      });
      
      res.json({ success: true, url: imageUrl });
    } else {
      throw new Error('API返回格式错误');
    }
  } catch (error) {
    console.error('轮播图生成失败:', error);
    res.status(500).json({ message: '生成失败' });
  }
});

module.exports = router;