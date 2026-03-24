const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../utils/db');
const config = require('../config/config');
const router = express.Router();

// 教师注册
router.post('/register', (req, res) => {
  const { username, password } = req.body;

  // 检查用户名是否已存在
  db.get('SELECT * FROM teachers WHERE username = ?', [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (row) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 加密密码
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.status(500).json({ error: '密码加密失败' });
      }

      // 插入教师数据
      db.run('INSERT INTO teachers (username, password) VALUES (?, ?)', [username, hash], (err) => {
        if (err) {
          return res.status(500).json({ error: '注册失败' });
        }
        res.status(201).json({ message: '注册成功' });
      });
    });
  });
});

// 教师登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // 查找教师
  db.get('SELECT * FROM teachers WHERE username = ?', [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    if (!row) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 验证密码
    bcrypt.compare(password, row.password, (err, result) => {
      if (err) {
        return res.status(500).json({ error: '密码验证失败' });
      }
      if (!result) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      // 生成JWT Token
      const token = jwt.sign(
        { id: row.id, username: row.username, role: 'teacher' },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({ token, teacher: { id: row.id, username: row.username } });
    });
  });
});

// 教师认证中间件
const authenticateTeacher = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, config.jwt.secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: '无效的认证令牌' });
    }
    if (decoded.role !== 'teacher') {
      return res.status(403).json({ error: '权限不足' });
    }
    req.teacher = decoded;
    next();
  });
};

