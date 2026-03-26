// 能力模型服务
const { db } = require('../utils/db');

/**
 * 计算用户能力模型
 */
function calculateAbilityModel(userId) {
  return new Promise((resolve, reject) => {
    // 并行查询多个数据源
    Promise.all([
      getMemoryScore(userId),
      getUnderstandingScore(userId),
      getApplicationScore(userId),
      getCreativityScore(userId)
    ]).then(([memory, understanding, application, creativity]) => {
      const model = { memory, understanding, application, creativity };
      // 保存到数据库
      saveAbilityModel(userId, model).then(() => {
        resolve(model);
      }).catch(err => {
        console.error('保存能力模型失败:', err);
        resolve(model);
      });
    }).catch(reject);
  });
}

function getMemoryScore(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        COUNT(DISTINCT poem_id) as poems_learned,
        COALESCE(AVG(best_score), 0) as avg_best_score,
        COALESCE(SUM(recite_attempts), 0) as total_attempts,
        COALESCE((SELECT COUNT(*) FROM wrong_questions WHERE user_id = ? AND mastered = 1), 0) as mastered
      FROM learning_records
      WHERE user_id = ?
    `, [userId, userId], (err, row) => {
      if (err) { reject(err); return; }
      
      let score = 0;
      score += Math.min(row.poems_learned * 3, 30);  // 已学诗词数量
      score += Math.min(row.avg_best_score * 0.4, 40); // 最佳得分
      score += Math.min(row.mastered * 5, 30);          // 已掌握数量
      
      resolve(Math.min(100, Math.round(score)));
    });
  });
}

function getUnderstandingScore(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        COALESCE(AVG(CASE WHEN best_score > 0 THEN best_score ELSE NULL END), 0) as avg_score,
        (SELECT COUNT(*) FROM wrong_questions WHERE user_id = ? AND mastered = 0) as wrong_count,
        (SELECT COUNT(*) FROM learning_records WHERE user_id = ? AND ai_explain_count > 0) as explained_count,
        (SELECT COUNT(*) FROM learning_records WHERE user_id = ? AND view_count > 3) as deeply_viewed
      FROM learning_records
      WHERE user_id = ?
    `, [userId, userId, userId, userId], (err, row) => {
      if (err) { reject(err); return; }
      
      let score = 0;
      score += Math.min(row.avg_score * 0.5, 50);       // 平均得分
      score += Math.max(0, 30 - row.wrong_count * 3);   // 错题扣分
      score += Math.min(row.explained_count * 5, 20);   // AI讲解次数
      score += Math.min(row.deeply_viewed * 5, 20);      // 深度学习
      
      resolve(Math.min(100, Math.max(0, Math.round(score))));
    });
  });
}

