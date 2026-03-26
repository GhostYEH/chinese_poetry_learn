// 个性化推荐路由
const express = require('express');
const router = express.Router();
const { getPersonalizedData } = require('../services/personalizedService');

/**
 * GET /api/personalized
 * 获取完整的个性化推荐数据（需要认证）
 * 返回：{ review, learn, analysis }
 */
router.get('/', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未登录，请先登录' });
  }
  const token = authHeader.slice(7);
  let userId;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    userId = payload.userId;
  } catch (e) {
    return res.status(401).json({ message: '无效的登录凭证' });
  }
  if (!userId) {
    return res.status(401).json({ message: '无法识别用户身份' });
  }

  getPersonalizedData(userId)
    .then(data => {
      res.json(data);
    })
    .catch(err => {
      console.error('[personalizedRoutes] 获取个性化数据失败:', err);
      res.status(500).json({ message: '获取个性化数据失败', error: err.message });
    });
});

module.exports = router;
