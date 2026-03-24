// 飞花令游戏相关的API路由
const express = require('express');
const router = express.Router();
const feihuaService = require('../services/feihuaService');
const authenticateToken = require('../middleware/auth');

// 保存飞花令游戏记录接口
router.post('/save', authenticateToken, async (req, res) => {
  try {
    const { keyword, score, poemCount, history } = req.body;
    const { userId } = req.user;
    
    if (!keyword || !score || !poemCount || !history) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    const gameRecord = await feihuaService.saveFeihuaGame(userId, keyword, score, poemCount, history);
    
    res.json({
      success: true,
      message: '游戏记录保存成功',
      data: gameRecord
    });
  } catch (error) {
    console.error('保存游戏记录失败:', error);
    res.status(500).json({ message: '保存游戏记录失败' });
  }
});

// 获取用户的飞花令游戏记录列表
router.get('/games', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const games = await feihuaService.getUserFeihuaGames(userId);
    
    res.json({
      success: true,
      data: games,
      total: games.length
    });
  } catch (error) {
    console.error('获取游戏记录失败:', error);
    res.status(500).json({ message: '获取游戏记录失败' });
  }
});

// 获取用户的最高得分
router.get('/high-score', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const highScore = await feihuaService.getHighScore(userId);
    
    res.json({
      success: true,
      data: {
        highScore
      }
    });
  } catch (error) {
    console.error('获取最高得分失败:', error);
    res.status(500).json({ message: '获取最高得分失败' });
  }
});

module.exports = router;
