// 教师数据分析服务
const { db } = require('../utils/db');

/**
 * 获取班级薄弱点分析
 */
function getClassWeakPoints(classId, teacherId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        wq.title,
        wq.author,
        wq.question,
        COUNT(*) as wrong_count,
        GROUP_CONCAT(DISTINCT u.username) as affected_students
      FROM wrong_questions wq
      JOIN users u ON wq.user_id = u.id
      JOIN classes c ON u.class_id = c.id
      WHERE c.id = ? AND c.teacher_id = ? AND wq.mastered = 0
      GROUP BY wq.title, wq.author, wq.question
      ORDER BY wrong_count DESC
      LIMIT 10
    `, [classId, teacherId], (err, rows) => {
      if (err) { reject(err); return; }
      
      // 分析主题薄弱点
      db.all(`
        SELECT 
          p.tags,
          COUNT(*) as error_count
        FROM wrong_questions wq
        JOIN users u ON wq.user_id = u.id
        JOIN classes c ON u.class_id = c.id
        JOIN poems p ON wq.title = p.title
        WHERE c.id = ? AND c.teacher_id = ? AND wq.mastered = 0 AND p.tags IS NOT NULL
        GROUP BY p.tags
        ORDER BY error_count DESC
        LIMIT 5
      `, [classId, teacherId], (err, tagStats) => {
        if (err) { reject(err); return; }
        
        resolve({
          poemWeakPoints: rows.map(r => ({
            ...r,
            affected_students: (r.affected_students || '').split(',').filter(Boolean)
          })),
          themeWeakPoints: tagStats.map(t => {
            const tags = (t.tags || '').split(',');
            return {
              theme: tags[0]?.trim() || '未知',
              error_count: t.error_count
            };
          })
        });
      });
    });
  });
}

/**
 * 获取学生预警列表
 */
function getStudentAlerts(classId, teacherId) {
  return new Promise((resolve, reject) => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    db.all(`
      SELECT 
        u.id as user_id,
        u.username,
        COALESCE(AVG(lr.best_score), 0) as avg_score,
        MAX(lr.last_view_time) as last_study_time,
        (SELECT COUNT(*) FROM wrong_questions WHERE user_id = u.id AND mastered = 0) as wrong_count,
        (SELECT COUNT(*) FROM daily_checkin WHERE user_id = u.id AND date >= date('now', '-3 days')) as recent_checkins
      FROM users u
      JOIN classes c ON u.class_id = c.id
      LEFT JOIN learning_records lr ON u.id = lr.user_id
      WHERE c.id = ? AND c.teacher_id = ?
      GROUP BY u.id, u.username
    `, [classId, teacherId], (err, rows) => {
      if (err) { reject(err); return; }
      
      const alerts = rows.map(student => {
        const alerts = [];
        
        // 3天未学习
        if (!student.last_study_time || new Date(student.last_study_time) < threeDaysAgo) {
          alerts.push({ type: 'danger', message: '3天以上未学习', icon: '⚠️' });
        }
        
        // 正确率低于60%
        if (student.avg_score > 0 && student.avg_score < 60) {
          alerts.push({ type: 'warning', message: `正确率偏低(${Math.round(student.avg_score)}%)`, icon: '📉' });
        }
        
        // 错题过多
        if (student.wrong_count > 10) {
          alerts.push({ type: 'info', message: `错题过多(${student.wrong_count}题)`, icon: '❌' });
        }
        
        return {
          ...student,
          alerts,
          alertLevel: alerts.some(a => a.type === 'danger') ? 'danger' : 
                      alerts.some(a => a.type === 'warning') ? 'warning' : 'normal'
        };
      });
      
      // 按预警级别排序
      alerts.sort((a, b) => {
        const order = { danger: 0, warning: 1, info: 2, normal: 3 };
        return order[a.alertLevel] - order[b.alertLevel];
      });
      
      resolve(alerts);
    });
  });
}

/**
 * 创建教师任务
 */
function createTask(teacherId, taskData) {
  return new Promise((resolve, reject) => {
    const { class_id, target_user_id, title, content, task_type, level_start, level_end, deadline } = taskData;
    
    db.run(`
      INSERT INTO teacher_tasks 
        (teacher_id, class_id, target_user_id, title, content, task_type, level_start, level_end, deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [teacherId, class_id || null, target_user_id || null, title, content || null, 
        task_type || 'general', level_start || null, level_end || null, deadline || null],
    function(err) {
      if (err) { reject(err); return; }
      resolve({ success: true, taskId: this.lastID });
    });
  });
}