function getApplicationScore(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        (SELECT COALESCE(current_challenge_level, 1) FROM user_challenge_progress WHERE user_id = ?) as challenge_level,
        (SELECT COALESCE(MAX(max_rounds), 0) FROM feihua_high_records WHERE user_id = ?) as max_rounds,
        (SELECT COUNT(*) FROM feihua_battles WHERE (player1_id = ? OR player2_id = ?) AND winner_id = ?) as wins,
        (SELECT COUNT(*) FROM user_challenge_records WHERE user_id = ? AND is_correct = 1) as correct_answers
      FROM learning_records
      LIMIT 1
    `, [userId, userId, userId, userId, userId, userId], (err, row) => {
      if (err) { reject(err); return; }
      
      let score = 0;
      score += Math.min(row.challenge_level * 0.8, 40);   // 闯关等级
      score += Math.min(row.max_rounds * 2, 20);           // 飞花令最高轮次
      score += Math.min(row.correct_answers * 0.2, 20);   // 正确答题数
      score += Math.min(row.wins * 2, 20);                 // 胜场数
      
      resolve(Math.min(100, Math.max(0, Math.round(score))));
    });
  });
}

function getCreativityScore(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        (SELECT COALESCE(COUNT(*), 0) FROM user_creations WHERE user_id = ?) as creations_count,
        (SELECT COALESCE(MAX(score_data->>'$.user_score'), 0) FROM user_creations WHERE user_id = ? AND score_data IS NOT NULL) as max_creation_score,
        (SELECT COALESCE(AVG(CAST(json_extract(score_data, '$.user_score') AS INTEGER)), 0) FROM user_creations WHERE user_id = ? AND score_data IS NOT NULL) as avg_creation_score,
        (SELECT COALESCE(COUNT(*), 0) FROM poetry_challenges WHERE user_id = ? AND user_score > 0) as challenge_participations
      FROM learning_records
      LIMIT 1
    `, [userId, userId, userId, userId], (err, row) => {
      if (err) { reject(err); return; }
      
      let score = 0;
      score += Math.min(row.creations_count * 5, 25);     // 创作次数
      score += Math.min(row.max_creation_score * 0.25, 25); // 最高创作得分
      score += Math.min(row.avg_creation_score * 0.25, 25); // 平均创作得分
      score += Math.min(row.challenge_participations * 5, 25); // 挑战参与
      
      resolve(Math.min(100, Math.max(0, Math.round(score))));
    });
  });
}

function saveAbilityModel(userId, model) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO ability_assessments 
        (user_id, memory_score, understanding_score, application_score, creativity_score, last_updated)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        memory_score = excluded.memory_score,
        understanding_score = excluded.understanding_score,
        application_score = excluded.application_score,
        creativity_score = excluded.creativity_score,
        last_updated = CURRENT_TIMESTAMP
    `, [userId, model.memory, model.understanding, model.application, model.creativity], (err) => {
      if (err) { reject(err); return; }
      resolve();
    });
  });
}

/**
 * 获取用户能力模型
 */
function getAbilityModel(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        memory_score as memory,
        understanding_score as understanding,
        application_score as application,
        creativity_score as creativity,
        last_updated
      FROM ability_assessments
      WHERE user_id = ?
    `, [userId], async (err, row) => {
      if (err) { reject(err); return; }
      
      if (row) {
        resolve(row);
      } else {
        // 如果没有记录，计算并返回
        const model = await calculateAbilityModel(userId);
        resolve({ ...model, last_updated: new Date().toISOString() });
      }
    });
  });
}

/**
 * 获取能力模型历史趋势
 */
function getAbilityTrend(userId, days = 30) {
  return new Promise((resolve, reject) => {
    // 简化的趋势数据生成（基于活动日志）
    db.all(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as activity_count
      FROM activity_logs
      WHERE user_id = ? AND created_at >= DATE('now', '-${days} days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [userId], (err, rows) => {
      if (err) { reject(err); return; }
      
      // 填充缺失的日期
      const trend = [];
      const today = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const found = rows.find(r => r.date === dateStr);
        trend.push({
          date: dateStr,
          activityCount: found ? found.activity_count : 0
        });
      }
      
      resolve(trend);
    });
  });
}

/**
 * 获取能力排名
 */
function getAbilityRanking(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      WITH user_scores AS (
        SELECT 
          user_id,
          memory_score + understanding_score + application_score + creativity_score as total_score
        FROM ability_assessments
      )
      SELECT COUNT(*) + 1 as rank
      FROM user_scores
      WHERE total_score > (
        SELECT COALESCE(memory_score + understanding_score + application_score + creativity_score, 0)
        FROM ability_assessments
        WHERE user_id = ?
      )
    `, [userId], (err, row) => {
      if (err) { reject(err); return; }
      resolve({ rank: row?.rank || 1 });
    });
  });
}

module.exports = {
  calculateAbilityModel,
  getAbilityModel,
  getAbilityTrend,
  getAbilityRanking,
  getMemoryScore,
  getUnderstandingScore,
  getApplicationScore,
  getCreativityScore
};
