// JWT认证中间件
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// 认证中间件
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: '未提供认证令牌' });
    }
    
    jwt.verify(token, config.jwt.secret, (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: '无效的认证令牌' });
      }
      
      // 将用户信息存储到请求对象中
      req.user = {
        userId: decoded.userId,
        username: decoded.username
      };
      
      next();
    });
  } catch (error) {
    console.error('认证失败:', error);
    res.status(500).json({ message: '认证失败' });
  }
}

module.exports = authenticateToken;
