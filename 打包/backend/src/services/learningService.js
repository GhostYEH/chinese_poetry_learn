require('dotenv').config();
const axios = require('axios');
const { db } = require('../utils/db');

// 最近7天的学习活跃度与得分趋势
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

    // 拼接日期字符串
    let monthStr = String(m + 1);
    if (monthStr.length === 1) {
      monthStr = '0' + monthStr;
    }
    let dayStr = String(d);
    if (dayStr.length === 1) {
      dayStr = '0' + dayStr;
    }
    const dateStr = monthStr + '-' + dayStr;

    // 找出这一天的记录
    const onDay = [];
    for (let j = 0; j < learnedPoems.length; j++) {
      const r = learnedPoems[j];
      if (!r.last_view_time) {
        continue;
      }
      const t = new Date(r.last_view_time);
      if (t.getFullYear() === y && t.getMonth() === m && t.getDate() === d) {
        onDay.push(r);
      }
    }

    let score = 0;
    if (onDay.length > 0) {
      // 找出有背诵记录的
      const recited = [];
      for (let j = 0; j < onDay.length; j++) {
        if (onDay[j].recite_attempts > 0) {
          recited.push(onDay[j]);
        }
      }

      if (recited.length > 0) {
        // 计算平均分
        let totalScore = 0;
        for (let j = 0; j < recited.length; j++) {
          let bestScore = recited[j].best_score || 0;
          totalScore = totalScore + bestScore;
        }
        score = Math.round(totalScore / recited.length);
      } else {
        // 计算参与度分数
        let engagement = 0;
        for (let j = 0; j < onDay.length; j++) {
          let viewCount = onDay[j].view_count || 0;
          let aiCount = onDay[j].ai_explain_count || 0;
          engagement = engagement + viewCount + aiCount * 2;
        }
        let tempScore = 30 + engagement * 4;
        if (tempScore > 100) {
          tempScore = 100;
        }
        score = Math.round(tempScore);
      }
    } else {
      score = 0;
    }

    trends.push({ date: dateStr, score: score, activePoems: onDay.length });
  }

  return trends;
}

let learningRecords = {};

function initLearningRecords(poems) {
  db.serialize(function() {
    for (let i = 0; i < poems.length; i++) {
      // 空循环，不做任何事
    }
  });
}