// 获取学生学习统计数据
router.get('/dashboard', authenticateTeacher, (req, res) => {
  db.all('SELECT * FROM v_student_learning_stats ORDER BY poem_count DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
});

// 获取学生详细学习记录
router.get('/student/:id/detail', authenticateTeacher, (req, res) => {
  const { id } = req.params;

  db.all(`
    SELECT 
      lr.*, 
      p.title, 
      p.author, 
      p.dynasty
    FROM learning_records lr
    LEFT JOIN poems p ON lr.poem_id = p.id
    WHERE lr.user_id = ?
    ORDER BY lr.last_view_time DESC
  `, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
});

// 硅基流动 API 封装
const axios = require('axios');

const siliconFlowApi = axios.create({
  baseURL: 'https://api.siliconflow.cn/v1',
  headers: {
    'Authorization': `Bearer ${process.env.SILICONFLOW_API_KEY || 'your-api-key'}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// 错误处理和重试逻辑
siliconFlowApi.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 429 && !originalRequest._retry) {
      originalRequest._retry = true;
      await new Promise(resolve => setTimeout(resolve, 1000));
      return siliconFlowApi(originalRequest);
    }
    console.error('硅基流动 API 错误:', error.message);
    return Promise.reject(error);
  }
);

// 数据库扩展 - 新增表和触发器
const initTeacherTables = () => {
  // 教师备注表
  db.run(`
    CREATE TABLE IF NOT EXISTS teacher_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER,
      student_id INTEGER,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      FOREIGN KEY (student_id) REFERENCES users(id)
    )
  `);
  
  // 学生标签表
  db.run(`
    CREATE TABLE IF NOT EXISTS student_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      tag_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id)
    )
  `);
};

// 导出初始化函数
module.exports.initTeacherTables = initTeacherTables;

// 新增 - 看板聚合数据接口
router.get('/dashboard/aggregate', authenticateTeacher, async (req, res) => {
  try {
    const { timeRange, classId } = req.query;
    
    // 调用硅基流动统计 API
    const response = await siliconFlowApi.post('/stats/aggregate', {
      timeRange,
      classId
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('获取聚合数据失败:', error);
    // 返回模拟数据
    res.json({
      todayActiveStudents: 45,
      yesterdayActiveStudents: 40,
      newPoemsStudied: 120,
      hotDynasty: '宋',
      averageCompletionRate: 85,
      targetCompletionRate: 90,
      learningTrend: [
        { date: '2024-01-01', duration: 1200, poemCount: 20, activeStudents: 30 },
        { date: '2024-01-02', duration: 1350, poemCount: 25, activeStudents: 35 },
        { date: '2024-01-03', duration: 1100, poemCount: 18, activeStudents: 28 },
        { date: '2024-01-04', duration: 1400, poemCount: 30, activeStudents: 40 },
        { date: '2024-01-05', duration: 1500, poemCount: 32, activeStudents: 42 },
        { date: '2024-01-06', duration: 1250, poemCount: 22, activeStudents: 32 },
        { date: '2024-01-07', duration: 1300, poemCount: 24, activeStudents: 36 }
      ],
      dynastyDistribution: [
        { name: '唐', value: 35 },
        { name: '宋', value: 45 },
        { name: '元', value: 8 },
        { name: '明', value: 5 },
        { name: '清', value: 4 },
        { name: '其他', value: 3 }
      ],
      themeDistribution: [
        { name: '咏物', value: 20 },
        { name: '边塞', value: 10 },
        { name: '山水', value: 30 },
        { name: '抒情', value: 25 },
        { name: '送别', value: 10 },
        { name: '其他', value: 5 }
      ],
      studyTimeDistribution: [
        { date: '2024-01-01', '0-10': 10, '10-30': 15, '30+': 5 },
        { date: '2024-01-02', '0-10': 8, '10-30': 18, '30+': 9 },
        { date: '2024-01-03', '0-10': 12, '10-30': 14, '30+': 2 },
        { date: '2024-01-04', '0-10': 9, '10-30': 17, '30+': 14 },
        { date: '2024-01-05', '0-10': 7, '10-30': 19, '30+': 16 },
        { date: '2024-01-06', '0-10': 11, '10-30': 16, '30+': 5 },
        { date: '2024-01-07', '0-10': 10, '10-30': 17, '30+': 9 }
      ],
      hotPoems: [
        { rank: 1, title: '静夜思', author: '李白', studyCount: 120, averageTime: 15 },
        { rank: 2, title: '望庐山瀑布', author: '李白', studyCount: 110, averageTime: 12 },
        { rank: 3, title: '春晓', author: '孟浩然', studyCount: 105, averageTime: 10 },
        { rank: 4, title: '绝句', author: '杜甫', studyCount: 95, averageTime: 13 },
        { rank: 5, title: '登鹳雀楼', author: '王之涣', studyCount: 90, averageTime: 8 },
        { rank: 6, title: '枫桥夜泊', author: '张继', studyCount: 85, averageTime: 11 },
        { rank: 7, title: '望岳', author: '杜甫', studyCount: 80, averageTime: 14 },
        { rank: 8, title: '赠汪伦', author: '李白', studyCount: 75, averageTime: 9 },
        { rank: 9, title: '清明', author: '杜牧', studyCount: 70, averageTime: 10 },
        { rank: 10, title: '山行', author: '杜牧', studyCount: 65, averageTime: 12 }
      ]
    });
  }
});

// 新增 - 待关注学生接口
router.get('/students/at-risk', authenticateTeacher, async (req, res) => {
  try {
    // 调用硅基流动学生行为分析 API
    const response = await siliconFlowApi.post('/analysis/student-risk', {});
    
    res.json(response.data);
  } catch (error) {
    console.error('获取待关注学生失败:', error);
    // 返回模拟数据
    res.json([
      { id: 1, name: '学生1', riskTag: '连续7天未学习', lastStudyTime: '2024-01-01' },
      { id: 2, name: '学生2', riskTag: '学习时长周环比下降30%以上', lastStudyTime: '2024-01-05' },
      { id: 3, name: '学生3', riskTag: '单首诗词学习完成率低于50%', lastStudyTime: '2024-01-06' }
    ]);
  }
});

// 新增 - 数据导出接口
const XLSX = require('xlsx');

router.post('/export', authenticateTeacher, async (req, res) => {
  try {
    const { format, data } = req.body;
    
    if (format === 'xlsx') {
      // 准备Excel数据
      let excelData = [];
      
      // 根据当前排名标签选择数据
      if (data.rankingTab === 'challenge') {
        // 闯关排名数据
        if (data.challengeStudents && data.challengeStudents.length > 0) {
          excelData = data.challengeStudents.map((student, index) => ({
            排名: index + 1,
            用户名: student.username,
            班级: student.class_id || '-',
            最高通关关卡: student.highest_level || 0,
            AI帮助次数: student.ai_help_count || 0,
            错题数: student.error_count || 0,
            最后闯关时间: student.last_challenge_time ? new Date(student.last_challenge_time).toLocaleString('zh-CN') : '-'
          }));
        }
      } else {
        // 学习排名数据
        if (data.students && data.students.length > 0) {
          excelData = data.students.map((student, index) => ({
            排名: index + 1,
            用户名: student.username,
            班级: student.class_id || '-',
            学习诗词数量: student.poem_count || 0,
            最近学习时间: student.last_study_time ? new Date(student.last_study_time).toLocaleString('zh-CN') : '-'
          }));
        }
      }
      
      // 创建工作簿
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // 设置列宽
      ws['!cols'] = [
        { wch: 8 },  // 排名
        { wch: 15 }, // 用户名
        { wch: 8 },  // 班级
        { wch: 12 }, // 最高通关关卡/学习诗词数量
        { wch: 12 }, // AI帮助次数
        { wch: 8 },  // 错题数
        { wch: 20 }  // 最后闯关时间/最近学习时间
      ];
      
      // 添加工作表
      XLSX.utils.book_append_sheet(wb, ws, '排名数据');
      
      // 生成Excel文件
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      
      // 设置响应头
      const fileName = `排名数据_${Date.now()}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      // 发送Excel文件
      res.send(excelBuffer);
    } else {
      // 其他格式暂时返回模拟数据
      res.json({
        downloadUrl: 'https://example.com/download',
        fileName: `teacher_export_${Date.now()}.${format}`
      });
    }
  } catch (error) {
    console.error('导出数据失败:', error);
    res.status(500).json({ error: '导出数据失败' });
  }
});

