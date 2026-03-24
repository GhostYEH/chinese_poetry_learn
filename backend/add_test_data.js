// 添加测试数据脚本
const { db } = require('./src/utils/db');

// 添加学生用户
function addTestUsers() {
  return new Promise((resolve, reject) => {
    const users = [
      { username: '学生1', email: 'student1@example.com', password_hash: 'password1' },
      { username: '学生2', email: 'student2@example.com', password_hash: 'password2' },
      { username: '学生3', email: 'student3@example.com', password_hash: 'password3' },
      { username: '学生4', email: 'student4@example.com', password_hash: 'password4' },
      { username: '学生5', email: 'student5@example.com', password_hash: 'password5' }
    ];

    db.serialize(() => {
      const stmt = db.prepare('INSERT OR IGNORE INTO users (username, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, datetime(), datetime())');
      
      users.forEach(user => {
        stmt.run(user.username, user.email, user.password_hash);
      });

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('成功添加测试学生用户');
          resolve();
        }
      });
    });
  });
}

// 添加学习记录
function addTestLearningRecords() {
  return new Promise((resolve, reject) => {
    // 获取当前日期和昨天的日期
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();

    // 学习记录数据
    const records = [
      // 学生1的记录
      { user_id: 1, poem_id: 1, view_count: 5, ai_explain_count: 2, recite_attempts: 3, best_score: 85, total_score: 200, study_time: 1200, last_view_time: today },
      { user_id: 1, poem_id: 2, view_count: 3, ai_explain_count: 1, recite_attempts: 2, best_score: 75, total_score: 120, study_time: 800, last_view_time: today },
      { user_id: 1, poem_id: 3, view_count: 4, ai_explain_count: 1, recite_attempts: 1, best_score: 60, total_score: 60, study_time: 600, last_view_time: yesterday },
      
      // 学生2的记录
      { user_id: 2, poem_id: 2, view_count: 2, ai_explain_count: 0, recite_attempts: 1, best_score: 50, total_score: 50, study_time: 300, last_view_time: today },
      { user_id: 2, poem_id: 4, view_count: 6, ai_explain_count: 3, recite_attempts: 4, best_score: 90, total_score: 280, study_time: 1500, last_view_time: today },
      
      // 学生3的记录
      { user_id: 3, poem_id: 1, view_count: 1, ai_explain_count: 0, recite_attempts: 0, best_score: 0, total_score: 0, study_time: 100, last_view_time: lastWeek },
      { user_id: 3, poem_id: 5, view_count: 3, ai_explain_count: 1, recite_attempts: 2, best_score: 70, total_score: 120, study_time: 700, last_view_time: lastWeek },
      
      // 学生4的记录
      { user_id: 4, poem_id: 3, view_count: 4, ai_explain_count: 2, recite_attempts: 3, best_score: 80, total_score: 180, study_time: 1000, last_view_time: today },
      { user_id: 4, poem_id: 6, view_count: 5, ai_explain_count: 2, recite_attempts: 3, best_score: 85, total_score: 210, study_time: 1100, last_view_time: today },
      { user_id: 4, poem_id: 7, view_count: 2, ai_explain_count: 1, recite_attempts: 1, best_score: 65, total_score: 65, study_time: 400, last_view_time: yesterday },
      
      // 学生5的记录
      { user_id: 5, poem_id: 4, view_count: 3, ai_explain_count: 1, recite_attempts: 2, best_score: 75, total_score: 130, study_time: 800, last_view_time: today },
      { user_id: 5, poem_id: 8, view_count: 4, ai_explain_count: 2, recite_attempts: 3, best_score: 80, total_score: 180, study_time: 900, last_view_time: today },
      { user_id: 5, poem_id: 9, view_count: 2, ai_explain_count: 0, recite_attempts: 1, best_score: 55, total_score: 55, study_time: 300, last_view_time: yesterday },
      { user_id: 5, poem_id: 10, view_count: 3, ai_explain_count: 1, recite_attempts: 2, best_score: 70, total_score: 120, study_time: 600, last_view_time: yesterday }
    ];

    db.serialize(() => {
      const stmt = db.prepare('INSERT OR IGNORE INTO learning_records (user_id, poem_id, view_count, ai_explain_count, recite_attempts, best_score, total_score, study_time, last_view_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      
      records.forEach(record => {
        stmt.run(
          record.user_id, record.poem_id, record.view_count, record.ai_explain_count, 
          record.recite_attempts, record.best_score, record.total_score, record.study_time, record.last_view_time
        );
      });

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('成功添加测试学习记录');
          resolve();
        }
      });
    });
  });
}

// 添加教师用户
function addTestTeachers() {
  return new Promise((resolve, reject) => {
    const teachers = [
      { username: 'teacher', password: '123456' }
    ];

    db.serialize(() => {
      const stmt = db.prepare('INSERT OR IGNORE INTO teachers (username, password) VALUES (?, ?)');
      
      teachers.forEach(teacher => {
        stmt.run(teacher.username, teacher.password);
      });

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('成功添加测试教师用户');
          resolve();
        }
      });
    });
  });
}

// 执行添加测试数据
async function addTestData() {
  try {
    await addTestUsers();
    await addTestLearningRecords();
    await addTestTeachers();
    console.log('所有测试数据添加完成');
    process.exit(0);
  } catch (error) {
    console.error('添加测试数据失败:', error);
    process.exit(1);
  }
}

// 运行脚本
addTestData();