// 飞花令排位系统服务
const { db } = require('../utils/db');

const RANK_LEVELS = [
  { name: '青铜', min: 0, max: 1099, color: '#cd7f32', icon: '🥉' },
  { name: '白银', min: 1100, max: 1299, color: '#c0c0c0', icon: '🥈' },
  { name: '黄金', min: 1300, max: 1499, color: '#ffd700', icon: '🥇' },
  { name: '铂金', min: 1500, max: 1699, color: '#e5e4e2', icon: '💎' },
  { name: '钻石', min: 1700, max: 1899, color: '#b9f2ff', icon: '💠' },
  { name: '大师', min: 1900, max: 2099, color: '#9932cc', icon: '🏆' },
  { name: '宗师', min: 2100, max: 2299, color: '#ff4500', icon: '👑' },
  { name: '王者', min: 2300, max: 9999, color: '#ff0000', icon: '🌟' }
];

/**
 * 获取用户排位信息
 */
function getRankingInfo(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT * FROM feihua_rankings
      WHERE user_id = ?
    `, [userId], (err, row) => {
      if (err) { reject(err); return; }
      
      if (!row) {
        // 创建新用户排位记录
        const defaultRank = {
          rank_level: '青铜',
          rating: 1000,
          wins: 0,
          losses: 0,
          total_battles: 0,
          current_streak: 0,
          best_streak: 0
        };
        
        db.run(`
          INSERT INTO feihua_rankings (user_id, rank_level, rating, wins, losses, total_battles, current_streak, best_streak)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, defaultRank.rank_level, defaultRank.rating, defaultRank.wins, defaultRank.losses, 
            defaultRank.total_battles, defaultRank.current_streak, defaultRank.best_streak],
        (err) => {
          if (err) { reject(err); return; }
          resolve({ ...defaultRank, user_id: userId });
        });
      } else {
        // 确保rank_level是最新的
        const level = getRankLevel(row.rating);
        if (row.rank_level !== level.name) {
          db.run('UPDATE feihua_rankings SET rank_level = ? WHERE user_id = ?', 
            [level.name, userId], (err) => {
            if (err) console.error('更新排位等级失败:', err);
          });
          row.rank_level = level.name;
        }
        resolve(row);
      }
    });
  });
}

/**
 * 根据rating获取段位
 */
function getRankLevel(rating) {
  for (const level of RANK_LEVELS) {
    if (rating >= level.min && rating <= level.max) {
      return level;
    }
  }
  return RANK_LEVELS[0];
}

/**
 * 获取段位信息
 */
function getRankLevelInfo(levelName) {
  return RANK_LEVELS.find(l => l.name === levelName) || RANK_LEVELS[0];
}

/**
 * 更新排位赛结果
 */