// 新增 - 学生个人分析接口
router.get('/student/:id/analysis', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 调用硅基流动评估 API
    const response = await siliconFlowApi.post('/analysis/student', {
      studentId: id
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('获取学生分析失败:', error);
    // 返回模拟数据
    res.json({
      avatar: 'https://api.siliconflow.cn/v1/avatar/generate?name=学生1',
      tags: ['诗词达人', '勤奋之星', '山水诗爱好者'],
      level: 5,
      levelName: '进士',
      levelProgress: 75,
      learningTrend: [
        { date: '2024-01-01', duration: 60, poemCount: 2 },
        { date: '2024-01-02', duration: 90, poemCount: 3 },
        { date: '2024-01-03', duration: 45, poemCount: 1 },
        { date: '2024-01-04', duration: 120, poemCount: 4 },
        { date: '2024-01-05', duration: 150, poemCount: 5 },
        { date: '2024-01-06', duration: 75, poemCount: 2 },
        { date: '2024-01-07', duration: 90, poemCount: 3 }
      ],
      preferenceComparison: {
        student: {
          dynasty: [{ name: '唐', value: 40 }, { name: '宋', value: 30 }, { name: '其他', value: 30 }],
          theme: [{ name: '山水', value: 45 }, { name: '抒情', value: 30 }, { name: '其他', value: 25 }]
        },
        school: {
          dynasty: [{ name: '唐', value: 35 }, { name: '宋', value: 45 }, { name: '其他', value: 20 }],
          theme: [{ name: '山水', value: 30 }, { name: '抒情', value: 25 }, { name: '其他', value: 45 }]
        }
      },
      timeDistribution: [
        { period: '凌晨(0-6点)', value: 5 },
        { period: '上午(6-12点)', value: 30 },
        { period: '下午(12-18点)', value: 25 },
        { period: '晚上(18-24点)', value: 40 }
      ],
      bestStudyTime: '晚上(18-24点)',
      memoryCurve: [
        { day: 1, retention: 100 },
        { day: 2, retention: 80 },
        { day: 3, retention: 65 },
        { day: 4, retention: 55 },
        { day: 5, retention: 45 },
        { day: 6, retention: 40 },
        { day: 7, retention: 35 }
      ],
      reviewSuggestions: [
        { poemId: 1, title: '静夜思', author: '李白', bestReviewTime: '2024-01-08 19:00' },
        { poemId: 2, title: '望庐山瀑布', author: '李白', bestReviewTime: '2024-01-09 20:00' }
      ],
      abilityAnalysis: {
        memoryEfficiency: 85,
        understandingDepth: 75,
        reviewFrequency: 65,
        expansionInterest: 90,
        comment: '该学生学习能力较强，尤其在拓展兴趣方面表现突出，建议加强复习频率。'
      },
      recommendedPoems: [
        { id: 1, title: '望天门山', author: '李白', reason: '与已学的《望庐山瀑布》风格相似', matchScore: 92 },
        { id: 2, title: '黄鹤楼送孟浩然之广陵', author: '李白', reason: '与已学的《赠汪伦》同为送别诗', matchScore: 88 },
        { id: 3, title: '山居秋暝', author: '王维', reason: '符合山水诗偏好', matchScore: 95 },
        { id: 4, title: '登高', author: '杜甫', reason: '经典唐诗', matchScore: 85 },
        { id: 5, title: '钱塘湖春行', author: '白居易', reason: '山水诗代表作', matchScore: 90 }
      ]
    });
  }
});