// 记录学习行为
function recordLearningAction(userId, poemId, action, score) {
  if (score === undefined) {
    score = null;
  }

  const cacheKey = String(userId) + ':' + String(poemId);

  let recordObj = {};
  recordObj.id = null;
  recordObj.user_id = userId;
  recordObj.poem_id = poemId;
  recordObj.view_count = 0;
  recordObj.ai_explain_count = 0;
  recordObj.recite_attempts = 0;
  recordObj.best_score = 0;
  recordObj.total_score = 0;
  recordObj.study_time = 0;
  recordObj.last_view_time = null;

  if (action === 'view') {
    recordObj.view_count = 1;
    recordObj.last_view_time = new Date().toISOString();
  } else if (action === 'ai_explain') {
    recordObj.ai_explain_count = 1;
  } else if (action === 'recite') {
    recordObj.recite_attempts = 1;
    if (score !== null) {
      recordObj.total_score = score;
      recordObj.best_score = score;
    }
  } else if (action === 'study_time') {
    if (score !== null && score > 0) {
      recordObj.study_time = score;
    }
  }

  // 检查记录是否存在
  db.get('SELECT * FROM learning_records WHERE user_id = ? AND poem_id = ?', [userId, poemId], function(err, row) {
    if (err) {
      console.error('查询学习记录失败:', err);
      return;
    }

    if (row) {
      // 更新现有记录
      let newViewCount = row.view_count + recordObj.view_count;
      let newAiCount = row.ai_explain_count + recordObj.ai_explain_count;
      let newReciteAttempts = row.recite_attempts + recordObj.recite_attempts;
      let newTotalScore = row.total_score;
      let newBestScore = row.best_score;
      let newStudyTime = row.study_time;

      if (recordObj.recite_attempts > 0 && score !== null) {
        newTotalScore = row.total_score + score;
        if (score > row.best_score) {
          newBestScore = score;
        }
      }

      if (recordObj.study_time > 0) {
        newStudyTime = row.study_time + recordObj.study_time;
      }

      if (recordObj.view_count > 0) {
        newViewCount = row.view_count + 1;
        recordObj.last_view_time = new Date().toISOString();
      }

      db.run(
        'UPDATE learning_records SET view_count = ?, ai_explain_count = ?, recite_attempts = ?, best_score = ?, total_score = ?, study_time = ?, last_view_time = ? WHERE user_id = ? AND poem_id = ?',
        [newViewCount, newAiCount, newReciteAttempts, newBestScore, newTotalScore, newStudyTime, recordObj.last_view_time, userId, poemId],
        function(err) {
          if (err) {
            console.error('更新学习记录失败:', err);
          }
        }
      );
    } else {
      // 创建新记录
      db.run(
        'INSERT INTO learning_records (user_id, poem_id, view_count, ai_explain_count, recite_attempts, best_score, total_score, study_time, last_view_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
  return new Promise(function(resolve, reject) {
    db.all(
      'SELECT lr.*, p.title as poem_title, p.author as poem_author FROM learning_records lr JOIN poems p ON lr.poem_id = p.id WHERE lr.user_id = ? AND (lr.view_count > 0 OR lr.ai_explain_count > 0 OR lr.recite_attempts > 0)',
      [userId],
      function(err, rows) {
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
  return new Promise(function(resolve, reject) {
    db.get(
      'SELECT lr.*, p.title as poem_title, p.author as poem_author FROM learning_records lr JOIN poems p ON lr.poem_id = p.id WHERE lr.user_id = ? AND lr.poem_id = ?',
      [userId, poemId],
      function(err, row) {
        if (err) {
          console.error('获取学习记录失败:', err);
          reject(err);
          return;
        }
        if (row) {
          resolve(row);
        } else {
          resolve(null);
        }
      }
    );
  });
}

// 获取学习仪表盘数据
function getLearningDashboard(userId) {
  return new Promise(function(resolve, reject) {
    db.all(
      'SELECT lr.*, p.title as poem_title, p.author as poem_author FROM learning_records lr JOIN poems p ON lr.poem_id = p.id WHERE lr.user_id = ? AND (lr.view_count > 0 OR lr.ai_explain_count > 0 OR lr.recite_attempts > 0)',
      [userId],
      function(err, rows) {
        if (err) {
          console.error('获取学习仪表盘数据失败:', err);
          reject(err);
          return;
        }

        const learnedPoems = rows;

        // 计算已学习诗词数量
        const totalLearned = learnedPoems.length;

        // 找出有背诵记录的诗
        const recitedPoems = [];
        for (let i = 0; i < learnedPoems.length; i++) {
          if (learnedPoems[i].recite_attempts > 0) {
            recitedPoems.push(learnedPoems[i]);
          }
        }

        // 计算平均背诵得分
        let totalScoreSum = 0;
        let totalAttempts = 0;
        for (let i = 0; i < recitedPoems.length; i++) {
          totalScoreSum = totalScoreSum + (recitedPoems[i].total_score || 0);
          totalAttempts = totalAttempts + recitedPoems[i].recite_attempts;
        }
        let averageScore = 0;
        if (totalAttempts > 0) {
          averageScore = Math.round(totalScoreSum / totalAttempts);
        }

        // 计算错题数量
        let mistakeCount = 0;
        for (let i = 0; i < recitedPoems.length; i++) {
          if (recitedPoems[i].best_score < 100) {
            mistakeCount = mistakeCount + 1;
          }
        }

        // 计算总学习时长
        let totalStudyTime = 0;
        for (let i = 0; i < learnedPoems.length; i++) {
          totalStudyTime = totalStudyTime + (learnedPoems[i].study_time || 0);
        }

        // 获取最近学习记录（按最后查看时间排序，取前5个）
        const recentLearnings = [];
        for (let i = 0; i < learnedPoems.length; i++) {
          if (learnedPoems[i].last_view_time) {
            recentLearnings.push(learnedPoems[i]);
          }
        }
        // 简单排序
        for (let i = 0; i < recentLearnings.length; i++) {
          for (let j = i + 1; j < recentLearnings.length; j++) {
            const a = new Date(recentLearnings[i].last_view_time);
            const b = new Date(recentLearnings[j].last_view_time);
            if (a < b) {
              const temp = recentLearnings[i];
              recentLearnings[i] = recentLearnings[j];
              recentLearnings[j] = temp;
            }
          }
        }
        // 取前5个
        const recentLearningsResult = [];
        const recentCount = recentLearnings.length > 5 ? 5 : recentLearnings.length;
        for (let i = 0; i < recentCount; i++) {
          recentLearningsResult.push(recentLearnings[i]);
        }

        // 计算掌握率
        let masteredCount = 0;
        for (let i = 0; i < recitedPoems.length; i++) {
          if (recitedPoems[i].best_score === 100) {
            masteredCount = masteredCount + 1;
          }
        }
        let masteryRate = 0;
        if (recitedPoems.length > 0) {
          masteryRate = Math.round((masteredCount / recitedPoems.length) * 100);
        }

        const result = {};
        result.totalLearned = totalLearned;
        result.averageScore = averageScore;
        result.mistakeCount = mistakeCount;
        result.recentLearnings = recentLearningsResult;
        result.masteryRate = masteryRate;
        result.totalStudyTime = totalStudyTime;
        result.learningTrends = buildLearningTrends(learnedPoems);

        resolve(result);
      }
    );
  });
}

// 生成AI学习建议
async function generateAiLearningAdvice(userId) {
  const config = require('../config/config');
  const { callZhipuGenerateJSON } = require('./aiService');

  const apiKey = config.zhipu.apiKey;

  if (!apiKey) {
    const err = new Error('AI 服务未配置');
    err.code = 'NO_API_KEY';
    throw err;
  }

  // 获取学习记录
  const rows = await getLearningStats(userId);

  // 按最后学习时间排序
  const sorted = [];
  for (let i = 0; i < rows.length; i++) {
    sorted.push(rows[i]);
  }
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      let aTime = sorted[i].last_view_time;
      let bTime = sorted[j].last_view_time;
      let aIsEmpty = !aTime;
      let bIsEmpty = !bTime;
      let swap = false;
      if (aIsEmpty && !bIsEmpty) {
        swap = true;
      } else if (!aIsEmpty && !bIsEmpty) {
        const a = new Date(aTime);
        const b = new Date(bTime);
        if (a < b) {
          swap = true;
        }
      }
      if (swap) {
        const temp = sorted[i];
        sorted[i] = sorted[j];
        sorted[j] = temp;
      }
    }
  }

  // 找出有背诵记录的诗
  const recited = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].recite_attempts > 0) {
      recited.push(sorted[i]);
    }
  }

  // 计算平均分
  let totalScoreSum = 0;
  let totalAttempts = 0;
  for (let i = 0; i < recited.length; i++) {
    totalScoreSum = totalScoreSum + (recited[i].total_score || 0);
    totalAttempts = totalAttempts + recited[i].recite_attempts;
  }
  let averageRecite = 0;
  if (totalAttempts > 0) {
    averageRecite = Math.round(totalScoreSum / totalAttempts);
  }

  // 计算薄弱诗词数量
  let mistakeCount = 0;
  for (let i = 0; i < recited.length; i++) {
    if (recited[i].best_score < 100) {
      mistakeCount = mistakeCount + 1;
    }
  }

  // 计算掌握诗词数量
  let masteredCount = 0;
  for (let i = 0; i < recited.length; i++) {
    if (recited[i].best_score === 100) {
      masteredCount = masteredCount + 1;
    }
  }

  let masteryRate = 0;
  if (recited.length > 0) {
    masteryRate = Math.round((masteredCount / recited.length) * 100);
  }

  // 计算总学习时间
  let totalStudyTime = 0;
  for (let i = 0; i < sorted.length; i++) {
    totalStudyTime = totalStudyTime + (sorted[i].study_time || 0);
  }

  // 找出掌握好的诗（得分>=90）
  const strongPoems = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].recite_attempts > 0 && sorted[i].best_score >= 90) {
      strongPoems.push(sorted[i]);
      if (strongPoems.length >= 5) {
        break;
      }
    }
  }

  // 找出掌握差的诗（得分<80）
  const weakPoems = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].recite_attempts > 0 && sorted[i].best_score < 80) {
      weakPoems.push(sorted[i]);
      if (weakPoems.length >= 5) {
        break;
      }
    }
  }

  // 找出还没背过的诗
  const unrecitedPoems = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].recite_attempts === 0) {
      unrecitedPoems.push(sorted[i]);
      if (unrecitedPoems.length >= 5) {
        break;
      }
    }
  }

  // 最近学的诗
  const recentPoems = [];
  const recentCount = sorted.length > 5 ? 5 : sorted.length;
  for (let i = 0; i < recentCount; i++) {
    recentPoems.push(sorted[i]);
  }

  // 整理strong_poems
  const strongPoemsList = [];
  for (let i = 0; i < strongPoems.length; i++) {
    const p = strongPoems[i];
    const item = {};
    item.title = p.poem_title;
    item.author = p.poem_author;
    item.best_score = p.best_score;
    item.attempts = p.recite_attempts;
    item.view_count = p.view_count;
    item.ai_explain_count = p.ai_explain_count;
    strongPoemsList.push(item);
  }

  // 整理weak_poems
  const weakPoemsList = [];
  for (let i = 0; i < weakPoems.length; i++) {
    const p = weakPoems[i];
    const item = {};
    item.title = p.poem_title;
    item.author = p.poem_author;
    item.best_score = p.best_score;
    item.attempts = p.recite_attempts;
    weakPoemsList.push(item);
  }

  // 整理unrecited_poems
  const unrecitedPoemsList = [];
  for (let i = 0; i < unrecitedPoems.length; i++) {
    const p = unrecitedPoems[i];
    const item = {};
    item.title = p.poem_title;
    item.author = p.poem_author;
    item.view_count = p.view_count;
    unrecitedPoemsList.push(item);
  }

  // 整理recent_poems
  const recentPoemsList = [];
  for (let i = 0; i < recentPoems.length; i++) {
    const p = recentPoems[i];
    const item = {};
    item.title = p.poem_title;
    item.author = p.poem_author;
    item.last_view_time = p.last_view_time;
    recentPoemsList.push(item);
  }

  // 整理学习概况
  const summary = {};
  summary.total_learned_poems = sorted.length;
  summary.average_recite_score_percent = averageRecite;
  summary.imperfect_recite_poems = mistakeCount;
  summary.mastery_rate_percent = masteryRate;
  summary.total_study_time_minutes = totalStudyTime;
  summary.strong_poems = strongPoemsList;
  summary.weak_poems = weakPoemsList;
  summary.unrecited_poems = unrecitedPoemsList;
  summary.recent_poems = recentPoemsList;

  // 构造AI提示词
  let strongPoemsText = '暂无';
  if (strongPoemsList.length > 0) {
    strongPoemsText = '';
    for (let i = 0; i < strongPoemsList.length; i++) {
      const p = strongPoemsList[i];
      let line = '- 《' + p.title + '》';
      if (p.author) {
        line = line + '（' + p.author + '）';
      }
      line = line + '：最高' + p.best_score + '分，背诵' + p.attempts + '次';
      strongPoemsText = strongPoemsText + line + '\n';
    }
  }

  let weakPoemsText = '暂无';
  if (weakPoemsList.length > 0) {
    weakPoemsText = '';
    for (let i = 0; i < weakPoemsList.length; i++) {
      const p = weakPoemsList[i];
      let line = '- 《' + p.title + '》';
      if (p.author) {
        line = line + '（' + p.author + '）';
      }
      line = line + '：最高' + p.best_score + '分，背诵' + p.attempts + '次';
      weakPoemsText = weakPoemsText + line + '\n';
    }
  }

  let unrecitedPoemsText = '暂无';
  if (unrecitedPoemsList.length > 0) {
    unrecitedPoemsText = '';
    for (let i = 0; i < unrecitedPoemsList.length; i++) {
      const p = unrecitedPoemsList[i];
      let line = '- 《' + p.title + '》';
      if (p.author) {
        line = line + '（' + p.author + '）';
      }
      line = line + '：查看' + p.view_count + '次';
      unrecitedPoemsText = unrecitedPoemsText + line + '\n';
    }
  }

  let recentPoemsText = '暂无';
  if (recentPoemsList.length > 0) {
    recentPoemsText = '';
    for (let i = 0; i < recentPoemsList.length; i++) {
      const p = recentPoemsList[i];
      let line = '- 《' + p.title + '》';
      if (p.author) {
        line = line + '（' + p.author + '）';
      }
      recentPoemsText = recentPoemsText + line + '\n';
    }
  }

  const prompt = `请根据以下学习数据，为学生生成个性化的学习建议：

【学习概况】
- 已学习诗词：${summary.total_learned_poems} 首
- 平均背诵得分：${summary.average_recite_score_percent}%
- 掌握率（满分诗词占比）：${summary.mastery_rate_percent}%
- 累计学习时长：${summary.total_study_time_minutes} 分钟
- 有背诵记录的诗词：${recited.length} 首

【掌握较好的诗词】（得分≥90分）
${strongPoemsText}
【需要加强的诗词】（得分<80分）
${weakPoemsText}
【已查看但未背诵的诗词】
${unrecitedPoemsText}
【最近学习的诗词】
${recentPoemsText}

请直接返回实际的JSON结果（不要返回模板）：
{"summary":"学习概况总结，概述学生的学习状态和整体表现","strength":"优势亮点，指出学生做得好的地方","weakness":"薄弱环节，客观指出需要改进的地方","suggestion":"改进建议，给出具体可操作的学习方法","plan":["任务1","任务2","任务3"],"encourage":"激励寄语，用温暖的话语鼓励学生"}`;

  try {
    const result = await callZhipuGenerateJSON(
      prompt,
      '你是经验丰富、温暖亲切的古诗词学习导师。请根据学生数据生成个性化学习建议，直接返回JSON结果。',
      { temperature: 0.7, maxTokens: 2000 }
    );

    if (result) {
      return {
        summary: result.summary || '',
        strength: result.strength || '',
        weakness: result.weakness || '',
        suggestion: result.suggestion || '',
        plan: Array.isArray(result.plan) ? result.plan : [],
        encourage: result.encourage || ''
      };
    }

    throw new Error('AI返回空结果');
  } catch (err) {
    console.error('[learningService] AI学习建议生成失败:', err.message);
    const ne = new Error('AI 服务暂不可用');
    ne.code = 'NO_API_KEY';
    throw ne;
  }
}

module.exports = {
  initLearningRecords: initLearningRecords,
  recordLearningAction: recordLearningAction,
  getLearningStats: getLearningStats,
  getLearningRecord: getLearningRecord,
  getLearningDashboard: getLearningDashboard,
  generateAiLearningAdvice: generateAiLearningAdvice
};
