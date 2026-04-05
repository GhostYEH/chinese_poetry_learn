// 诗词创作挑战API路由
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const poetryChallengeService = require('../services/poetryChallengeService');

// 获取主题列表
router.get('/themes', async (req, res) => {
  try {
    const themes = poetryChallengeService.getThemes();
    res.json({ success: true, data: themes });
  } catch (error) {
    console.error('获取主题列表失败:', error);
    res.status(500).json({ message: '获取主题列表失败' });
  }
});

// 生成创作挑战
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { theme, keyword } = req.body;
    
    if (!theme) {
      return res.status(400).json({ message: '请选择主题' });
    }
    
    const result = await poetryChallengeService.generateChallenge(userId, theme, keyword);
    res.json(result);
  } catch (error) {
    console.error('生成创作挑战失败:', error);
    res.status(500).json({ message: '生成创作挑战失败' });
  }
});

// 对AI诗词评分
router.post('/rate', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { challengeId, score } = req.body;
    
    if (!challengeId || score === undefined) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    if (score < 1 || score > 10) {
      return res.status(400).json({ message: '评分应在1-10之间' });
    }
    
    const result = await poetryChallengeService.ratePoem(userId, challengeId, score);
    res.json(result);
  } catch (error) {
    console.error('评分失败:', error);
    res.status(500).json({ message: '评分失败' });
  }
});

// 获取挑战历史
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const limit = parseInt(req.query.limit) || 20;
    const history = await poetryChallengeService.getChallengeHistory(userId, limit);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('获取挑战历史失败:', error);
    res.status(500).json({ message: '获取挑战历史失败' });
  }
});

// 获取挑战统计
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const stats = await poetryChallengeService.getChallengeStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取挑战统计失败:', error);
    res.status(500).json({ message: '获取挑战统计失败' });
  }
});

module.exports = router;