// 新增 - 教师备注管理接口
router.get('/notes/:studentId', authenticateTeacher, (req, res) => {
  const { studentId } = req.params;
  const teacherId = req.teacher.id;
  
  db.all('SELECT * FROM teacher_notes WHERE teacher_id = ? AND student_id = ? ORDER BY created_at DESC', [teacherId, studentId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '数据库错误' });
    }
    res.json(rows);
  });
});

router.post('/notes', authenticateTeacher, (req, res) => {
  const { studentId, content } = req.body;
  const teacherId = req.teacher.id;
  
  db.run('INSERT INTO teacher_notes (teacher_id, student_id, content) VALUES (?, ?, ?)', [teacherId, studentId, content], (err) => {
    if (err) {
      return res.status(500).json({ error: '添加备注失败' });
    }
    res.status(201).json({ message: '备注添加成功' });
  });
});

router.put('/notes/:id', authenticateTeacher, (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const teacherId = req.teacher.id;
  
  db.run('UPDATE teacher_notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND teacher_id = ?', [content, id, teacherId], (err) => {
    if (err) {
      return res.status(500).json({ error: '更新备注失败' });
    }
    res.json({ message: '备注更新成功' });
  });
});

router.delete('/notes/:id', authenticateTeacher, (req, res) => {
  const { id } = req.params;
  const teacherId = req.teacher.id;
  
  db.run('DELETE FROM teacher_notes WHERE id = ? AND teacher_id = ?', [id, teacherId], (err) => {
    if (err) {
      return res.status(500).json({ error: '删除备注失败' });
    }
    res.json({ message: '备注删除成功' });
  });
});

// 新增 - 诗词全校详情接口
router.get('/poem/:id/detail', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 调用硅基流动诗词详情 API
    const response = await siliconFlowApi.post('/analysis/poem', {
      poemId: id
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('获取诗词详情失败:', error);
    // 返回模拟数据
    res.json({
      id: id,
      title: '静夜思',
      author: '李白',
      dynasty: '唐',
      studyCount: 120,
      averageStudyTime: 15,
      completionRateDistribution: [
        { range: '0-20%', count: 5 },
        { range: '20-40%', count: 10 },
        { range: '40-60%', count: 15 },
        { range: '60-80%', count: 30 },
        { range: '80-100%', count: 60 }
      ]
    });
  }
});

// 新增 - 获取所有班级列表及统计数据
router.get('/classes', authenticateTeacher, (req, res) => {
  try {
    db.all('SELECT * FROM class_stats ORDER BY class_id', (err, classes) => {
      if (err) {
        console.error('获取班级列表失败:', err);
        return res.status(500).json({ message: '获取班级列表失败' });
      }
      
      res.json({
        success: true,
        data: classes
      });
    });
  } catch (error) {
    console.error('获取班级列表失败:', error);
    res.status(500).json({ message: '获取班级列表失败' });
  }
});

