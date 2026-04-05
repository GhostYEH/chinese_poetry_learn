// 每日打卡与推荐服务
const { db } = require('../utils/db');

/**
 * 获取今日推荐诗词
 */
function getDailyPoem(userId = null) {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    
    // 先检查今日是否已有推荐
    db.get('SELECT * FROM daily_poems WHERE date = ?', [today], (err, dailyRow) => {
      if (err) { reject(err); return; }
      
      if (dailyRow) {
        // 已有今日推荐，获取诗词详情
        db.get(`
          SELECT p.*, dp.theme
          FROM poems p
          JOIN daily_poems dp ON p.id = dp.poem_id
          WHERE p.id = ?
        `, [dailyRow.poem_id], (err, poem) => {
          if (err) { reject(err); return; }
          
          if (poem) {
            resolve({ poem, isNew: false });
          } else {
            // 推荐记录存在但诗词被删除，生成新的
            generateDailyPoem(today).then(resolve).catch(reject);
          }
        });
      } else {
        // 生成新的每日推荐
        generateDailyPoem(today).then(resolve).catch(reject);
      }
    });
  });
}

async function generateDailyPoem(date) {
  return new Promise((resolve, reject) => {
    // 获取随机诗词
    const themes = ['春天', '思乡', '友情', '山水', '励志', '爱国'];
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    
    db.get(`
      SELECT * FROM poems
      WHERE tags LIKE ? OR tags LIKE ?
      ORDER BY RANDOM()
      LIMIT 1
    `, [`%${randomTheme}%`, `%${themes[Math.floor(Math.random() * themes.length)]}%`], (err, poem) => {
      if (err) { reject(err); return; }
      
      if (!poem) {
        // 降级：随机选择任何诗词
        db.get('SELECT * FROM poems ORDER BY RANDOM() LIMIT 1', (err, fallback) => {
          if (err) { reject(err); return; }
          if (fallback) {
            saveDailyPoem(date, fallback.id, fallback.tags).then(() => {
              resolve({ poem: fallback, isNew: true });
            }).catch(reject);
          } else {
            reject(new Error('没有可用的诗词'));
          }
        });
      } else {
        saveDailyPoem(date, poem.id, poem.tags).then(() => {
          resolve({ poem, isNew: true, theme: randomTheme });
        }).catch(reject);
      }
    });
  });
}

function saveDailyPoem(date, poemId, tags) {
  return new Promise((resolve, reject) => {
    const theme = tags ? tags.split(',')[0].trim() : null;
    db.run(`
      INSERT INTO daily_poems (poem_id, date, theme)
      VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        poem_id = excluded.poem_id,
        theme = excluded.theme
    `, [poemId, date, theme], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * 每日打卡
 */
function checkIn(userId, poemId = null) {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    
    db.run(`
      INSERT INTO daily_checkin (user_id, date, poem_id)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        poem_id = COALESCE(excluded.poem_id, poem_id),
        checked_in_at = CURRENT_TIMESTAMP
    `, [userId, today, poemId], (err) => {
      if (err) { reject(err); return; }
      
      // 计算连续打卡天数
      calculateStreak(userId).then(streak => {
        // 记录活动
        logActivity(userId, 'checkin', { date: today, streak });
        resolve({ success: true, streak, date: today });
      }).catch(reject);
    });
  });
}

/**
 * 检查今日是否已打卡
 */
function hasCheckedIn(userId) {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    db.get('SELECT * FROM daily_checkin WHERE user_id = ? AND date = ?', [userId, today], (err, row) => {
      if (err) { reject(err); return; }
      resolve(!!row);
    });
  });
}

/**
 * 获取打卡统计
 */
function getCheckInStats(userId) {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];
    
    Promise.all([
      calculateStreak(userId),
      getTotalCheckInDays(userId),
      hasCheckedIn(userId),
      getRecentCheckIns(userId, 7)
    ]).then(([streak, totalDays, todayChecked, recentCheckins]) => {
      resolve({
        streak,
        totalDays,
        todayChecked,
        recentCheckins,
        monthlyProgress: calculateMonthlyProgress(recentCheckins)
      });
    }).catch(reject);
  });
}

function calculateStreak(userId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT date FROM daily_checkin
      WHERE user_id = ?
      ORDER BY date DESC
    `, [userId], (err, rows) => {
      if (err) { reject(err); return; }
      
      if (!rows || rows.length === 0) {
        resolve(0);
        return;
      }
      
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < rows.length; i++) {
        const checkDate = new Date(rows[i].date);
        checkDate.setHours(0, 0, 0, 0);
        
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);
        
        if (checkDate.getTime() === expectedDate.getTime()) {
          streak++;
        } else if (i === 0 && checkDate.getTime() === expectedDate.getTime() - 86400000) {
          // 昨天打卡了，今天还没打，也算连续
          streak++;
        } else {
          break;
        }
      }
      
      resolve(streak);
    });
  });
}

function getTotalCheckInDays(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM daily_checkin WHERE user_id = ?', [userId], (err, row) => {
      if (err) { reject(err); return; }
      resolve(row?.count || 0);
    });
  });
}

function getRecentCheckIns(userId, days) {
  return new Promise((resolve, reject) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startStr = startDate.toISOString().split('T')[0];
    
    db.all(`
      SELECT date, poem_id FROM daily_checkin
      WHERE user_id = ? AND date >= ?
      ORDER BY date DESC
    `, [userId, startStr], (err, rows) => {
      if (err) { reject(err); return; }
      resolve(rows || []);
    });
  });
}

function calculateMonthlyProgress(recentCheckins) {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  
  const monthDays = recentCheckins.filter(c => c.date >= monthStart);
  return {
    current: monthDays.length,
    target: dayOfMonth,
    percentage: Math.round((monthDays.length / dayOfMonth) * 100),
    remaining: dayOfMonth - monthDays.length
  };
}

/**
 * 记录学习活动
 */
function logActivity(userId, type, data = {}) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO activity_logs (user_id, activity_type, activity_data)
      VALUES (?, ?, ?)
    `, [userId, type, JSON.stringify(data)], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * 获取学习活动历史
 */
function getActivityHistory(userId, days = 30) {
  return new Promise((resolve, reject) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    db.all(`
      SELECT * FROM activity_logs
      WHERE user_id = ? AND created_at >= ?
      ORDER BY created_at DESC
    `, [userId, startDate.toISOString()], (err, rows) => {
      if (err) { reject(err); return; }
      
      // 解析activity_data
      rows = rows.map(row => {
        if (row.activity_data) {
          try {
            row.activity_data = JSON.parse(row.activity_data);
          } catch (e) {}
        }
        return row;
      });
      
      resolve(rows);
    });
  });
}

module.exports = {
  getDailyPoem,
  checkIn,
  hasCheckedIn,
  getCheckInStats,
  getRecentCheckIns,
  logActivity,
  getActivityHistory,
  calculateStreak
};
