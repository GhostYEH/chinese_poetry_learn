// 首页 API 路由：排行榜 + 个人学习数据
const express = require('express');
const router = express.Router();
const { optionalAuthenticateToken } = require('../middleware/auth');
const { db } = require('../utils/db');
const learningService = require('../services/learningService');

// ==================== 排行榜 ====================
// 示例数据（当数据库没有数据时使用）
const sampleRankingData = {
  feihua: [
    { id: 1, username: '李清照', score: 9850, unit: '分', meta: '飞花王者' },
    { id: 2, username: '王维', score: 9420, unit: '分', meta: '飞花大师' },
    { id: 3, username: '苏轼', score: 9100, unit: '分', meta: '飞花大师' },
    { id: 4, username: '杜甫', score: 8750, unit: '分', meta: '飞花宗师' },
    { id: 5, username: '李白', score: 8320, unit: '分', meta: '飞花高手' },
    { id: 6, username: '白居易', score: 7890, unit: '分', meta: '飞花新秀' },
    { id: 7, username: '陶渊明', score: 7450, unit: '分', meta: '初学者' },
  ],
  challenge: [
    { id: 1, username: '辛弃疾', score: 120, unit: '关', meta: '闯关之王' },
    { id: 2, username: '陆游', score: 108, unit: '关', meta: '闯关宗师' },
    { id: 3, username: '李商隐', score: 96, unit: '关', meta: '闯关大师' },
    { id: 4, username: '杜牧', score: 85, unit: '关', meta: '闯关达人' },
    { id: 5, username: '王安石', score: 72, unit: '关', meta: '闯关高手' },
  ],
  creation: [
    { id: 1, username: '文天祥', score: 98.5, unit: '分', meta: '创作大师' },
    { id: 2, username: '柳永', score: 96.2, unit: '分', meta: '创作大师' },
    { id: 3, username: '晏殊', score: 94.8, unit: '分', meta: '创作达人' },
    { id: 4, username: '秦观', score: 92.1, unit: '分', meta: '创作高手' },
  ]
};

// 1. 诗词闯关排行榜（按最高关卡）
router.get('/leaderboard/challenge', (req, res) => {
  db.all(`
    SELECT
      u.id,
      u.username,
      COALESCE(ucp.highest_level, 0) AS score
    FROM users u
    LEFT JOIN user_challenge_progress ucp ON u.id = ucp.user_id
    WHERE u.username IS NOT NULL
    ORDER BY score DESC, u.id ASC
    LIMIT 20
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ message: '查询失败' });
    let list = [];
    if (rows && rows.length > 0) {
      list = rows.map((r, i) => ({
        id: r.id,
        username: r.username,
        score: r.score,
        unit: '关',
        meta: getChallengeRank(r.score, i + 1)
      }));
    }
    if (list.length === 0) {
      list = sampleRankingData.challenge;
    }
    res.json({ success: true, data: list });
  });
});

// 2. 飞花令排行榜（按 rating）
router.get('/leaderboard/feihua', (req, res) => {
  db.all(`
    SELECT
      u.id,
      u.username,
      COALESCE(fr.rating, 1000) AS score
    FROM users u
    LEFT JOIN feihua_rankings fr ON u.id = fr.user_id
    WHERE u.username IS NOT NULL
    ORDER BY score DESC, u.id ASC
    LIMIT 20
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ message: '查询失败' });
    let list = [];
    if (rows && rows.length > 0) {
      list = rows.map((r, i) => ({
        id: r.id,
        username: r.username,
        score: r.score,
        unit: '分',
        meta: getFeihuaRank(r.score, i + 1)
      }));
    }
    if (list.length === 0) {
      list = sampleRankingData.feihua;
    }
    res.json({ success: true, data: list });
  });
});

// 3. 创作排行榜（按平均 AI 评分）
router.get('/leaderboard/creation', (req, res) => {
  db.all(`
    SELECT
      u.id,
      u.username,
      ROUND(COALESCE(cs.average_score, 0), 1) AS score
    FROM users u
    LEFT JOIN creation_stats cs ON u.id = cs.user_id
    WHERE u.username IS NOT NULL
    ORDER BY score DESC, u.id ASC
    LIMIT 20
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ message: '查询失败' });
    let list = [];
    if (rows && rows.length > 0) {
      list = rows.map((r, i) => ({
        id: r.id,
        username: r.username,
        score: r.score,
        unit: '分',
        meta: getCreationRank(r.score, i + 1)
      }));
    }
    if (list.length === 0) {
      list = sampleRankingData.creation;
    }
    res.json({ success: true, data: list });
  });
});

// 4. 综合排行榜（闯关 + 飞花令 + 创作加权总分）
router.get('/leaderboard/overall', (req, res) => {
  db.all(`
    SELECT
      u.id,
      u.username,
      COALESCE(ucp.highest_level * 100, 0) +
      COALESCE(fr.rating, 1000) +
      COALESCE(cs.average_score * 10, 0) AS score
    FROM users u
    LEFT JOIN user_challenge_progress ucp ON u.id = ucp.user_id
    LEFT JOIN feihua_rankings fr ON u.id = fr.user_id
    LEFT JOIN creation_stats cs ON u.id = cs.user_id
    ORDER BY score DESC, u.id ASC
    LIMIT 20
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ message: '查询失败' });
    const list = rows.map((r, i) => ({
      id: r.id,
      username: r.username,
      score: Math.round(r.score),
      unit: '分',
      meta: getOverallRank(r.score, i + 1)
    }));
    res.json({ success: true, data: list });
  });
});

