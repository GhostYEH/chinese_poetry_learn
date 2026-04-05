const express = require('express');
const router = express.Router();
const config = require('../config/config');
const abilityModelService = require('../services/abilityModelService');

// 认证中间件
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: '未登录' });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = config.jwt.secret || 'your-secret-key';

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ success: false, message: '令牌无效' });
      }
      req.user = { userId: decoded.userId, username: decoded.username };
      next();
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: '认证失败' });
  }
}

// 懒加载数据库（避免循环依赖）
let db = null;
function getDb() {
  if (!db) {
    db = require('../utils/db').db;
  }
  return db;
}

// GET /api/profile/stats - 获取用户个人中心统计数据
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const database = getDb();

    // 并行查询多个数据源
    const stats = await Promise.all([
      // 已学诗词数量
      new Promise((resolve) => {
        database.get('SELECT COUNT(*) as count FROM learning_records WHERE user_id = ?', [userId], (err, row) => {
          resolve(err ? 0 : (row?.count || 0));
        });
      }),
      // 收藏诗词数量
      new Promise((resolve) => {
        database.get('SELECT COUNT(*) as count FROM collections WHERE user_id = ?', [userId], (err, row) => {
          resolve(err ? 0 : (row?.count || 0));
        });
      }),
      // 创作作品数量
      new Promise((resolve) => {
        database.get('SELECT COUNT(*) as count FROM user_creations WHERE user_id = ?', [userId], (err, row) => {
          resolve(err ? 0 : (row?.count || 0));
        });
      }),
      // 闯关最高关卡
      new Promise((resolve) => {
        database.get('SELECT MAX(level) as max_level FROM user_challenge_records WHERE user_id = ?', [userId], (err, row) => {
          resolve(err ? 0 : (row?.max_level || 0));
        });
      }),
      // 飞花令积分
      new Promise((resolve) => {
        database.get('SELECT rating FROM feihua_ranking WHERE user_id = ?', [userId], (err, row) => {
          resolve(err ? 1000 : (row?.rating || 1000));
        });
      }),
      // 错题本数量
      new Promise((resolve) => {
        database.get('SELECT COUNT(*) as count FROM wrong_questions WHERE user_id = ?', [userId], (err, row) => {
          resolve(err ? 0 : (row?.count || 0));
        });
      }),
        // 本周打卡天数
        new Promise((resolve) => {
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          database.get('SELECT COUNT(DISTINCT date) as count FROM daily_checkin WHERE user_id = ? AND date >= ?', [userId, weekAgo.split('T')[0]], (err, row) => {
            resolve(err ? 0 : (row?.count || 0));
          });
        }),
      // 累计学习时长（分钟）
      new Promise((resolve) => {
        database.get('SELECT SUM(study_time) as total FROM learning_records WHERE user_id = ?', [userId], (err, row) => {
          resolve(err ? 0 : Math.round((row?.total || 0) / 60));
        });
      }),
      // 学习准确率
      new Promise((resolve) => {
        database.get(`SELECT AVG(CAST(is_correct AS REAL)) as avg FROM user_challenge_records WHERE user_id = ?`, [userId], (err, row) => {
          resolve(err ? 0 : Math.round((row?.avg || 0) * 100));
        });
      }),
    ]);

    // 查询最近学习的诗词（按时间排序）
    const recentPoems = await new Promise((resolve) => {
      database.all(`
        SELECT lr.poem_id, lr.best_score, lr.last_view_time,
               p.title, p.author, p.dynasty, p.content
        FROM learning_records lr
        LEFT JOIN poems p ON lr.poem_id = p.id
        WHERE lr.user_id = ?
        ORDER BY lr.last_view_time DESC
        LIMIT 5
      `, [userId], (err, rows) => {
        resolve(err ? [] : (rows || []));
      });
    });

    // 查询收藏的诗词
    const collectedPoems = await new Promise((resolve) => {
      database.all(`
        SELECT c.poem_id, c.created_at as collected_at,
               p.title, p.author, p.dynasty, p.content
        FROM collections c
        LEFT JOIN poems p ON c.poem_id = p.id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
        LIMIT 5
      `, [userId], (err, rows) => {
        resolve(err ? [] : (rows || []));
      });
    });

    // 查询每日学习活动（近30天）
    const activityData = await new Promise((resolve) => {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      database.all(`
        SELECT DATE(last_view_time) as date, COUNT(*) as count
        FROM learning_records
        WHERE user_id = ? AND last_view_time >= ?
        GROUP BY DATE(last_view_time)
        ORDER BY date ASC
      `, [userId, monthAgo], (err, rows) => {
        resolve(err ? [] : (rows || []));
      });
    });

    // 查询每周学习数据（用于雷达图）
    const weeklyStats = await new Promise((resolve) => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      database.get(`
        SELECT
          COUNT(DISTINCT poem_id) as poems_learned,
          COUNT(*) as total_sessions,
          SUM(study_time) as total_time
        FROM learning_records
        WHERE user_id = ? AND last_view_time >= ?
      `, [userId, weekAgo], (err, row) => {
        if (err) {
          resolve({ poems_learned: 0, total_sessions: 0, total_time: 0 });
        } else {
          resolve({
            poems_learned: row?.poems_learned || 0,
            total_sessions: row?.total_sessions || 0,
            total_time: row?.total_time || 0
          });
        }
      });
    });
    
    // 获取能力模型数据
    const abilityModel = await abilityModelService.calculateAbilityModel(userId);

    // 闯关数据
    const challengeStats = await new Promise((resolve) => {
      database.all(`
        SELECT level, best_score, answered_at as completed_at
        FROM user_challenge_records
        WHERE user_id = ?
        ORDER BY level DESC
        LIMIT 10
      `, [userId], (err, rows) => {
        resolve(err ? [] : (rows || []));
      });
    });

    const payload = {
      userId,
      overview: {
        poemsStudied: stats[0],
        collections: stats[1],
        creations: stats[2],
        challengeLevel: stats[3],
        feihuaRating: stats[4],
        wrongQuestions: stats[5],
        weeklyCheckins: stats[6],
        totalStudyTime: stats[7],
        accuracy: stats[8]
      },
      recentPoems,
      collectedPoems,
      activityData,
      weeklyStats,
      challengeStats,
      abilityModel
    };

    console.log('[profileRoutes] 获取个人中心统计 成功:', { userId });
    return res.json({ success: true, data: payload, message: '查询成功' });
  } catch (error) {
    console.error('[profileRoutes] 获取个人中心统计异常:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// GET /api/profile/activity - 获取用户活动数据（用于图表）
router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const database = getDb();

    // 近30天学习活动
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const learningActivity = await new Promise((resolve) => {
      database.all(`
        SELECT DATE(last_view_time) as date, COUNT(*) as count
        FROM learning_records
        WHERE user_id = ? AND last_view_time >= ?
        GROUP BY DATE(last_view_time)
        ORDER BY date ASC
      `, [userId, monthAgo], (err, rows) => {
        resolve(err ? [] : (rows || []));
      });
    });

    // 近30天闯关活动
    const challengeActivity = await new Promise((resolve) => {
      database.all(`
        SELECT DATE(answered_at) as date, COUNT(*) as count, AVG(CAST(is_correct AS REAL)) as accuracy
        FROM user_challenge_records
        WHERE user_id = ? AND answered_at >= ?
        GROUP BY DATE(answered_at)
        ORDER BY date ASC
      `, [userId, monthAgo], (err, rows) => {
        resolve(err ? [] : (rows || []));
      });
    });

    // 近30天打卡数据
    const checkinActivity = await new Promise((resolve) => {
      database.all(`
        SELECT date, COUNT(*) as count
        FROM daily_checkin
        WHERE user_id = ? AND date >= ?
        GROUP BY date
        ORDER BY date ASC
      `, [userId, monthAgo], (err, rows) => {
        resolve(err ? [] : (rows || []));
      });
    });

    // 近30天创作活动
    const creationActivity = await new Promise((resolve) => {
      database.all(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM user_creations
        WHERE user_id = ? AND created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [userId, monthAgo], (err, rows) => {
        resolve(err ? [] : (rows || []));
      });
    });

    // 按朝代分布
    const dynastyDistribution = await new Promise((resolve) => {
      database.all(`
        SELECT p.dynasty, COUNT(*) as count
        FROM learning_records lr
        JOIN poems p ON lr.poem_id = p.id
        WHERE lr.user_id = ?
        GROUP BY p.dynasty
        ORDER BY count DESC
      `, [userId], (err, rows) => {
        resolve(err ? [] : (rows || []));
      });
    });

    // 按诗人分布
    const authorDistribution = await new Promise((resolve) => {
      database.all(`
        SELECT p.author, COUNT(*) as count
        FROM learning_records lr
        JOIN poems p ON lr.poem_id = p.id
        WHERE lr.user_id = ?
        GROUP BY p.author
        ORDER BY count DESC
        LIMIT 10
      `, [userId], (err, rows) => {
        resolve(err ? [] : (rows || []));
      });
    });

    const payload = {
      learningActivity,
      challengeActivity,
      checkinActivity,
      creationActivity,
      dynastyDistribution,
      authorDistribution
    };

    console.log('[profileRoutes] 获取活动数据 成功:', { userId });
    return res.json({ success: true, data: payload, message: '查询成功' });
  } catch (error) {
    console.error('[profileRoutes] 获取活动数据异常:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// GET /api/profile/achievements - 获取用户成就
router.get('/achievements', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const database = getDb();

    // 定义所有成就
    const allAchievements = [
      { id: 'poem_10', name: '初学者', desc: '学习10首诗词', icon: '📖', type: 'poems' },
      { id: 'poem_50', name: '诗词爱好者', desc: '学习50首诗词', icon: '📚', type: 'poems' },
      { id: 'poem_100', name: '诗词达人', desc: '学习100首诗词', icon: '🏅', type: 'poems' },
      { id: 'poem_200', name: '诗词大师', desc: '学习200首诗词', icon: '🎓', type: 'poems' },
      { id: 'collect_10', name: '收藏家', desc: '收藏10首诗词', icon: '⭐', type: 'collections' },
      { id: 'collect_30', name: '藏书阁', desc: '收藏30首诗词', icon: '🏛', type: 'collections' },
      { id: 'create_5', name: '初露锋芒', desc: '创作5首诗词', icon: '✍️', type: 'creations' },
      { id: 'create_20', name: '诗才横溢', desc: '创作20首诗词', icon: '🖋', type: 'creations' },
      { id: 'challenge_10', name: '闯关新秀', desc: '通关10关', icon: '🗝', type: 'challenge' },
      { id: 'challenge_30', name: '闯关勇士', desc: '通关30关', icon: '⚔️', type: 'challenge' },
      { id: 'challenge_50', name: '闯关英雄', desc: '通关50关', icon: '👑', type: 'challenge' },
      { id: 'accuracy_80', name: '精准打击', desc: '准确率达到80%', icon: '🎯', type: 'accuracy' },
      { id: 'accuracy_90', name: '百发百中', desc: '准确率达到90%', icon: '💯', type: 'accuracy' },
      { id: 'streak_7', name: '连续7天', desc: '连续打卡7天', icon: '🔥', type: 'streak' },
      { id: 'streak_30', name: '坚持不懈', desc: '连续打卡30天', icon: '💪', type: 'streak' },
      { id: 'feihua_master', name: '飞花令高手', desc: '飞花令积分达到1500', icon: '🌸', type: 'feihua' },
      { id: 'feihua_legend', name: '飞花令传奇', desc: '飞花令积分达到2000', icon: '🌺', type: 'feihua' },
    ];

    // 获取用户统计数据
    const userStats = await new Promise((resolve) => {
      database.get(`
        SELECT
          (SELECT COUNT(*) FROM learning_records WHERE user_id = ?) as poems_count,
          (SELECT COUNT(*) FROM collections WHERE user_id = ?) as collections_count,
          (SELECT COUNT(*) FROM user_creations WHERE user_id = ?) as creations_count,
          (SELECT MAX(level) FROM user_challenge_records WHERE user_id = ?) as max_level,
          (SELECT AVG(CAST(is_correct AS REAL)) FROM user_challenge_records WHERE user_id = ?) as avg_accuracy,
          (SELECT rating FROM feihua_ranking WHERE user_id = ?) as feihua_rating
      `, [userId, userId, userId, userId, userId, userId], (err, row) => {
        resolve(err ? { poems_count: 0, collections_count: 0, creations_count: 0, max_level: 0, avg_accuracy: 0, feihua_rating: 1000 } : row);
      });
    });

    // 计算连续打卡天数
    const checkinStreak = await new Promise((resolve) => {
      database.all(`
        SELECT date
        FROM daily_checkin
        WHERE user_id = ?
        ORDER BY date DESC
      `, [userId], (err, rows) => {
        if (err || !rows || rows.length === 0) {
          resolve(0);
          return;
        }
        let streak = 0;
        let lastDate = null;
        const today = new Date().toISOString().split('T')[0];
        for (const row of rows) {
          const date = row.date;
          if (!lastDate) {
            // 检查是否是今天或昨天开始
            const diff = Math.floor((new Date(today) - new Date(date)) / (24 * 60 * 60 * 1000));
            if (diff <= 1) {
              streak = 1;
              lastDate = date;
            } else {
              break;
            }
          } else {
            const diff = Math.floor((new Date(lastDate) - new Date(date)) / (24 * 60 * 60 * 1000));
            if (diff === 1) {
              streak++;
              lastDate = date;
            } else {
              break;
            }
          }
        }
        resolve(streak);
      });
    });

    // 判断每个成就是否达成
    const achievements = allAchievements.map(a => {
      let progress = 0;
      let target = 0;
      switch (a.type) {
        case 'poems': target = parseInt(a.id.split('_')[1]); progress = userStats.poems_count; break;
        case 'collections': target = parseInt(a.id.split('_')[1]); progress = userStats.collections_count; break;
        case 'creations': target = parseInt(a.id.split('_')[1]); progress = userStats.creations_count; break;
        case 'challenge': target = parseInt(a.id.split('_')[1]); progress = userStats.max_level; break;
        case 'accuracy': target = parseInt(a.id.split('_')[1]); progress = Math.round((userStats.avg_accuracy || 0) * 100); break;
        case 'streak': target = parseInt(a.id.split('_')[1]); progress = checkinStreak; break;
        case 'feihua':
          target = a.id === 'feihua_master' ? 1500 : 2000;
          progress = userStats.feihua_rating || 1000;
          break;
      }
      const unlocked = progress >= target;
      return { ...a, progress, target, unlocked };
    });

    const unlockedCount = achievements.filter(a => a.unlocked).length;

    const payload = {
      achievements,
      summary: {
        total: achievements.length,
        unlocked: unlockedCount,
        totalProgress: Math.round((unlockedCount / achievements.length) * 100)
      },
      userStats: {
        poemsCount: userStats.poems_count,
        collectionsCount: userStats.collections_count,
        creationsCount: userStats.creations_count,
        maxLevel: userStats.max_level,
        avgAccuracy: Math.round((userStats.avg_accuracy || 0) * 100),
        feihuaRating: userStats.feihua_rating || 1000,
        checkinStreak
      }
    };

    console.log('[profileRoutes] 获取成就 成功:', { userId, unlockedCount });
    return res.json({ success: true, data: payload, message: '查询成功' });
  } catch (error) {
    console.error('[profileRoutes] 获取成就异常:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

module.exports = { router };
