// 智能错题复习服务
const { db } = require('../utils/db');

/**
 * 获取今日复习任务
 */
function getTodayReviewTasks(userId) {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    
    db.all(`
      SELECT * FROM review_schedules
      WHERE user_id = ? AND scheduled_date <= ? AND mastered = 0
      ORDER BY scheduled_date ASC, review_count ASC
      LIMIT 20
    `, [userId, today], (err, rows) => {
      if (err) { reject(err); return; }
      
      if (rows.length === 0) {
        // 生成新的复习任务
        generateReviewTasks(userId).then(resolve).catch(reject);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * 根据艾宾浩斯遗忘曲线生成复习任务
 */
async function generateReviewTasks(userId) {
  // 获取需要复习的诗词
  const poemsToReview = await getPoemsForReview(userId);
  
  if (poemsToReview.length === 0) return [];
  
  const today = new Date();
  const schedules = [];
  
  // 间隔天数序列（艾宾浩斯）
  const intervals = [1, 3, 7, 14, 30, 60];
  
  for (const poem of poemsToReview) {
    const reviewCount = poem.review_count || 0;
    const interval = intervals[Math.min(reviewCount, intervals.length - 1)];
    
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + interval);
    
    const schedule = {
      user_id: userId,
      poem_id: poem.poem_id,
      scheduled_date: nextDate.toISOString().split('T')[0],
      review_count: reviewCount,
      interval_days: interval
    };
    
    await saveReviewSchedule(schedule);
    schedules.push(schedule);
  }
  
  return schedules;
}

function getPoemsForReview(userId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        lr.poem_id,
        p.title,
        p.author,
        p.content,
        lr.best_score,
        lr.last_view_time,
        COALESCE(wq.wrong_count, 0) as wrong_count,
        COALESCE(wq.correct_streak, 0) as correct_streak,
        COALESCE(
          (SELECT review_count FROM review_schedules WHERE user_id = ? AND poem_id = lr.poem_id),
          0
        ) as review_count
      FROM learning_records lr
      JOIN poems p ON lr.poem_id = p.id
      LEFT JOIN wrong_questions wq ON wq.user_id = ? AND wq.question LIKE '%' || p.title || '%'
      WHERE lr.user_id = ? AND lr.recite_attempts > 0
      ORDER BY 
        COALESCE(wq.wrong_count, 0) DESC,
        lr.best_score ASC,
        lr.last_view_time ASC
      LIMIT 10
    `, [userId, userId, userId], (err, rows) => {
      if (err) { reject(err); return; }
      resolve(rows);
    });
  });
}

function saveReviewSchedule(schedule) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO review_schedules 
        (user_id, poem_id, scheduled_date, review_count, interval_days)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, poem_id) DO UPDATE SET
        scheduled_date = excluded.scheduled_date,
        review_count = excluded.review_count,
        interval_days = excluded.interval_days
    `, [schedule.user_id, schedule.poem_id, schedule.scheduled_date, schedule.review_count, schedule.interval_days], 
    (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * 完成复习后更新
 */
function completeReview(userId, poemId, correct) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM review_schedules WHERE user_id = ? AND poem_id = ?', [userId, poemId], (err, schedule) => {
      if (err) { reject(err); return; }
      
      if (!schedule) {
        resolve({ success: false, message: '复习任务不存在' });
        return;
      }
      
      const intervals = [1, 3, 7, 14, 30, 60];
      let newCount = schedule.review_count;
      let newInterval = schedule.interval_days;
      let mastered = 0;
      
      if (correct) {
        newCount++;
        // 如果连续答对3次，标记为已掌握
        if (newCount >= 6) {
          mastered = 1;
          newInterval = 0;
        } else {
          newInterval = intervals[Math.min(newCount, intervals.length - 1)];
        }
      } else {
        // 答错则重新开始
        newCount = 1;
        newInterval = intervals[0];
      }
      
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + newInterval);
      
      db.run(`
        UPDATE review_schedules
        SET review_count = ?,
            interval_days = ?,
            next_review = ?,
            mastered = ?
        WHERE user_id = ? AND poem_id = ?
      `, [newCount, newInterval, nextDate.toISOString().split('T')[0], mastered, userId, poemId], 
      (err) => {
        if (err) { reject(err); return; }
        resolve({
          success: true,
          mastered,
          nextReview: mastered ? null : nextDate.toISOString().split('T')[0]
        });
      });
    });
  });
}