// ==================== 个人学习数据 ====================
// 必须登录，否则返回空数据（前端展示"请登录"提示）
router.get('/learning-stats', optionalAuthenticateToken, async (req, res) => {
  if (!req.user) {
    return res.json({ success: true, data: { loggedIn: false } });
  }
  const userId = req.user.userId;

  try {
    // 使用和学习仪表盘一样的数据来源
    const dashboardData = await learningService.getLearningDashboard(userId);
    
    // 构建返回数据
    const stats = {
      loggedIn: true,
      poemsStudied: dashboardData.totalLearned || 0,
      totalStudyTime: dashboardData.totalStudyTime || 0,
      avgScore: dashboardData.averageScore || 0,
      masteredPoems: Math.round((dashboardData.masteryRate || 0) / 100 * (dashboardData.totalLearned || 0)),
      challengeLevel: 0,
      currentLevel: 1,
      feihuaRating: 1000,
      feihuaWins: 0,
      feihuaLosses: 0,
      feihuaTotalBattles: 0,
      totalCreations: 0,
      avgCreationScore: 0,
      bestCreationScore: 0,
      weeklyCheckins: 0
    };

    // 尝试获取其他数据（闯关、飞花令、创作等）
    try {
      const challengePromise = new Promise((resolve) => {
        db.get(`
          SELECT COALESCE(highest_level, 0) AS challengeLevel,
                 COALESCE(current_challenge_level, 1) AS currentLevel
          FROM user_challenge_progress WHERE user_id = ?
        `, [userId], (err, r) => {
          if (!err && r) {
            resolve({ challengeLevel: r.challengeLevel, currentLevel: r.currentLevel });
          } else {
            resolve(null);
          }
        });
      });

      const feihuaPromise = new Promise((resolve) => {
        db.get(`
          SELECT COALESCE(rating, 1000) AS rating,
                 COALESCE(wins, 0) AS wins,
                 COALESCE(losses, 0) AS losses,
                 COALESCE(total_battles, 0) AS totalBattles
          FROM feihua_rankings WHERE user_id = ?
        `, [userId], (err, r) => {
          if (!err && r) {
            resolve(r);
          } else {
            resolve(null);
          }
        });
      });

      const creationPromise = new Promise((resolve) => {
        db.get(`
          SELECT COALESCE(total_creations, 0) AS totalCreations,
                 COALESCE(average_score, 0) AS avgCreationScore,
                 COALESCE(highest_score, 0) AS bestCreationScore
          FROM creation_stats WHERE user_id = ?
        `, [userId], (err, r) => {
          if (!err && r) {
            resolve(r);
          } else {
            resolve(null);
          }
        });
      });

      const checkinPromise = new Promise((resolve) => {
        db.get(`
          SELECT COUNT(*) AS checkins FROM daily_checkin
          WHERE user_id = ? AND date >= date('now', '-7 days')
        `, [userId], (err, r) => {
          if (!err && r) {
            resolve(r.checkins);
          } else {
            resolve(0);
          }
        });
      });

      const [challengeData, feihuaData, creationData, weeklyCheckins] = await Promise.all([
        challengePromise,
        feihuaPromise,
        creationPromise,
        checkinPromise
      ]);

      if (challengeData) {
        stats.challengeLevel = challengeData.challengeLevel;
        stats.currentLevel = challengeData.currentLevel;
      }
      if (feihuaData) {
        stats.feihuaRating = feihuaData.rating;
        stats.feihuaWins = feihuaData.wins;
        stats.feihuaLosses = feihuaData.losses;
        stats.feihuaTotalBattles = feihuaData.totalBattles;
      }
      if (creationData) {
        stats.totalCreations = creationData.totalCreations;
        stats.avgCreationScore = creationData.avgCreationScore;
        stats.bestCreationScore = creationData.bestCreationScore;
      }
      stats.weeklyCheckins = weeklyCheckins;

    } catch (additionalErr) {
      console.warn('获取额外学习数据失败:', additionalErr);
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取学习数据失败:', error);
    res.status(500).json({ success: false, message: '获取学习数据失败' });
  }
});

// ==================== 段位/称号辅助函数 ====================
function getChallengeRank(score, pos) {
  if (pos <= 2) return pos === 1 ? '闯关之王' : pos === 2 ? '闯关宗师' : '闯关大师';
  if (score >= 50) return '闯关达人';
  if (score >= 30) return '闯关高手';
  if (score >= 15) return '闯关新秀';
  return '初学者';
}

function getFeihuaRank(score, pos) {
  if (pos <= 3) return pos === 1 ? '飞花王者' : '飞花大师';
  if (score >= 1800) return '飞花宗师';
  if (score >= 1500) return '飞花高手';
  if (score >= 1200) return '飞花新秀';
  return '初学者';
}

function getCreationRank(score, pos) {
  if (pos <= 3) return '创作大师';
  if (score >= 85) return '创作达人';
  if (score >= 70) return '创作高手';
  if (score >= 55) return '创作新秀';
  return '初学者';
}

function getOverallRank(score, pos) {
  if (pos <= 3) return pos === 1 ? '全能诗仙' : '诗词大师';
  if (score >= 5000) return '诗词达人';
  if (score >= 3000) return '诗词高手';
  if (score >= 1500) return '诗词新秀';
  return '初学者';
}

module.exports = { router };