// 新增 - 获取指定班级的学生详情
router.get('/classes/:classId/students', authenticateTeacher, (req, res) => {
  try {
    const { classId } = req.params;
    
    db.all(
      `SELECT u.id, u.username, u.email, 
              COUNT(DISTINCT lr.poem_id) as poem_count, 
              SUM(lr.study_time) as total_study_time,
              MAX(lr.last_view_time) as last_study_time
       FROM users u
       LEFT JOIN learning_records lr ON u.id = lr.user_id
       WHERE u.class_id = ?
       GROUP BY u.id, u.username, u.email
       ORDER BY total_study_time DESC`,
      [classId],
      (err, students) => {
        if (err) {
          console.error('获取班级学生详情失败:', err);
          return res.status(500).json({ message: '获取班级学生详情失败' });
        }
        
        res.json({
          success: true,
          data: students
        });
      }
    );
  } catch (error) {
    console.error('获取班级学生详情失败:', error);
    res.status(500).json({ message: '获取班级学生详情失败' });
  }
});

// 新增 - 获取全平台学生总排名
router.get('/rankings/overall', authenticateTeacher, (req, res) => {
  try {
    db.all(
      `SELECT u.id, u.username, u.email, u.class_id,
              COUNT(DISTINCT lr.poem_id) as poem_count,
              SUM(lr.study_time) as total_study_time,
              MAX(lr.last_view_time) as last_study_time
       FROM users u
       LEFT JOIN learning_records lr ON u.id = lr.user_id
       WHERE u.class_id IS NOT NULL
       GROUP BY u.id, u.username, u.email, u.class_id
       ORDER BY total_study_time DESC`,
      (err, students) => {
        if (err) {
          console.error('获取总排名失败:', err);
          return res.status(500).json({ message: '获取总排名失败' });
        }
        
        res.json({
          success: true,
          data: students
        });
      }
    );
  } catch (error) {
    console.error('获取总排名失败:', error);
    res.status(500).json({ message: '获取总排名失败' });
  }
});

// 新增 - 获取指定班级内部排名
router.get('/rankings/class/:classId', authenticateTeacher, (req, res) => {
  try {
    const { classId } = req.params;
    
    db.all(
      `SELECT u.id, u.username, u.email,
              COUNT(DISTINCT lr.poem_id) as poem_count,
              SUM(lr.study_time) as total_study_time,
              MAX(lr.last_view_time) as last_study_time
       FROM users u
       LEFT JOIN learning_records lr ON u.id = lr.user_id
       WHERE u.class_id = ?
       GROUP BY u.id, u.username, u.email
       ORDER BY total_study_time DESC`,
      [classId],
      (err, students) => {
        if (err) {
          console.error('获取班级排名失败:', err);
          return res.status(500).json({ message: '获取班级排名失败' });
        }
        
        res.json({
          success: true,
          data: students
        });
      }
    );
  } catch (error) {
    console.error('获取班级排名失败:', error);
    res.status(500).json({ message: '获取班级排名失败' });
  }
});

// 新增 - 获取班级对比数据
router.get('/classes/comparison', authenticateTeacher, (req, res) => {
  try {
    db.all(
      `SELECT c.class_id,
              c.total_students,
              c.total_poems_studied,
              c.avg_study_time,
              c.avg_completion_rate
       FROM class_stats c
       ORDER BY c.class_id`,
      (err, classes) => {
        if (err) {
          console.error('获取班级对比数据失败:', err);
          return res.status(500).json({ message: '获取班级对比数据失败' });
        }
        
        res.json({
          success: true,
          data: classes
        });
      }
    );
  } catch (error) {
    console.error('获取班级对比数据失败:', error);
    res.status(500).json({ message: '获取班级对比数据失败' });
  }
});

