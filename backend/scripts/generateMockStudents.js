const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, '../db/poetry.db');

const db = new sqlite3.Database(DB_PATH);

const familyNames = [
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
  '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧',
  '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕',
  '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎'
];

const givenNames = [
  '伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋',
  '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平',
  '刚', '桂英', '华', '玲', '辉', '鹏', '婷', '浩', '宇', '轩',
  '思', '雨', '欣', '怡', '佳', '梦', '雅', '晨', '阳', '雪',
  '琳', '璐', '睿', '博', '昊', '然', '逸', '航', '泽', '铭',
  '诗涵', '子涵', '雨涵', '欣怡', '可馨', '诗琪', '梦琪', '雅婷', '思颖', '梓萌',
  '浩然', '子轩', '宇轩', '浩宇', '梓豪', '子豪', '奕辰', '宇辰', '皓轩', '子墨'
];

const classNames = [
  '高一(1)班', '高一(2)班', '高一(3)班', '高一(4)班', '高一(5)班',
  '高二(1)班', '高二(2)班', '高二(3)班', '高二(4)班', '高二(5)班',
  '高三(1)班', '高三(2)班', '高三(3)班', '高三(4)班', '高三(5)班'
];

const usedNames = new Set();

function randomName() {
  let attempts = 0;
  while (attempts < 100) {
    const family = familyNames[Math.floor(Math.random() * familyNames.length)];
    const given = givenNames[Math.floor(Math.random() * givenNames.length)];
    const name = family + given;
    
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
    attempts++;
  }
  
  const family = familyNames[Math.floor(Math.random() * familyNames.length)];
  const given = givenNames[Math.floor(Math.random() * givenNames.length)];
  const suffix = Math.floor(Math.random() * 100);
  const name = family + given + suffix;
  usedNames.add(name);
  return name;
}

