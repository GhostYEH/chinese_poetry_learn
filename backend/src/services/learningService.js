// 学习记录服务
require('dotenv').config();
const axios = require('axios');
const { db } = require('../utils/db');

/** 最近 7 天（含今天）按日历聚合的学习活跃度与得分趋势 */
function buildLearningTrends(learnedPoems) {
  const trends = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    const dateStr = `${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const onDay = learnedPoems.filter((r) => {
      if (!r.last_view_time) return false;
      const t = new Date(r.last_view_time);
      return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
    });

    let score = 0;
    if (onDay.length > 0) {
      const recited = onDay.filter((r) => r.recite_attempts > 0);
      if (recited.length > 0) {
        score = Math.round(
          recited.reduce((s, r) => s + (r.best_score || 0), 0) / recited.length
        );
      } else {
        const engagement = onDay.reduce(
          (s, r) => s + (r.view_count || 0) + (r.ai_explain_count || 0) * 2,
          0
        );
        score = Math.min(100, Math.round(30 + Math.min(engagement * 4, 70)));
      }
    } else {
      score = 0;
    }

    trends.push({ date: dateStr, score, activePoems: onDay.length });
  }

  return trends;
}

// 学习记录数据存储（内存缓存）
let learningRecords = {};

// 初始化学习记录
function initLearningRecords(poems) {
  // 从数据库加载学习记录
  db.serialize(() => {
    // 为每首诗词创建学习记录（如果不存在）
    poems.forEach(poem => {
      // 注意：现在学习记录需要与用户关联，所以这里不再自动创建记录
      // 记录将在用户首次学习时创建
    });
  });
}

// 记录学习行为
function recordLearningAction(userId, poemId, action, score = null) {
  const cacheKey = `${userId}:${poemId}`;
  
  // 初始化记录对象
  let recordObj = {
    id: null,
    user_id: userId,
    poem_id: poemId,
    view_count: 0,
    ai_explain_count: 0,
    recite_attempts: 0,
    best_score: 0,
    total_score: 0,
    study_time: 0,
    last_view_time: null
  };
  
  // 更新记录
  switch (action) {
    case 'view':
      recordObj.view_count += 1;
      recordObj.last_view_time = new Date().toISOString();
      break;
    case 'ai_explain':
      recordObj.ai_explain_count += 1;
      break;
    case 'recite':
      recordObj.recite_attempts += 1;
      if (score !== null) {
        recordObj.total_score += score;
        if (score > recordObj.best_score) {
          recordObj.best_score = score;
        }
      }
      break;
    case 'study_time':
      if (score !== null && score > 0) {
        recordObj.study_time += score;
      }
      break;
  }
  
  // 检查记录是否存在
  db.get('SELECT * FROM learning_records WHERE user_id = ? AND poem_id = ?', [userId, poemId], (err, row) => {
    if (err) {
      console.error('查询学习记录失败:', err);
      return;
    }
    
    if (row) {
      // 更新现有记录
      db.run('UPDATE learning_records SET view_count = ?, ai_explain_count = ?, recite_attempts = ?, best_score = ?, total_score = ?, study_time = ?, last_view_time = ? WHERE user_id = ? AND poem_id = ?', 
        [recordObj.view_count, recordObj.ai_explain_count, recordObj.recite_attempts, recordObj.best_score, recordObj.total_score, recordObj.study_time, recordObj.last_view_time, userId, poemId],
        (err) => {
          if (err) {
            console.error('更新学习记录失败:', err);
          }
        }
      );
    } else {
      // 创建新记录
      db.run('INSERT INTO learning_records (user_id, poem_id, view_count, ai_explain_count, recite_attempts, best_score, total_score, study_time, last_view_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, poemId, recordObj.view_count, recordObj.ai_explain_count, recordObj.recite_attempts, recordObj.best_score, recordObj.total_score, recordObj.study_time, recordObj.last_view_time],
        function(err) {
          if (err) {
            console.error('插入学习记录失败:', err);
          } else {
            recordObj.id = this.lastID;
          }
        }
      );
    }
  });
  
  // 更新内存缓存
  learningRecords[cacheKey] = recordObj;
  
  return recordObj;
}

// 获取学习统计
function getLearningStats(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT lr.*, p.title as poem_title, p.author as poem_author 
      FROM learning_records lr
      JOIN poems p ON lr.poem_id = p.id
      WHERE lr.user_id = ? AND (lr.view_count > 0 OR lr.ai_explain_count > 0 OR lr.recite_attempts > 0)
      `,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('获取学习统计失败:', err);
          reject(err);
          return;
        }
        resolve(rows);
      }
    );
  });
}

// 获取单首诗的学习记录
function getLearningRecord(userId, poemId) {
  return new Promise((resolve, reject) => {
    db.get(
      `
      SELECT lr.*, p.title as poem_title, p.author as poem_author 
      FROM learning_records lr
      JOIN poems p ON lr.poem_id = p.id
      WHERE lr.user_id = ? AND lr.poem_id = ?
      `,
      [userId, poemId],
      (err, row) => {
        if (err) {
          console.error('获取学习记录失败:', err);
          reject(err);
          return;
        }
        resolve(row || null);
      }
    );
  });
}

