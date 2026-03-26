// 教师分析API路由
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const teacherAnalyticsService = require('../services/teacherAnalyticsService');

// 获取班级薄弱点分析
router.get('/class/:classId/weak-points', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.userId;
    const { classId } = req.params;
    const weakPoints = await teacherAnalyticsService.getClassWeakPoints(classId, teacherId);
    res.json({ success: true, data: weakPoints });
  } catch (error) {
    console.error('获取薄弱点分析失败:', error);
    res.status(500).json({ message: '获取薄弱点分析失败' });
  }
});

// 获取学生预警列表
router.get('/class/:classId/alerts', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.userId;
    const { classId } = req.params;
    const alerts = await teacherAnalyticsService.getStudentAlerts(classId, teacherId);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error('获取学生预警失败:', error);
    res.status(500).json({ message: '获取学生预警失败' });
  }
});

// 创建任务
router.post('/tasks', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.userId;
    const { class_id, target_user_id, title, content, task_type, level_start, level_end, deadline } = req.body;
    
    if (!title) {
      return res.status(400).json({ message: '请输入任务标题' });
    }
    
    const result = await teacherAnalyticsService.createTask(teacherId, {
      class_id, target_user_id, title, content, task_type, level_start, level_end, deadline
    });
    res.json(result);
  } catch (error) {
    console.error('创建任务失败:', error);
    res.status(500).json({ message: '创建任务失败' });
  }
});

// 获取班级任务列表
router.get('/class/:classId/tasks', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.userId;
    const { classId } = req.params;
    const tasks = await teacherAnalyticsService.getClassTasks(classId, teacherId);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({ message: '获取任务列表失败' });
  }
});

// 获取班级学习趋势
router.get('/class/:classId/trend', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.userId;
    const { classId } = req.params;
    const days = parseInt(req.query.days) || 30;
    const trend = await teacherAnalyticsService.getClassLearningTrend(classId, teacherId, days);
    res.json({ success: true, data: trend });
  } catch (error) {
    console.error('获取学习趋势失败:', error);
    res.status(500).json({ message: '获取学习趋势失败' });
  }
});

// 获取班级诗词掌握情况
router.get('/class/:classId/mastery', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.userId;
    const { classId } = req.params;
    const mastery = await teacherAnalyticsService.getClassPoemMastery(classId, teacherId);
    res.json({ success: true, data: mastery });
  } catch (error) {
    console.error('获取诗词掌握情况失败:', error);
    res.status(500).json({ message: '获取诗词掌握情况失败' });
  }
});

// 获取班级概览
router.get('/class/:classId/overview', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.userId;
    const { classId } = req.params;
    const overview = await teacherAnalyticsService.getClassOverview(classId, teacherId);
    res.json({ success: true, data: overview });
  } catch (error) {
    console.error('获取班级概览失败:', error);
    res.status(500).json({ message: '获取班级概览失败' });
  }
});

module.exports = router;
