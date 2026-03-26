// 每日打卡与活动API路由
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const dailyService = require('../services/dailyService');

// 获取今日推荐诗词
router.get('/daily-poem', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const result = await dailyService.getDailyPoem(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取每日推荐失败:', error);
    res.status(500).json({ message: '获取每日推荐失败' });
  }
});

// 获取每日推荐（不登录也可获取）
router.get('/daily-poem/public', async (req, res) => {
  try {
    const result = await dailyService.getDailyPoem(null);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取每日推荐失败:', error);
    res.status(500).json({ message: '获取每日推荐失败' });
  }
});

// 每日打卡
router.post('/checkin', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { poemId } = req.body;
    const result = await dailyService.checkIn(userId, poemId || null);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('打卡失败:', error);
    res.status(500).json({ message: '打卡失败' });
  }
});

// 获取打卡状态
router.get('/checkin/status', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const stats = await dailyService.getCheckInStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取打卡状态失败:', error);
    res.status(500).json({ message: '获取打卡状态失败' });
  }
});

// 获取打卡统计
router.get('/checkin/stats', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const stats = await dailyService.getCheckInStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取打卡统计失败:', error);
    res.status(500).json({ message: '获取打卡统计失败' });
  }
});

// 获取活动历史
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const days = parseInt(req.query.days) || 30;
    const history = await dailyService.getActivityHistory(userId, days);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('获取活动历史失败:', error);
    res.status(500).json({ message: '获取活动历史失败' });
  }
});

module.exports = router;
