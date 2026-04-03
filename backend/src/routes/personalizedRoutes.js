const express = require('express');
const router = express.Router();
const { getPersonalizedData, getReviewRecommendations, getLearnRecommendations } = require('../services/personalizedService');

/**
 * 带超时的Promise执行
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`操作超时（${ms / 1000}秒），请稍后重试`));
    }, ms);
    promise
      .then((data) => {
        clearTimeout(timer);
        resolve(data);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * 从请求中提取用户ID
 */
function extractUserId(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.userId;
  } catch (e) {
    return null;
  }
}

/**
 * 统一认证中间件
 */
function authMiddleware(req, res, next) {
  const userId = extractUserId(req);
  if (!userId) {
    return res.status(401).json({ message: '未登录，请先登录' });
  }
  req.userId = userId;
  next();
}

/**
 * GET /api/personalized
 * 获取完整的个性化推荐数据（需要认证）
 * 返回：{ review, learn, analysis }
 */
router.get('/', async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) {
    return res.status(401).json({ message: '未登录，请先登录' });
  }

  console.log('[personalizedRoutes] 收到个性化推荐请求，用户ID:', userId);

  try {
    const data = await withTimeout(getPersonalizedData(userId), 60000);
    console.log('[personalizedRoutes] 个性化数据获取成功');
    res.json(data);
  } catch (err) {
    console.error('[personalizedRoutes] 获取个性化数据失败:', err.message);
    
    res.json({
      review: [],
      learn: [],
      analysis: {
        strength: ['开始您的诗词学习之旅', '探索古诗词的魅力', '积累诗词知识'],
        weakness: ['暂无学习记录', '建议开始学习诗词', '可以尝试闯关模式'],
        suggestion: [
          '建议从基础诗词开始学习',
          '可以尝试诗词闯关，循序渐进提升',
          '收藏喜欢的诗词，建立个人诗库'
        ],
        summary: '欢迎���到古诗词学习系统，开始您的诗词之旅吧！',
        stats: {
          user_id: userId,
          total_learned: 0,
          average_score: 0,
          mastery_rate: 0,
          wrong_count: 0,
          total_recite_attempts: 0,
          top_dynasty: '未知',
          dynasty_distribution: {},
          typical_wrong_questions: [],
          challenge_correct_count: 0,
          challenge_total_count: 0
        }
      },
      _meta: {
        total_learned: 0,
        wrong_count: 0,
        has_data: false,
        error: err.message
      }
    });
  }
});

/**
 * GET /api/personalized/review
 * 获取复习推荐数据（独立接口，支持并行请求）
 */
router.get('/review', authMiddleware, async (req, res) => {
  console.log('[personalizedRoutes] 收到复习推荐请求，用户ID:', req.userId);
  
  try {
    const result = await withTimeout(getReviewRecommendations(req.userId), 30000);
    res.json(result);
  } catch (err) {
    console.error('[personalizedRoutes] 获取复习推荐失败:', err.message);
    res.json({
      success: false,
      data: [],
      error: err.message
    });
  }
});

/**
 * GET /api/personalized/learn
 * 获取学习推荐数据（独立接口，支持并行请求）
 */
router.get('/learn', authMiddleware, async (req, res) => {
  console.log('[personalizedRoutes] 收到学习推荐请求，用户ID:', req.userId);
  
  try {
    const result = await withTimeout(getLearnRecommendations(req.userId), 30000);
    res.json(result);
  } catch (err) {
    console.error('[personalizedRoutes] 获取学习推荐失败:', err.message);
    res.json({
      success: false,
      data: [],
      error: err.message
    });
  }
});

/**
 * GET /api/personalized/analysis
 * 获取AI学习分析报告（独立接口，支持并行请求）
 */
router.get('/analysis', authMiddleware, async (req, res) => {
  console.log('[personalizedRoutes] 收到AI分析请求，用户ID:', req.userId);
  
  try {
    const { generateAIAnalysisReport, getWrongQuestions, getChallengeRecords, getFeihuaRecords, getLearningRecords } = require('../services/personalizedService');
    
    const [wrongQuestions, challengeRecords, feihuaRecords, learningRecords] = await Promise.all([
      getWrongQuestions(req.userId).catch(() => []),
      getChallengeRecords(req.userId).catch(() => []),
      getFeihuaRecords(req.userId).catch(() => []),
      getLearningRecords(req.userId).catch(() => [])
    ]);
    
    const result = await withTimeout(
      generateAIAnalysisReport(req.userId, wrongQuestions, challengeRecords, feihuaRecords, learningRecords),
      45000
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('[personalizedRoutes] 获取AI分析失败:', err.message);
    res.json({
      success: false,
      data: {
        strength: ['开始您的诗词学习之旅', '探索古诗词的魅力', '积累诗词知识'],
        weakness: ['暂无学习记录', '建议开始学习诗词', '可以尝试闯关模式'],
        suggestion: ['建议从基础诗词开始学习', '可以尝试诗词闯关', '收藏喜欢的诗词'],
        summary: '欢迎来到古诗词学习系统！',
        stats: { user_id: req.userId, total_learned: 0, average_score: 0, mastery_rate: 0 }
      },
      error: err.message
    });
  }
});

module.exports = router;