function randomEmail(name) {
  const domains = ['qq.com', '163.com', '126.com', 'gmail.com', 'outlook.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const pinyin = name.split('').map(c => c.charCodeAt(0)).join('');
  const num = Math.floor(Math.random() * 1000);
  return `student${pinyin}${num}@${domain}`;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

async function generateMockData() {
  console.log('开始生成模拟数据...\n');
  
  const passwordHash = await bcrypt.hash('123456', 10);
  
  const classes = classNames.slice(0, 5);
  
  console.log('清理现有数据...');
  
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM user_challenge_records', [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM user_challenge_progress', [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM learning_records', [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM users WHERE id > 0', [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  await new Promise((resolve, reject) => {
    db.run('DELETE FROM class_stats', [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  console.log('✓ 清理完成\n');
  
  for (let i = 0; i < classes.length; i++) {
    const classId = i + 1;
    const className = classes[i];
    
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO class_stats (class_id, total_students, total_poems_studied, avg_study_time, avg_completion_rate) VALUES (?, ?, ?, ?, ?)',
        [classId, 30, 0, 0, 0],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    console.log(`✓ 创建班级: ${className} (ID: ${classId})`);
  }
  
  const students = [];
  let studentCount = 0;
  
  for (let classId = 1; classId <= classes.length; classId++) {
    const studentsInClass = 28 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < studentsInClass; i++) {
      const name = randomName();
      const email = randomEmail(name);
      const createdAt = formatDate(randomDate(new Date(2023, 8, 1), new Date(2024, 0, 1)));
      const updatedAt = createdAt;
      
      const result = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, email, password_hash, class_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [name, email, passwordHash, classId, createdAt, updatedAt],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, name, classId });
          }
        );
      });
      
      students.push(result);
      studentCount++;
    }
    
    console.log(`✓ 为班级 ${classes[classId-1]} 生成 ${studentsInClass} 名学生`);
  }
  
  console.log(`\n总计生成 ${studentCount} 名学生\n`);
  
  const poems = await new Promise((resolve, reject) => {
    db.all('SELECT id FROM poems', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  console.log('开始生成学习记录和闯关数据...\n');
  
  for (const student of students) {
    const studyCount = 5 + Math.floor(Math.random() * 20);
    const studyPoems = poems.sort(() => Math.random() - 0.5).slice(0, studyCount);
    
    for (const poem of studyPoems) {
      const studyTime = 300 + Math.floor(Math.random() * 1800);
      const lastViewTime = formatDate(randomDate(new Date(2024, 0, 1), new Date()));
      
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO learning_records (user_id, poem_id, study_time, last_view_time) VALUES (?, ?, ?, ?)',
          [student.id, poem.id, studyTime, lastViewTime],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    const highestLevel = Math.floor(Math.random() * 150) + 10;
    const currentLevel = Math.max(1, highestLevel - Math.floor(Math.random() * 5));
    const totalErrors = Math.floor(Math.random() * 30);
    const aiHelpUsed = Math.floor(Math.random() * 20);
    const lastChallengeTime = formatDate(randomDate(new Date(2024, 11, 1), new Date()));
    
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO user_challenge_progress (user_id, highest_level, current_challenge_level, last_challenge_time, total_ai_help_used, total_errors) VALUES (?, ?, ?, ?, ?, ?)',
        [student.id, highestLevel, currentLevel, lastChallengeTime, aiHelpUsed, totalErrors],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    const recordCount = highestLevel + Math.floor(Math.random() * 10);
    for (let level = 1; level <= recordCount; level++) {
      const isCorrect = level <= highestLevel ? (Math.random() > 0.3) : false;
      const usedAiHelp = Math.random() > 0.7 ? 1 : 0;
      const answeredAt = formatDate(randomDate(new Date(2024, 0, 1), new Date()));
      
      const poem = poems[Math.floor(Math.random() * poems.length)];
      const poemInfo = await new Promise((resolve, reject) => {
        db.get('SELECT title, author FROM poems WHERE id = ?', [poem.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO user_challenge_records (user_id, level, question_content, user_answer, correct_answer, is_correct, used_ai_help, answered_at, poem_title, poem_author) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            student.id,
            level,
            `第${level}关题目`,
            isCorrect ? '正确答案' : '错误答案',
            '正确答案',
            isCorrect ? 1 : 0,
            usedAiHelp,
            answeredAt,
            poemInfo?.title || '未知',
            poemInfo?.author || '未知'
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    if (student.id % 30 === 0) {
      console.log(`✓ 已处理 ${student.id} 名学生的数据`);
    }
  }
  
  console.log('\n更新班级统计数据...\n');
  
  for (let classId = 1; classId <= classes.length; classId++) {
    const stats = await new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          COUNT(DISTINCT u.id) as total_students,
          COUNT(DISTINCT lr.poem_id) as total_poems,
          COALESCE(AVG(lr.study_time), 0) as avg_time
        FROM users u
        LEFT JOIN learning_records lr ON u.id = lr.user_id
        WHERE u.class_id = ?`,
        [classId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    const completionRate = Math.min(1, (stats.total_poems || 0) / 30);
    
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE class_stats SET total_students = ?, total_poems_studied = ?, avg_study_time = ?, avg_completion_rate = ? WHERE class_id = ?',
        [stats.total_students, stats.total_poems || 0, Math.floor(stats.avg_time || 0), completionRate, classId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    console.log(`✓ 更新班级 ${classes[classId-1]} 统计: ${stats.total_students}人, 学习${stats.total_poems || 0}首诗`);
  }
  
  console.log('\n========================================');
  console.log('✅ 模拟数据生成完成！');
  console.log('========================================');
  console.log(`\n班级数量: ${classes.length}`);
  console.log(`学生总数: ${studentCount}`);
  console.log(`默认密码: 123456`);
  console.log('\n班级列表:');
  classes.forEach((name, i) => {
    console.log(`  ${i + 1}. ${name}`);
  });
  
  db.close();
}

generateMockData().catch(err => {
  console.error('生成数据失败:', err);
  db.close();
});
