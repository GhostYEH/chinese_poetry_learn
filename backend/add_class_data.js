// 预置班级和学生数据脚本
const { db } = require('./src/utils/db');

// 学生姓名列表
const studentNames = [
  '张三', '李诗涵', '王轩宇', '刘梦琪', '陈浩然',
  '赵雅琪', '孙宇轩', '周雨桐', '吴子豪', '郑梦洁',
  '钱思远', '孙雨欣', '周浩然', '吴梦琪', '郑子豪',
  '王雨桐', '赵思远', '陈雨欣', '刘浩然', '李梦琪'
];

// 班级分布（1-10班，每班1-3人）
const classDistribution = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10];

// 生成随机学习数据
function generateLearningData() {
  // 学习诗词数：10-150首，正态分布
  const poemCount = Math.round(Math.max(10, Math.min(150, 80 + Math.random() * 40 - 20 + (Math.random() * 60 - 30))));
  
  // 总学习时长：300-5000分钟，与诗词数相关
  const studyTime = Math.round(Math.max(300, Math.min(5000, poemCount * 25 + Math.random() * 1000 - 500)));
  
  // 最近学习时间：2026-03-01 至 2026-03-23 之间
  const startDate = new Date('2026-03-01');
  const endDate = new Date('2026-03-23');
  const randomDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
  
  return {
    poemCount,
    studyTime,
    lastStudyTime: randomDate.toISOString()
  };
}

// 初始化班级统计表
function initClassStats() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const stmt = db.prepare('INSERT OR IGNORE INTO class_stats (class_id) VALUES (?)');
      
      // 初始化1-10班
      for (let i = 1; i <= 10; i++) {
        stmt.run(i);
      }

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('成功初始化班级统计表');
          resolve();
        }
      });
    });
  });
}

// 添加学生数据
function addStudents() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const userStmt = db.prepare('INSERT OR IGNORE INTO users (username, email, password_hash, class_id, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(), datetime())');
      const recordStmt = db.prepare('INSERT OR IGNORE INTO learning_records (user_id, poem_id, view_count, study_time, last_view_time) VALUES (?, ?, ?, ?, ?)');
      
      let completed = 0;
      const totalStudents = studentNames.length;
      
      studentNames.forEach((name, index) => {
        const classId = classDistribution[index];
        const email = `student${index + 1}@example.com`;
        const passwordHash = `password${index + 1}`;
        
        // 插入用户
        userStmt.run(name, email, passwordHash, classId, function(err) {
          if (err) {
            console.error('添加学生失败:', err);
            return;
          }
          
          const userId = this.lastID;
          const { poemCount, studyTime, lastStudyTime } = generateLearningData();
          
          // 为每个学生生成学习记录
          for (let i = 1; i <= Math.min(poemCount, 30); i++) {
            const viewCount = Math.floor(Math.random() * 5) + 1;
            const recordStudyTime = Math.floor(studyTime / poemCount) + Math.floor(Math.random() * 10) - 5;
            
            recordStmt.run(userId, i, viewCount, Math.max(1, recordStudyTime), lastStudyTime);
          }
          
          completed++;
          if (completed === totalStudents) {
            recordStmt.finalize();
            console.log('成功添加20个学生数据');
            resolve();
          }
        });
      });
      
      userStmt.finalize();
    });
  });
}

// 更新班级统计数据
function updateClassStats() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 为每个班级更新统计数据
      const updateStmt = db.prepare(`
        UPDATE class_stats 
        SET 
          total_students = (SELECT COUNT(*) FROM users WHERE class_id = ?),
          total_poems_studied = (SELECT SUM(poem_count) FROM v_student_learning_stats WHERE class_id = ?),
          avg_study_time = (SELECT AVG(total_study_time) FROM v_student_learning_stats WHERE class_id = ?),
          avg_completion_rate = 85.5
        WHERE class_id = ?
      `);
      
      let completed = 0;
      const totalClasses = 10;
      
      for (let i = 1; i <= totalClasses; i++) {
        updateStmt.run(i, i, i, i, function(err) {
          if (err) {
            console.error('更新班级统计失败:', err);
            return;
          }
          
          completed++;
          if (completed === totalClasses) {
            updateStmt.finalize();
            console.log('成功更新班级统计数据');
            resolve();
          }
        });
      }
    });
  });
}

// 执行添加数据
async function addClassData() {
  try {
    await initClassStats();
    await addStudents();
    await updateClassStats();
    console.log('所有班级和学生数据添加完成');
    process.exit(0);
  } catch (error) {
    console.error('添加数据失败:', error);
    process.exit(1);
  }
}

// 运行脚本
addClassData();