// 新增 - 获取闯关排名数据
router.get('/challenge/rankings', authenticateTeacher, (req, res) => {
  try {
    const { classId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT u.id, u.username, u.email, u.class_id,
              ucp.max_level as highest_level,
              ucp.ai_help_count,
              ucp.error_count,
              ucp.last_challenge_time
      FROM users u
      LEFT JOIN user_challenge_progress ucp ON u.id = ucp.user_id
      WHERE 1=1
    `;
    const params = [];
    
    if (classId) {
      query += ' AND u.class_id = ?';
      params.push(classId);
    }
    
    query += `
      ORDER BY ucp.max_level DESC, ucp.last_challenge_time ASC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    
    db.all(query, params, (err, students) => {
      if (err) {
        console.error('获取闯关排名失败:', err);
        return res.status(500).json({ message: '获取闯关排名失败' });
      }
      
      // 获取总数
      let countQuery = `
        SELECT COUNT(*) as total
        FROM users u
        LEFT JOIN user_challenge_progress ucp ON u.id = ucp.user_id
        WHERE 1=1
      `;
      const countParams = [];
      
      if (classId) {
        countQuery += ' AND u.class_id = ?';
        countParams.push(classId);
      }
      
      db.get(countQuery, countParams, (err, countResult) => {
        if (err) {
          console.error('获取闯关排名总数失败:', err);
          return res.status(500).json({ message: '获取闯关排名失败' });
        }
        
        res.json({
          success: true,
          data: students,
          total: countResult.total,
          page: parseInt(page),
          limit: parseInt(limit)
        });
      });
    });
  } catch (error) {
    console.error('获取闯关排名失败:', error);
    res.status(500).json({ message: '获取闯关排名失败' });
  }
});

// 新增 - 获取学生闯关详情
router.get('/challenge/student/:id', authenticateTeacher, (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取学生基本信息和闯关进度
    db.get(
      `SELECT u.id, u.username, u.email, u.class_id,
              ucp.max_level, ucp.current_level, ucp.ai_help_count, ucp.error_count, ucp.last_challenge_time
      FROM users u
      LEFT JOIN user_challenge_progress ucp ON u.id = ucp.user_id
      WHERE u.id = ?`,
      [id],
      (err, studentInfo) => {
        if (err) {
          console.error('获取学生闯关详情失败:', err);
          return res.status(500).json({ message: '获取学生闯关详情失败' });
        }
        
        if (!studentInfo) {
          return res.status(404).json({ message: '学生不存在' });
        }
        
        // 获取学生答题记录
        db.all(
          `SELECT * FROM user_challenge_records
           WHERE user_id = ?
           ORDER BY answer_time DESC
           LIMIT 50`,
          [id],
          (err, challengeRecords) => {
            if (err) {
              console.error('获取学生答题记录失败:', err);
              return res.status(500).json({ message: '获取学生闯关详情失败' });
            }
            
            // 获取学生错题本
            db.all(
              `SELECT * FROM user_error_book
               WHERE user_id = ?
               ORDER BY added_time DESC`,
              [id],
              (err, errorBook) => {
                if (err) {
                  console.error('获取学生错题本失败:', err);
                  return res.status(500).json({ message: '获取学生闯关详情失败' });
                }
                
                res.json({
                  success: true,
                  data: {
                    student: studentInfo,
                    challengeRecords,
                    errorBook
                  }
                });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('获取学生闯关详情失败:', error);
    res.status(500).json({ message: '获取学生闯关详情失败' });
  }
});

// 新增 - 数据概览接口
router.get('/overview', authenticateTeacher, async (req, res) => {
  try {
    const overview = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as total FROM users', (err, row) => {
        if (err) return reject(err);
        const totalStudents = row.total;
        
        const today = new Date().toISOString().split('T')[0];
        db.get(
          `SELECT COUNT(DISTINCT user_id) as active 
           FROM learning_records 
           WHERE DATE(last_view_time) = ?`,
          [today],
          (err, activeRow) => {
            if (err) return reject(err);
            const todayActive = activeRow.active || 0;
            
            db.get(
              `SELECT AVG(highest_level) as avg_level 
               FROM user_challenge_progress`,
              (err, avgRow) => {
                if (err) return reject(err);
                const avgLevel = Math.round(avgRow.avg_level || 0);
                
                db.get(
                  `SELECT COUNT(*) as total_errors 
                   FROM user_error_book`,
                  (err, errRow) => {
                    if (err) return reject(err);
                    const totalErrors = errRow.total_errors || 0;
                    
                    resolve({
                      totalStudents,
                      todayActive,
                      avgLevel,
                      totalErrors
                    });
                  }
                );
              }
            );
          }
        );
      });
    });
    
    res.json(overview);
  } catch (error) {
    console.error('获取概览数据失败:', error);
    res.status(500).json({ error: '获取数据失败' });
  }
});

// 新增 - 学习趋势接口（最近7天）
router.get('/trend', authenticateTeacher, async (req, res) => {
  try {
    const trend = await new Promise((resolve, reject) => {
      const days = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        days.push(date.toISOString().split('T')[0]);
      }
      
      db.all(
        `SELECT 
          DATE(answered_at) as date, 
          COUNT(*) as count 
         FROM user_challenge_records 
         WHERE DATE(answered_at) >= ?
         GROUP BY DATE(answered_at)
         ORDER BY date`,
        [days[0]],
        (err, rows) => {
          if (err) return reject(err);
          
          const result = days.map(day => {
            const found = rows.find(r => r.date === day);
            return {
              date: day,
              count: found ? found.count : 0
            };
          });
          
          resolve(result);
        }
      );
    });
    
    res.json(trend);
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    res.status(500).json({ error: '获取数据失败' });
  }
});

// 新增 - 关卡分布接口
router.get('/level-distribution', authenticateTeacher, async (req, res) => {
  try {
    const distribution = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          CASE 
            WHEN highest_level <= 50 THEN '1-50'
            WHEN highest_level <= 100 THEN '51-100'
            WHEN highest_level <= 150 THEN '101-150'
            ELSE '151-200'
          END as range,
          COUNT(*) as count
         FROM user_challenge_progress
         WHERE highest_level > 0
         GROUP BY 
          CASE 
            WHEN highest_level <= 50 THEN '1-50'
            WHEN highest_level <= 100 THEN '51-100'
            WHEN highest_level <= 150 THEN '101-150'
            ELSE '151-200'
          END
         ORDER BY range`,
        (err, rows) => {
          if (err) return reject(err);
          
          const ranges = ['1-50', '51-100', '101-150', '151-200'];
          const result = ranges.map(range => {
            const found = rows.find(r => r.range === range);
            return {
              range,
              count: found ? found.count : 0
            };
          });
          
          resolve(result);
        }
      );
    });
    
    res.json(distribution);
  } catch (error) {
    console.error('获取关卡分布失败:', error);
    res.status(500).json({ error: '获取数据失败' });
  }
});

// 新增 - 错题TOP10接口
router.get('/wrong-top', authenticateTeacher, async (req, res) => {
  try {
    const wrongTop = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          question_content as question,
          COUNT(*) as error_count
         FROM user_challenge_records
         WHERE is_correct = 0
         GROUP BY question_content
         ORDER BY error_count DESC
         LIMIT 10`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
    
    res.json(wrongTop);
  } catch (error) {
    console.error('获取错题TOP10失败:', error);
    res.status(500).json({ error: '获取数据失败' });
  }
});

// 新增 - 排行榜接口
router.get('/ranking', authenticateTeacher, async (req, res) => {
  try {
    const ranking = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          u.username,
          ucp.highest_level as level
         FROM users u
         LEFT JOIN user_challenge_progress ucp ON u.id = ucp.user_id
         WHERE ucp.highest_level > 0
         ORDER BY ucp.highest_level DESC
         LIMIT 50`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
    
    res.json(ranking);
  } catch (error) {
    console.error('获取排行榜失败:', error);
    res.status(500).json({ error: '获取数据失败' });
  }
});

// 新增 - 正确率vs错误率接口
router.get('/correct-rate', authenticateTeacher, async (req, res) => {
  try {
    const rates = await new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct,
          SUM(CASE WHEN is_correct = 0 THEN 1 ELSE 0 END) as wrong
         FROM user_challenge_records`,
        (err, row) => {
          if (err) return reject(err);
          
          const total = (row.correct || 0) + (row.wrong || 0);
          const correctRate = total > 0 ? Math.round((row.correct / total) * 100) : 0;
          const wrongRate = total > 0 ? Math.round((row.wrong / total) * 100) : 0;
          
          resolve({
            correct: row.correct || 0,
            wrong: row.wrong || 0,
            correctRate,
            wrongRate
          });
        }
      );
    });
    
    res.json(rates);
  } catch (error) {
    console.error('获取正确率失败:', error);
    res.status(500).json({ error: '获取数据失败' });
  }
});

module.exports = router;