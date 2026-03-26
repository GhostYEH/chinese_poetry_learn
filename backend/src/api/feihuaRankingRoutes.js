// 飞花令排位赛API路由
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const feihuaRankingService = require('../services/feihuaRankingService');

// 获取当前用户排位信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const info = await feihuaRankingService.getRankingInfo(userId);
    const rankInfo = await feihuaRankingService.getUserRank(userId);
    res.json({ 
      success: true, 
      data: { 
        ...info, 
        rank: rankInfo.rank 
      } 
    });
  } catch (error) {
    console.error('获取排位信息失败:', error);
    res.status(500).json({ message: '获取排位信息失败' });
  }
});

// 获取排行榜
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const leaderboard = await feihuaRankingService.getLeaderboard(limit, page);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    console.error('获取排行榜失败:', error);
    res.status(500).json({ message: '获取排行榜失败' });
  }
});

// 获取排位统计数据
router.get('/stats', async (req, res) => {
  try {
    const stats = await feihuaRankingService.getRankingStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取排位统计失败:', error);
    res.status(500).json({ message: '获取排位统计失败' });
  }
});

// 获取段位列表
router.get('/levels', async (req, res) => {
  try {
    res.json({ success: true, data: feihuaRankingService.RANK_LEVELS });
  } catch (error) {
    console.error('获取段位列表失败:', error);
    res.status(500).json({ message: '获取段位列表失败' });
  }
});

module.exports = router;
