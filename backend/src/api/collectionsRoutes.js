// 收藏相关的API路由
const express = require('express');
const router = express.Router();
const collectionsService = require('../services/collectionsService');
const authenticateToken = require('../middleware/auth');

// 添加收藏接口
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { poem_id } = req.body;
    const { userId } = req.user;
    
    if (!poem_id) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    const collection = await collectionsService.addCollection(userId, poem_id);
    
    res.json({
      success: true,
      message: '添加收藏成功',
      data: collection
    });
  } catch (error) {
    console.error('添加收藏失败:', error);
    res.status(500).json({ message: '添加收藏失败' });
  }
});

// 删除收藏接口
router.delete('/:poemId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const poemId = parseInt(req.params.poemId);
    
    if (isNaN(poemId)) {
      return res.status(400).json({ message: '无效的诗词ID' });
    }
    
    const success = await collectionsService.removeCollection(userId, poemId);
    
    if (success) {
      res.json({
        success: true,
        message: '取消收藏成功'
      });
    } else {
      res.status(404).json({ message: '收藏未找到' });
    }
  } catch (error) {
    console.error('取消收藏失败:', error);
    res.status(500).json({ message: '取消收藏失败' });
  }
});

// 获取收藏列表接口
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const collections = await collectionsService.getUserCollections(userId);
    
    res.json({
      success: true,
      data: collections,
      total: collections.length
    });
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.status(500).json({ message: '获取收藏列表失败' });
  }
});

// 检查是否收藏接口
router.get('/check/:poemId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const poemId = parseInt(req.params.poemId);
    
    if (isNaN(poemId)) {
      return res.status(400).json({ message: '无效的诗词ID' });
    }
    
    const isCollected = await collectionsService.checkCollection(userId, poemId);
    
    res.json({
      success: true,
      data: {
        is_collected: isCollected
      }
    });
  } catch (error) {
    console.error('检查收藏状态失败:', error);
    res.status(500).json({ message: '检查收藏状态失败' });
  }
});

module.exports = router;
