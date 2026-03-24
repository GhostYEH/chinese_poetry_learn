// 学习记录相关的API路由
const express = require('express');
const router = express.Router();
const learningService = require('../services/learningService');
const authenticateToken = require('../middleware/auth');

// 记录学习行为接口
router.post('/record', authenticateToken, (req, res) => {
  try {
    const { poem_id, action, score } = req.body;
    const { userId } = req.user;
    
    console.log('接收到学习记录请求:', { userId, poem_id, action, score });
    
    if (!poem_id || !action) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    const validActions = ['view', 'ai_explain', 'recite', 'study_time'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ message: '无效的行为类型' });
    }
    
    const record = learningService.recordLearningAction(userId, poem_id, action, score);
    
    console.log('学习记录创建/更新成功:', record);
    
    res.json({
      success: true,
      message: '学习行为记录成功',
      data: record
    });
  } catch (error) {
    console.error('记录学习行为失败:', error);
    res.status(500).json({ message: '记录学习行为失败' });
  }
});

// 获取学习统计接口
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const stats = await learningService.getLearningStats(userId);
    
    // 按最近查看时间排序
    const sortedStats = stats.sort((a, b) => {
      if (!a.last_view_time) return 1;
      if (!b.last_view_time) return -1;
      return new Date(b.last_view_time) - new Date(a.last_view_time);
    });
    
    res.json({
      success: true,
      data: sortedStats,
      total_learned: sortedStats.length
    });
  } catch (error) {
    console.error('获取学习统计失败:', error);
    res.status(500).json({ message: '获取学习统计失败' });
  }
});

// 获取单首诗的学习记录
router.get('/record/:poemId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const poemId = parseInt(req.params.poemId);
    const record = await learningService.getLearningRecord(userId, poemId);
    
    if (record) {
      res.json({
        success: true,
        data: record
      });
    } else {
      res.status(404).json({ message: '学习记录未找到' });
    }
  } catch (error) {
    console.error('获取学习记录失败:', error);
    res.status(500).json({ message: '获取学习记录失败' });
  }
});

// 获取学习仪表盘数据
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const dashboardData = await learningService.getLearningDashboard(userId);
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('获取学习仪表盘数据失败:', error);
    res.status(500).json({ message: '获取学习仪表盘数据失败' });
  }
});

// 导出router
module.exports = {
  router,
  initLearningRecords: learningService.initLearningRecords
};
