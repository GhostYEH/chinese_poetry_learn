// 用户认证相关的API路由
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../utils/db');

// JWT密钥
const JWT_SECRET = 'your-secret-key';
const JWT_EXPIRES_IN = '24h';

// 注册接口
router.post('/register', (req, res) => {
  try {
    const { username, email, password, classId } = req.body;
    
    if (!username || !email || !password || !classId) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ message: '密码长度至少6位' });
    }
    
    // 检查classId是否为正整数
    const classIdNum = parseInt(classId);
    if (isNaN(classIdNum) || classIdNum <= 0) {
      return res.status(400).json({ message: '班级号必须是正整数' });
    }
    
    // 检查班级是否存在，不存在则创建
    db.get('SELECT * FROM class_stats WHERE class_id = ?', [classIdNum], (err, row) => {
      if (err) {
        console.error('查询班级失败:', err);
        return res.status(500).json({ message: '注册失败' });
      }
      
      if (!row) {
        // 创建新班级
        db.run('INSERT INTO class_stats (class_id) VALUES (?)', [classIdNum], (err) => {
          if (err) {
            console.error('创建班级失败:', err);
            return res.status(500).json({ message: '注册失败' });
          }
          proceedWithRegistration();
        });
      } else {
        proceedWithRegistration();
      }
    });
    
    function proceedWithRegistration() {
      // 检查用户名是否已存在
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
          console.error('查询用户失败:', err);
          return res.status(500).json({ message: '注册失败' });
        }
        
        if (row) {
          return res.status(400).json({ message: '用户名已存在' });
        }
        
        // 检查邮箱是否已存在
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
          if (err) {
            console.error('查询邮箱失败:', err);
            return res.status(500).json({ message: '注册失败' });
          }
          
          if (row) {
            return res.status(400).json({ message: '邮箱已存在' });
          }
          
          // 加密密码
          bcrypt.hash(password, 10, (err, passwordHash) => {
            if (err) {
              console.error('密码加密失败:', err);
              return res.status(500).json({ message: '注册失败' });
            }
            
            const now = new Date().toISOString();
            
            // 创建用户
            db.run(
              'INSERT INTO users (username, email, password_hash, class_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
              [username, email, passwordHash, classIdNum, now, now],
              function(err) {
                if (err) {
                  console.error('创建用户失败:', err);
                  return res.status(500).json({ message: '注册失败' });
                }
                
                // 更新班级学生计数
                db.run('UPDATE class_stats SET total_students = total_students + 1 WHERE class_id = ?', [classIdNum], (err) => {
                  if (err) {
                    console.error('更新班级学生计数失败:', err);
                  }
                });
                
                // 生成JWT令牌
                const token = jwt.sign(
                  { userId: this.lastID, username },
                  JWT_SECRET,
                  { expiresIn: JWT_EXPIRES_IN }
                );
                
                res.json({
                  success: true,
                  message: '注册成功',
                  data: {
                    token,
                    user: {
                      id: this.lastID,
                      username,
                      email,
                      classId: classIdNum
                    }
                  }
                });
              }
            );
          });
        });
      });
    }
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ message: '注册失败' });
  }
});

// 登录接口
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: '缺少必要参数' });
    }
    
    // 查找用户
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
      if (err) {
        console.error('查询用户失败:', err);
        return res.status(500).json({ message: '登录失败' });
      }
      
      if (!user) {
        return res.status(401).json({ message: '用户名或密码错误' });
      }
      
      // 验证密码
      bcrypt.compare(password, user.password_hash, (err, isMatch) => {
        if (err) {
          console.error('密码验证失败:', err);
          return res.status(500).json({ message: '登录失败' });
        }
        
        if (!isMatch) {
          return res.status(401).json({ message: '用户名或密码错误' });
        }
        
        // 生成JWT令牌
        const token = jwt.sign(
          { userId: user.id, username: user.username },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.json({
          success: true,
          message: '登录成功',
          data: {
            token,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              classId: user.class_id
            }
          }
        });
      });
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ message: '登录失败' });
  }
});

// 登出接口（前端处理，后端只返回成功）
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: '登出成功'
  });
});

// 验证令牌接口
router.get('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: '未提供令牌' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: '令牌无效' });
      }
      
      // 查找用户
      db.get('SELECT id, username, email, class_id FROM users WHERE id = ?', [decoded.userId], (err, user) => {
        if (err) {
          console.error('查询用户失败:', err);
          return res.status(500).json({ message: '验证失败' });
        }
        
        if (!user) {
          return res.status(401).json({ message: '用户不存在' });
        }
        
        res.json({
          success: true,
          data: {
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              classId: user.class_id
            }
          }
        });
      });
    });
  } catch (error) {
    console.error('验证失败:', error);
    res.status(500).json({ message: '验证失败' });
  }
});

module.exports = router;