/**
 * 获取复习统计
 */
function getReviewStats(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN mastered = 0 THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN mastered = 1 THEN 1 ELSE 0 END) as mastered,
        SUM(CASE WHEN scheduled_date <= date('now') AND mastered = 0 THEN 1 ELSE 0 END) as overdue
      FROM review_schedules
      WHERE user_id = ?
    `, [userId], (err, row) => {
      if (err) { reject(err); return; }
      resolve(row || { total_tasks: 0, pending: 0, mastered: 0, overdue: 0 });
    });
  });
}

/**
 * 获取未来复习计划
 */
function getFuturePlan(userId, days = 7) {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    db.all(`
      SELECT 
        scheduled_date,
        COUNT(*) as count,
        GROUP_CONCAT(poem_id) as poem_ids
      FROM review_schedules
      WHERE user_id = ? AND scheduled_date BETWEEN ? AND ?
      GROUP BY scheduled_date
      ORDER BY scheduled_date
    `, [userId, today, endDate.toISOString().split('T')[0]], (err, rows) => {
      if (err) { reject(err); return; }
      
      // 填充缺失的日期
      const plan = [];
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const found = rows.find(r => r.scheduled_date === dateStr);
        plan.push({
          date: dateStr,
          count: found ? found.count : 0,
          poemIds: found ? found.poem_ids.split(',').map(Number) : []
        });
      }
      
      resolve(plan);
    });
  });
}

/**
 * 为错题分配类别
 */
function categorizeWrongQuestion(userId, questionId, category) {
  return new Promise((resolve, reject) => {
    const validCategories = ['记忆错误', '理解错误', '应用错误', '粗心错误'];
    if (!validCategories.includes(category)) {
      resolve({ success: false, message: '无效的分类' });
      return;
    }
    
    db.run(`
      INSERT INTO wrong_question_categories (user_id, question_id, category)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, question_id) DO UPDATE SET
        category = excluded.category,
        created_at = CURRENT_TIMESTAMP
    `, [userId, questionId, category], (err) => {
      if (err) { reject(err); return; }
      resolve({ success: true });
    });
  });
}

/**
 * 获取错题分类统计
 */
function getWrongQuestionCategories(userId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        wqc.category,
        COUNT(*) as count
      FROM wrong_question_categories wqc
      WHERE wqc.user_id = ?
      GROUP BY wqc.category
      ORDER BY count DESC
    `, [userId], (err, rows) => {
      if (err) { reject(err); return; }
      
      const stats = {
        '记忆错误': 0,
        '理解错误': 0,
        '应用错误': 0,
        '粗心错误': 0,
        '未分类': 0
      };
      
      rows.forEach(row => {
        if (stats.hasOwnProperty(row.category)) {
          stats[row.category] = row.count;
        }
      });
      
      // 计算未分类数量
      db.get(`
        SELECT COUNT(*) as uncategorized
        FROM wrong_questions wq
        WHERE wq.user_id = ?
          AND wq.mastered = 0
          AND NOT EXISTS (
            SELECT 1 FROM wrong_question_categories wqc 
            WHERE wqc.question_id = wq.id
          )
      `, [userId], (err, row) => {
        if (!err && row) {
          stats['未分类'] = row.uncategorized;
        }
        resolve(stats);
      });
    });
  });
}

module.exports = {
  getTodayReviewTasks,
  generateReviewTasks,
  completeReview,
  getReviewStats,
  getFuturePlan,
  categorizeWrongQuestion,
  getWrongQuestionCategories
};
