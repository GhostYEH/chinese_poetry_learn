// 飞花令游戏服务
const { db } = require('../utils/db');

// 保存飞花令游戏记录
function saveFeihuaGame(userId, keyword, score, poemCount, history) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const historyJson = JSON.stringify(history);
    
    db.run(
      'INSERT INTO feihua_games (user_id, keyword, score, poem_count, history, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, keyword, score, poemCount, historyJson, now],
      function(err) {
        if (err) {
          console.error('保存飞花令游戏记录失败:', err);
          reject(err);
          return;
        }
        
        const gameRecord = {
          id: this.lastID,
          user_id: userId,
          keyword: keyword,
          score: score,
          poem_count: poemCount,
          history: history,
          created_at: now
        };
        
        resolve(gameRecord);
      }
    );
  });
}

// 获取用户的飞花令游戏记录
function getUserFeihuaGames(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM feihua_games WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
      (err, rows) => {
        if (err) {
          console.error('获取飞花令游戏记录失败:', err);
          reject(err);
          return;
        }
        
        // 解析history字段
        const games = rows.map(row => ({
          ...row,
          history: JSON.parse(row.history)
        }));
        
        resolve(games);
      }
    );
  });
}

// 获取用户的最高得分
function getHighScore(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT MAX(score) as high_score FROM feihua_games WHERE user_id = ?',
      [userId],
      (err, row) => {
        if (err) {
          console.error('获取最高得分失败:', err);
          reject(err);
          return;
        }
        
        resolve(row.high_score || 0);
      }
    );
  });
}

module.exports = {
  saveFeihuaGame,
  getUserFeihuaGames,
  getHighScore
};