// 获取学习仪表盘数据
function getLearningDashboard(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT lr.*, p.title as poem_title, p.author as poem_author 
      FROM learning_records lr
      JOIN poems p ON lr.poem_id = p.id
      WHERE lr.user_id = ? AND (lr.view_count > 0 OR lr.ai_explain_count > 0 OR lr.recite_attempts > 0)
      `,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('获取学习仪表盘数据失败:', err);
          reject(err);
          return;
        }
        
        const learnedPoems = rows;
        
        // 计算已学习诗词数量
        const totalLearned = learnedPoems.length;
        
        // 计算平均背诵得分（使用总分除以尝试次数）
        const recitedPoems = learnedPoems.filter(record => record.recite_attempts > 0);
        const totalScoreSum = recitedPoems.reduce((sum, record) => sum + (record.total_score || 0), 0);
        const totalAttempts = recitedPoems.reduce((sum, record) => sum + record.recite_attempts, 0);
        const averageScore = totalAttempts > 0 
          ? Math.round(totalScoreSum / totalAttempts)
          : 0;
        
        // 计算错题数量（得分低于100分的视为错题）
        const mistakeCount = recitedPoems.filter(record => record.best_score < 100).length;
        
        // 计算总学习时长（分钟）
        const totalStudyTime = learnedPoems.reduce((sum, record) => sum + (record.study_time || 0), 0);
        
        // 获取最近学习记录（按最后查看时间排序）
        const recentLearnings = [...learnedPoems]
          .filter(record => record.last_view_time)
          .sort((a, b) => new Date(b.last_view_time) - new Date(a.last_view_time))
          .slice(0, 5);
        
        // 计算掌握率（得分100分视为掌握）
        const masteredCount = recitedPoems.filter(record => record.best_score === 100).length;
        const masteryRate = recitedPoems.length > 0 
          ? Math.round((masteredCount / recitedPoems.length) * 100)
          : 0;
        
        resolve({
          totalLearned,
          averageScore,
          mistakeCount,
          recentLearnings,
          masteryRate,
          totalStudyTime,
          learningTrends: buildLearningTrends(learnedPoems)
        });
      }
    );
  });
}

/**
 * 基于个人学习记录调用硅基流动 Qwen3-8B 生成学习建议（需在环境变量配置 SILICONFLOW_API_KEY）
 * @see https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions
 */
async function generateAiLearningAdvice(userId) {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    const err = new Error('AI 服务未配置');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const rows = await getLearningStats(userId);
  const sorted = [...rows].sort((a, b) => {
    if (!a.last_view_time) return 1;
    if (!b.last_view_time) return -1;
    return new Date(b.last_view_time) - new Date(a.last_view_time);
  });

  const recited = sorted.filter((r) => r.recite_attempts > 0);
  const totalScoreSum = recited.reduce((s, r) => s + (r.total_score || 0), 0);
  const totalAttempts = recited.reduce((s, r) => s + r.recite_attempts, 0);
  const averageRecite = totalAttempts > 0 ? Math.round(totalScoreSum / totalAttempts) : 0;
  const mistakeCount = recited.filter((r) => r.best_score < 100).length;
  const masteredCount = recited.filter((r) => r.best_score === 100).length;
  const masteryRate = recited.length > 0 ? Math.round((masteredCount / recited.length) * 100) : 0;
  const totalStudyTime = sorted.reduce((s, r) => s + (r.study_time || 0), 0);

  const poemDetails = sorted.slice(0, 80).map((r) => ({
    title: r.poem_title,
    author: r.poem_author,
    view_count: r.view_count,
    ai_explain_count: r.ai_explain_count,
    recite_attempts: r.recite_attempts,
    best_score: r.best_score,
    total_score: r.total_score,
    study_time_minutes: r.study_time,
    last_active: r.last_view_time
  }));

  const summary = {
    total_learned_poems: sorted.length,
    average_recite_score_percent: averageRecite,
    imperfect_recite_poems: mistakeCount,
    mastery_rate_percent: masteryRate,
    total_study_time_minutes: totalStudyTime,
    poem_records: poemDetails
  };

  const userPayload = JSON.stringify(summary);

  const messages = [
    {
      role: 'system',
      content:
        '你是一位资深古诗词学习指导师，熟悉记忆规律与朗诵背诵训练。请根据用户提供的结构化学习数据，写出一份详细、可执行的学习建议。' +
        '要求：使用 Markdown（## 小标题、列表）；结合数据中出现的具体诗词标题与数字（查看次数、AI讲解次数、背诵次数、最高分等）；指出薄弱环节与优势；给出可执行的近期计划（例如未来一周）；语气专业、鼓励。' +
        '不要编造数据中不存在的诗词标题；若记录为空或很少，请说明如何从建立学习习惯与选篇开始。'
    },
    {
      role: 'user',
      content: `以下是我的古诗词学习数据（JSON）。请据此全面分析并给出学习建议：\n${userPayload}`
    }
  ];

  const resp = await axios.post(
    'https://api.siliconflow.cn/v1/chat/completions',
    {
      model: 'Qwen/Qwen3-8B',
      messages,
      temperature: 0.65,
      max_tokens: 2048
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    }
  );

  const content = resp.data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('模型返回空内容');
  }
  return content.trim();
}

module.exports = {
  initLearningRecords,
  recordLearningAction,
  getLearningStats,
  getLearningRecord,
  getLearningDashboard,
  generateAiLearningAdvice
};
