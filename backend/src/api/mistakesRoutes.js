// 错题本相关的API路由
const express = require('express');
const router = express.Router();
const mistakesService = require('../services/mistakesService');
const authenticateToken = require('../middleware/auth');

// 获取错题列表接口
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const mistakeList = await mistakesService.getMistakes(userId);
    
    res.json({
      success: true,
      data: mistakeList,
      total: mistakeList.length
    });
  } catch (error) {
    console.error('获取错题列表失败:', error);
    res.status(500).json({ message: '获取错题列表失败' });
  }
});

// 删除错题接口
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const mistakeId = parseInt(req.params.id);
    
    if (isNaN(mistakeId)) {
      return res.status(400).json({ message: '无效的错题ID' });
    }
    
    const success = await mistakesService.deleteMistake(userId, mistakeId);
    
    if (success) {
      res.json({
        success: true,
        message: '错题删除成功'
      });
    } else {
      res.status(404).json({ message: '错题未找到' });
    }
  } catch (error) {
    console.error('删除错题失败:', error);
    res.status(500).json({ message: '删除错题失败' });
  }
});

// 导出router
module.exports = {
  router,
  initMistakes: mistakesService.initMistakes
};