/**
 * 获取班级任务列表
 */
function getClassTasks(classId, teacherId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT tt.*, c.class_name
      FROM teacher_tasks tt
      LEFT JOIN classes c ON tt.class_id = c.id
      WHERE tt.teacher_id = ? AND (tt.class_id = ? OR tt.target_user_id IN (SELECT id FROM users WHERE class_id = ?))
      ORDER BY tt.created_at DESC
    `, [teacherId, classId, classId], (err, rows) => {
      if (err) { reject(err); return; }
      resolve(rows);
    });
  });
}

/**
 * 获取学生学习趋势
 */
function getClassLearningTrend(classId, teacherId, days = 30) {
  return new Promise((resolve, reject) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    db.all(`
      SELECT 
        DATE(al.created_at) as date,
        al.activity_type,
        COUNT(*) as count
      FROM activity_logs al
      JOIN users u ON al.user_id = u.id
      JOIN classes c ON u.class_id = c.id
      WHERE c.id = ? AND c.teacher_id = ? AND al.created_at >= ?
      GROUP BY DATE(al.created_at), al.activity_type
      ORDER BY date
    `, [classId, teacherId, startDate.toISOString()], (err, rows) => {
      if (err) { reject(err); return; }
      
      // 整理成趋势数据
      const trend = {};
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        trend[dateStr] = { date: dateStr, checkin: 0, learn: 0, challenge: 0, feihua: 0 };
      }
      
      rows.forEach(row => {
        if (trend[row.date]) {
          const typeMap = { checkin: 'checkin', view: 'learn', recite: 'learn', ai_explain: 'learn' };
          const category = typeMap[row.activity_type] || row.activity_type;
          trend[row.date][category] = (trend[row.date][category] || 0) + row.count;
        }
      });
      
      resolve(Object.values(trend));
    });
  });
}

/**
 * 获取班级诗词掌握情况
 */
function getClassPoemMastery(classId, teacherId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        p.id,
        p.title,
        p.author,
        COUNT(DISTINCT lr.user_id) as students_learned,
        ROUND(AVG(lr.best_score), 1) as avg_score,
        SUM(CASE WHEN lr.best_score = 100 THEN 1 ELSE 0 END) as mastered_count
      FROM poems p
      LEFT JOIN learning_records lr ON p.id = lr.poem_id
      LEFT JOIN users u ON lr.user_id = u.id
      LEFT JOIN classes c ON u.class_id = c.id
      WHERE c.id = ? AND c.teacher_id = ?
      GROUP BY p.id
      ORDER BY avg_score ASC, students_learned ASC
      LIMIT 20
    `, [classId, teacherId], (err, rows) => {
      if (err) { reject(err); return; }
      resolve(rows);
    });
  });
}

/**
 * 获取班级整体统计
 */
function getClassOverview(classId, teacherId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        COUNT(DISTINCT u.id) as total_students,
        (SELECT COUNT(DISTINCT user_id) FROM activity_logs al
         JOIN users u ON al.user_id = u.id
         JOIN classes c ON u.class_id = c.id
         WHERE c.id = ? AND al.created_at >= date('now', '-7 days')) as active_students,
        (SELECT COUNT(DISTINCT lr.user_id) FROM learning_records lr
         JOIN users u ON lr.user_id = u.id
         WHERE u.class_id = ?) as learning_students,
        (SELECT ROUND(AVG(best_score), 1) FROM learning_records lr
         JOIN users u ON lr.user_id = u.id
         WHERE u.class_id = ? AND lr.best_score > 0) as avg_score,
        (SELECT COUNT(*) FROM wrong_questions wq
         JOIN users u ON wq.user_id = u.id
         WHERE u.class_id = ? AND wq.mastered = 0) as total_errors,
        (SELECT COUNT(DISTINCT DATE(dc.date)) FROM daily_checkin dc
         JOIN users u ON dc.user_id = u.id
         WHERE u.class_id = ? AND dc.date >= date('now', '-7 days')) as checkin_days
      FROM classes c
      WHERE c.id = ? AND c.teacher_id = ?
    `, [classId, classId, classId, classId, classId, classId, teacherId], (err, row) => {
      if (err) { reject(err); return; }
      resolve(row || {});
    });
  });
}

module.exports = {
  getClassWeakPoints,
  getStudentAlerts,
  createTask,
  getClassTasks,
  getClassLearningTrend,
  getClassPoemMastery,
  getClassOverview
};