function updateRankingAfterBattle(winnerId, loserId, isDraw = false) {
  return new Promise(async (resolve, reject) => {
    const winnerInfo = await getRankingInfo(winnerId);
    const loserInfo = await getRankingInfo(loserId);
    
    // 计算elo分数变化
    const K = 32; // 弹性系数
    const expectedWinner = 1 / (1 + Math.pow(10, (loserInfo.rating - winnerInfo.rating) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerInfo.rating - loserInfo.rating) / 400));
    
    let winnerDelta, loserDelta;
    if (isDraw) {
      winnerDelta = Math.round(K * (0.5 - expectedWinner));
      loserDelta = Math.round(K * (0.5 - expectedLoser));
    } else {
      winnerDelta = Math.round(K * (1 - expectedWinner));
      loserDelta = Math.round(K * (0 - expectedLoser));
    }
    
    const newWinnerRating = Math.max(0, winnerInfo.rating + winnerDelta);
    const newLoserRating = Math.max(0, loserInfo.rating + loserDelta);
    const newWinnerLevel = getRankLevel(newWinnerRating);
    const newLoserLevel = getRankLevel(newLoserRating);
    
    const newWinnerStreak = winnerInfo.current_streak + 1;
    const newLoserStreak = 0;
    const newBestStreak = Math.max(winnerInfo.best_streak, newWinnerStreak);
    
    // 更新胜者
    await new Promise((res, rej) => {
      db.run(`
        UPDATE feihua_rankings
        SET rating = ?,
            rank_level = ?,
            wins = wins + 1,
            total_battles = total_battles + 1,
            current_streak = ?,
            best_streak = ?,
            last_battle_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [newWinnerRating, newWinnerLevel.name, newWinnerStreak, newBestStreak, winnerId],
      (err) => { if (err) rej(err); else res(); });
    });
    
    // 更新败者
    await new Promise((res, rej) => {
      db.run(`
        UPDATE feihua_rankings
        SET rating = ?,
            rank_level = ?,
            losses = losses + 1,
            total_battles = total_battles + 1,
            current_streak = 0,
            last_battle_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [newLoserRating, newLoserLevel.name, loserId],
      (err) => { if (err) rej(err); else res(); });
    });
    
    resolve({
      winner: {
        id: winnerId,
        oldRating: winnerInfo.rating,
        newRating: newWinnerRating,
        delta: winnerDelta,
        newLevel: newWinnerLevel
      },
      loser: {
        id: loserId,
        oldRating: loserInfo.rating,
        newRating: newLoserRating,
        delta: loserDelta,
        newLevel: newLoserLevel
      }
    });
  });
}

/**
 * 获取排行榜
 */
function getLeaderboard(limit = 50, page = 1) {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;
    
    db.all(`
      SELECT 
        fr.*,
        u.username,
        ROW_NUMBER() OVER (ORDER BY fr.rating DESC, fr.wins DESC) as rank
      FROM feihua_rankings fr
      JOIN users u ON fr.user_id = u.id
      WHERE fr.total_battles > 0
      ORDER BY fr.rating DESC, fr.wins DESC
      LIMIT ? OFFSET ?
    `, [limit, offset], (err, rows) => {
      if (err) { reject(err); return; }
      
      rows = rows.map(row => {
        const level = getRankLevel(row.rating);
        return {
          ...row,
          rank_level: level.name,
          rank_level_info: level
        };
      });
      
      resolve(rows);
    });
  });
}

/**
 * 获取用户在排行榜的排名
 */
function getUserRank(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT rank
      FROM (
        SELECT 
          user_id,
          ROW_NUMBER() OVER (ORDER BY rating DESC, wins DESC) as rank
        FROM feihua_rankings
        WHERE total_battles > 0
      )
      WHERE user_id = ?
    `, [userId], (err, row) => {
      if (err) { reject(err); return; }
      resolve({ rank: row?.rank || null });
    });
  });
}

/**
 * 获取排位赛统计数据
 */
function getRankingStats() {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        COUNT(*) as total_players,
        SUM(total_battles) as total_battles,
        SUM(wins) as total_wins,
        AVG(rating) as avg_rating,
        MAX(rating) as max_rating,
        MIN(rating) as min_rating
      FROM feihua_rankings
      WHERE total_battles > 0
    `, (err, row) => {
      if (err) { reject(err); return; }
      
      // 统计各段位人数
      db.all(`
        SELECT rank_level, COUNT(*) as count
        FROM feihua_rankings
        WHERE total_battles > 0
        GROUP BY rank_level
        ORDER BY 
          CASE rank_level
            WHEN '青铜' THEN 1
            WHEN '白银' THEN 2
            WHEN '黄金' THEN 3
            WHEN '铂金' THEN 4
            WHEN '钻石' THEN 5
            WHEN '大师' THEN 6
            WHEN '宗师' THEN 7
            WHEN '王者' THEN 8
          END
      `, (err, levelStats) => {
        if (err) { reject(err); return; }
        resolve({
          ...row,
          levelDistribution: levelStats
        });
      });
    });
  });
}

module.exports = {
  RANK_LEVELS,
  getRankingInfo,
  getRankLevel,
  getRankLevelInfo,
  updateRankingAfterBattle,
  getLeaderboard,
  getUserRank,
  getRankingStats
};
