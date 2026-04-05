// 推荐学习相关的API路由
const express = require('express');
const router = express.Router();
const recommendService = require('../services/recommendService');

// 存储诗词数据的变量
let poems = [];

// 设置诗词数据
function setPoems(data) {
  poems = data;
}

// 获取推荐学习列表接口
router.get('/', (req, res) => {
  try {
    if (!poems || poems.length === 0) {
      return res.status(503).json({ message: '诗词数据未加载' });
    }
    
    const recommendations = recommendService.getRecommendations(poems);
    
    res.json({
      success: true,
      data: recommendations,
      total: recommendations.length
    });
  } catch (error) {
    console.error('获取推荐学习列表失败:', error);
    res.status(500).json({ message: '获取推荐学习列表失败' });
  }
});

// 导出router和setPoems函数
module.exports = {
  router,
  setPoems
};