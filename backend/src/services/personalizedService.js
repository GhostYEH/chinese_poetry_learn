// 个性化推荐服务
// 整合错题本、闯关记录、游戏记录，调用AI生成个性化推荐与分析报告
require('dotenv').config();
const axios = require('axios');
const { db } = require('../utils/db');
const { callZhipuGenerateJSON } = require('./aiService');

/**
 * 获取用户错题本数据
 */
function getWrongQuestions(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT wq.*, wq.title as poem_title, wq.author as poem_author, wq.full_poem as poem_content
       FROM wrong_questions wq
       WHERE wq.user_id = ?
       ORDER BY wq.last_wrong_time DESC`,
      [userId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

/**
 * 获取用户闯关记录
 */
function getChallengeRecords(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT cr.*, cr.poem_title, cr.poem_author, cr.question_content as poem_content
       FROM user_challenge_records cr
       WHERE cr.user_id = ?
       ORDER BY cr.answered_at DESC`,
      [userId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

/**
 * 获取用户飞花令记录
 */
function getFeihuaRecords(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM feihua_high_records WHERE user_id = ? ORDER BY max_rounds DESC LIMIT 20`,
      [userId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

/**
 * 获取用户学习记录（来自 learning_records 表）
 */
function getLearningRecords(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT lr.*, p.title as poem_title, p.author as poem_author, p.dynasty, p.content as poem_content
       FROM learning_records lr
       LEFT JOIN poems p ON lr.poem_id = p.id
       WHERE lr.user_id = ?
       ORDER BY lr.last_view_time DESC`,
      [userId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

/**
 * 获取最近学习的诗词（用于推荐）
 */
function getRecentLearnedPoems(userId, limit = 50) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT p.*, lr.last_view_time, lr.best_score, lr.recite_attempts
       FROM learning_records lr
       JOIN poems p ON lr.poem_id = p.id
       WHERE lr.user_id = ?
       ORDER BY lr.last_view_time DESC
       LIMIT ?`,
      [userId, limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

/**
 * 随机获取未学习的诗词（用于推荐）
 */
function getUnlearnedPoems(userId, dynasty = null, limit = 20) {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT p.* FROM poems p
      WHERE p.id NOT IN (
        SELECT poem_id FROM learning_records WHERE user_id = ?
      )
    `;
    const params = [userId];
    if (dynasty) {
      sql += ` AND p.dynasty = ?`;
      params.push(dynasty);
    }
    sql += ` ORDER BY RANDOM() LIMIT ?`;
    params.push(limit);
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

/**
 * 获取收藏的诗词（用于专题学习推荐）
 */
function getFavoritePoems(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT c.*, p.title, p.author, p.dynasty, p.content
       FROM collections c
       JOIN poems p ON c.poem_id = p.id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [userId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

/**
 * 构建复习推荐数据
 */
function buildReviewRecommendations(wrongQuestions, challengeRecords, feihuaRecords) {
  const reviewItems = [];

  wrongQuestions.slice(0, 5).forEach(wq => {
    reviewItems.push({
      type: 'wrong_question',
      poem_id: wq.poem_id || wq.question_id,
      title: wq.poem_title || wq.title,
      author: wq.poem_author || wq.author,
      content: wq.poem_content || wq.full_poem,
      reason: `错题回顾：上次答题出错，建议复习`,
      difficulty: wq.difficulty || '中等',
      times: wq.wrong_count || 1,
      tag: '错题本'
    });
  });

  (challengeRecords || []).filter(r => r.is_correct === 0).slice(0, 3).forEach(cr => {
    reviewItems.push({
      type: 'challenge_fail',
      poem_id: cr.question_id || null,
      title: cr.poem_title || '未知诗词',
      author: cr.poem_author || '未知作者',
      content: cr.poem_content || cr.question_content,
      reason: `闯关未通过，需要巩固`,
      difficulty: '中等',
      times: 1,
      tag: '闯关记录'
    });
  });

  return reviewItems.slice(0, 6);
}

/**
 * 构建学习推荐数据
 */
function buildLearnRecommendations(learningRecords, unlearnedPoems, favoritePoems, challengeRecords) {
  const learnItems = [];

  const learned = learningRecords || [];
  if (learned.length > 0) {
    const nextLevel = learned.filter(r => (r.best_score || 0) < 80);
    if (nextLevel.length > 0) {
      nextLevel.slice(0, 2).forEach(p => {
        learnItems.push({
          type: 'weakness_reinforce',
          poem_id: p.poem_id,
          title: p.poem_title,
          author: p.poem_author,
          content: p.poem_content,
          dynasty: p.dynasty,
          reason: `这首诗正确率偏低（${p.best_score || 0}%），建议加强练习`,
          score: p.best_score || 0,
          tag: '薄弱加强'
        });
      });
    }
  }

  const favorites = favoritePoems || [];
  if (favorites.length > 0) {
    const favDynasty = favorites[0].dynasty;
    const similarPoems = (unlearnedPoems || []).filter(p => p.dynasty === favDynasty);
    similarPoems.slice(0, 2).forEach(p => {
      learnItems.push({
        type: 'topic_learning',
        poem_id: p.id,
        title: p.title,
        author: p.author,
        content: p.content,
        dynasty: p.dynasty,
        reason: `基于您收藏的${favDynasty || '该题材'}诗，推荐学习同类型作品`,
        tag: '专题学习'
      });
    });
  }

  const correctCount = (challengeRecords || []).filter(r => r.is_correct === 1).length;
  if (correctCount >= 3) {
    const nextChallenge = Math.floor(correctCount / 3) + 1;
    learnItems.push({
      type: 'battle_suggestion',
      poem_id: null,
      title: `进阶挑战 Lv.${nextChallenge}`,
      author: null,
      content: null,
      dynasty: null,
      reason: `您最近对战表现优异，建议挑战更高难度关卡`,
      tag: '对战建议'
    });
  }

  const unlearned = unlearnedPoems || [];
  if (learnItems.length < 4 && unlearned.length > 0) {
    unlearned.slice(0, 4 - learnItems.length).forEach(p => {
      learnItems.push({
        type: 'random_discovery',
        poem_id: p.id,
        title: p.title,
        author: p.author,
        content: p.content,
        dynasty: p.dynasty,
        reason: `随机推荐：拓展诗词视野，发现更多美好`,
        tag: '探索发现'
      });
    });
  }

  return learnItems.slice(0, 4);
}

/**
 * 调用 AI 生成综合分析报告
 */
async function generateAIAnalysisReport(userId, wrongQuestions, challengeRecords, feihuaRecords, learningRecords) {
  const recited = (learningRecords || []).filter(r => r.recite_attempts > 0);
  const totalAttempts = recited.reduce((s, r) => s + r.recite_attempts, 0);
  const totalScoreSum = recited.reduce((s, r) => s + (r.total_score || 0), 0);
  const avgScore = totalAttempts > 0 ? Math.round(totalScoreSum / totalAttempts) : 0;
  const wrongCount = (wrongQuestions || []).length;
  const masteredCount = recited.filter(r => r.best_score >= 90).length;
  const masteryRate = recited.length > 0 ? Math.round((masteredCount / recited.length) * 100) : 0;
  const totalLearned = (learningRecords || []).length;

  // 朝代分布分析
  const dynastyCount = {};
  (learningRecords || []).forEach(r => {
    const d = r.dynasty || '未知';
    dynastyCount[d] = (dynastyCount[d] || 0) + 1;
  });
  const topDynasty = Object.entries(dynastyCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '未知';
  const dynastyList = Object.entries(dynastyCount).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // 典型错题分析
  const typicalWrong = (wrongQuestions || []).slice(0, 5).map(wq => ({
    title: wq.title || wq.poem_title,
    author: wq.author || wq.poem_author,
    question: wq.question || '',
    user_answer: wq.user_answer || '',
    correct_answer: wq.answer || '',
    wrong_count: wq.wrong_count || 1
  }));

  // 学习频率分析（基于最近学习时间）
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recentRecords = (learningRecords || []).filter(r => {
    const lastView = new Date(r.last_view_time).getTime();
    return lastView > oneWeekAgo;
  });
  const weeklyStudyDays = new Set(recentRecords.map(r => {
    const d = new Date(r.last_view_time);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  })).size;

  // 闯关表现分析
  const challengeCorrect = (challengeRecords || []).filter(r => r.is_correct === 1).length;
  const challengeTotal = (challengeRecords || []).length;
  const challengeRate = challengeTotal > 0 ? Math.round((challengeCorrect / challengeTotal) * 100) : 0;

  // 背诵表现分析
  const highScoreRecite = recited.filter(r => (r.best_score || 0) >= 90).length;
  const lowScoreRecite = recited.filter(r => (r.best_score || 0) < 70).length;

  const summary = {
    user_id: userId,
    total_learned: totalLearned,
    average_score: avgScore,
    mastery_rate: masteryRate,
    wrong_count: wrongCount,
    total_recite_attempts: totalAttempts,
    top_dynasty: topDynasty,
    dynasty_distribution: dynastyCount,
    dynasty_list: dynastyList,
    typical_wrong_questions: typicalWrong,
    challenge_correct_count: challengeCorrect,
    challenge_total_count: challengeTotal,
    challenge_rate: challengeRate,
    weekly_study_days: weeklyStudyDays,
    high_score_recite: highScoreRecite,
    low_score_recite: lowScoreRecite
  };

  // 如果是新用户（无任何学习数据），直接返回模拟分析（跳过AI调用以提升速度）
  if (totalLearned === 0 && wrongCount === 0 && challengeTotal === 0) {
    console.log('[personalizedService] 新用户或无学习数据，直接返回模拟分析（跳过AI调用）');
    return getMockAnalysisReport(summary);
  }

  const config = require('../config/config');
  const { callSiliconFlowGenerateJSON } = require('./aiService');
  
  const apiKey = config.siliconflow.apiKey;
  if (!apiKey) {
    console.log('[personalizedService] 无硅基流动API Key，返回模拟分析');
    return getMockAnalysisReport(summary);
  }

  try {
    console.log('[personalizedService] 开始调用硅基流动AI生成分析报告...');

    const result = await callSiliconFlowGenerateJSON(
      `请根据以下学生的真实学习数据，生成一份高度个性化的诗词学习分析报告。

【学生数据摘要】
- 已学习诗词数量：${totalLearned}首
- 平均背诵得分：${avgScore}分
- 诗词掌握率：${masteryRate}%
- 当前错题数量：${wrongCount}道
- 总背诵练习次数：${totalAttempts}次
- 本周学习天数：${weeklyStudyDays}天
- 闯关正确率：${challengeRate}%（${challengeCorrect}/${challengeTotal}题）

【朝代学习分布】
${dynastyList.map(([d, count]) => `- ${d}诗：${count}首`).join('\n')}

【典型错题详情】
${typicalWrong.length > 0 ? typicalWrong.map((wq, i) => `第${i + 1}题：《${wq.title}》${wq.author ? `（${wq.author}）` : ''}，错误${wq.wrong_count}次，常见错误："${wq.user_answer || '未记录'}"，正确答案："${wq.correct_answer || '未记录'}"，考察点："${wq.question || '未记录'}"`).join('\n') : '暂无错题记录'}

【背诵得分分布】
- 高分诗词（90分以上）：${highScoreRecite}首
- 待提高诗词（70分以下）：${lowScoreRecite}首

直接返回以下JSON格式，不要输出任何分析或解释：
{"strength":["具体优势1","具体优势2","具体优势3"],"weakness":["具体不足1","具体不足2","具体不足3"],"suggestion":["针对性强、可操作的具体建议1","针对性强、可操作的具体建议2","针对性强、可操作的具体建议3"],"summary":"一段80字以内的个性化综合评价，要提到具体数字和具体诗词或朝代"}`,
      `你是资深古诗词教育专家。紧密结合学生数据生成分析报告。直接返回JSON，不要输出任何分析过程。`,
      { temperature: 0.5, maxTokens: 800, timeout: 30000 }
    );

    // 增强格式兼容性处理
    if (result) {
      // 尝试从不同可能的字段名中提取数据
      const strength = result.strength || result.优势 || result.goodPoints || result.strongPoints || [];
      const weakness = result.weakness || result.不足 || result.weakPoints || result.problems || [];
      const suggestion = result.suggestion || result.建议 || result.advices || result.tips || result.recommendations || [];
      const summaryText = result.summary || result.总结 || result.评价 || result.comment || '';

      // 检查是否有有效数据
      const hasValidData = (Array.isArray(strength) && strength.length > 0) ||
                          (Array.isArray(weakness) && weakness.length > 0) ||
                          (Array.isArray(suggestion) && suggestion.length > 0);

      if (hasValidData || summaryText) {
        console.log('[personalizedService] AI分析报告生成成功');
        return {
          strength: Array.isArray(strength) ? strength : [],
          weakness: Array.isArray(weakness) ? weakness : [],
          suggestion: Array.isArray(suggestion) ? suggestion : [],
          summary: summaryText || `您已学习${totalLearned}首诗词，平均得分${avgScore}分，继续加油！`,
          stats: summary
        };
      }
    }

    console.warn('[personalizedService] AI返回结果格式不正确，使用模拟数据');
  } catch (err) {
    console.error('[personalizedService] AI分析失败:', err.message);
    console.log('[personalizedService] 使用模拟分析报告作为降级方案');
  }

  return getMockAnalysisReport(summary);
}

function getMockAnalysisReport(summary) {
  const {
    total_learned,
    average_score,
    mastery_rate,
    wrong_count,
    top_dynasty,
    dynasty_list = [],
    typical_wrong_questions = [],
    challenge_rate,
    weekly_study_days
  } = summary;

  // 根据不同数据情况生成个性化建议
  const strength = [];
  const weakness = [];
  const suggestion = [];

  // 优势分析
  if (total_learned >= 20) {
    strength.push(`已学习${total_learned}首诗词，学习量可观，积累扎实`);
  } else if (total_learned > 0) {
    strength.push(`已开启诗词学习之旅，完成${total_learned}首诗词学习`);
  }

  if (average_score >= 85) {
    strength.push(`平均得分${average_score}分，处于优秀水平`);
  } else if (average_score >= 70) {
    strength.push(`平均得分${average_score}分，整体掌握较好`);
  }

  if (top_dynasty && dynasty_list.length > 1) {
    strength.push(`在${top_dynasty}诗词上有明显优势，朝代学习覆盖${dynasty_list.length}个时期`);
  } else if (top_dynasty) {
    strength.push(`在${top_dynasty}诗词学习上表现稳定`);
  }

  if (mastery_rate >= 80) {
    strength.push(`诗词掌握率达${mastery_rate}%，记忆效果良好`);
  }

  if (challenge_rate >= 80) {
    strength.push(`闯关正确率达${challenge_rate}%，答题能力强`);
  }

  // 确保至少有3个优势
  while (strength.length < 3) {
    if (total_learned === 0) {
      strength.push('作为新用户，拥有无限的学习潜力');
      break;
    }
    strength.push('保持学习热情，诗词素养在不断提升');
    break;
  }

  // 不足分析
  if (wrong_count > 0 && typical_wrong_questions.length > 0) {
    const firstWrong = typical_wrong_questions[0];
    if (firstWrong && firstWrong.title) {
      weakness.push(`《${firstWrong.title}》出现${firstWrong.wrong_count || 1}次错误，需要重点复习`);
    } else {
      weakness.push(`错题库有${wrong_count}道待巩固`);
    }
  } else if (wrong_count > 0) {
    weakness.push(`错题库有${wrong_count}道需要加强复习`);
  }

  if (average_score < 70) {
    weakness.push(`平均得分${average_score}分，需加强背诵练习提高准确率`);
  } else if (average_score < 85) {
    weakness.push(`平均得分${average_score}分，部分诗词仍需精进`);
  }

  if (total_learned < 10) {
    weakness.push(`学习诗词数量${total_learned}首，建议增加每日学习量`);
  }

  if (weekly_study_days < 3) {
    weakness.push(`本周学习${weekly_study_days}天，学习频率可提升`);
  }

  if (dynasty_list.length < 2 && total_learned > 0) {
    weakness.push('朝代学习覆盖较单一，建议拓展唐诗宋词等不同风格');
  }

  // 确保至少有3个不足
  while (weakness.length < 3) {
    if (total_learned === 0) {
      weakness.push('尚未开始学习，需要尽快开始诗词之旅');
      break;
    }
    weakness.push('部分高难度诗词掌握不够扎实');
    break;
  }

  // 建议分析
  if (wrong_count > 0 && typical_wrong_questions.length > 0) {
    const firstWrong = typical_wrong_questions[0];
    if (firstWrong && firstWrong.title) {
      suggestion.push(`建议优先复习《${firstWrong.title}》，每天朗读3遍加深记忆`);
    }
  }

  if (weekly_study_days < 5) {
    suggestion.push(`建议每周保持5天以上的学习频率，今天抽空学习一首新诗吧`);
  }

  if (average_score < 80) {
    suggestion.push(`建议每天晨读10分钟背诵已学诗词，提高记忆巩固度`);
  }

  if (total_learned > 0 && total_learned < 30) {
    suggestion.push(`建议在掌握基础上每天新增1-2首诗词，循序渐进扩大诗词储备`);
  }

  if (challenge_rate < 70 && challenge_rate > 0) {
    suggestion.push(`闯关正确率${challenge_rate}%建议提升，可通过飞花令游戏加强实战练习`);
  }

  if (dynasty_list.length < 2 && total_learned > 5) {
    suggestion.push(`建议拓展学习${top_dynasty}以外的其他朝代诗词，如${top_dynasty === '唐' ? '宋词、元曲' : '唐诗'}等`);
  }

  // 确保至少有3个建议
  while (suggestion.length < 3) {
    suggestion.push('坚持每日诗词打卡，培养良好的学习习惯');
    break;
  }

  // 生成个性化总结
  let summaryText = '';
  if (total_learned === 0) {
    summaryText = '欢迎开始您的诗词学习之旅！';
  } else if (total_learned < 5) {
    summaryText = `作为初学者，您已学习${total_learned}首诗词，平均得分${average_score}分。继续坚持，每天一首，诗词素养在悄然提升！`;
  } else if (total_learned < 20) {
    summaryText = `您已学习${total_learned}首诗词，${top_dynasty}类掌握较好，平均得分${average_score}分。继续保持学习热情！`;
  } else if (total_learned < 50) {
    summaryText = `学习达${total_learned}首诗词，覆盖${dynasty_list.length}个朝代，平均得分${average_score}分，掌握率${mastery_rate}%。`;
  } else {
    summaryText = `学习达人！已掌握${total_learned}首诗词，${top_dynasty}诗词尤为突出，平均得分${average_score}分。继续保持！`;
  }

  return {
    strength: strength.slice(0, 3),
    weakness: weakness.slice(0, 3),
    suggestion: suggestion.slice(0, 3),
    summary: summaryText,
    stats: summary
  };
}

// 获取复习推荐数据（独立接口）
async function getReviewRecommendations(userId) {
  try {
    const [wrongQuestions, challengeRecords, feihuaRecords] = await Promise.all([
      getWrongQuestions(userId).catch(err => {
        console.error('[personalizedService] 获取错题失败:', err.message);
        return [];
      }),
      getChallengeRecords(userId).catch(err => {
        console.error('[personalizedService] 获取闯关记录失败:', err.message);
        return [];
      }),
      getFeihuaRecords(userId).catch(err => {
        console.error('[personalizedService] 获取飞花令记录失败:', err.message);
        return [];
      })
    ]);

    const recommendations = buildReviewRecommendations(wrongQuestions, challengeRecords, feihuaRecords);
    return {
      success: true,
      data: recommendations,
      _meta: {
        wrong_count: wrongQuestions.length,
        challenge_fail_count: (challengeRecords || []).filter(r => r.is_correct === 0).length
      }
    };
  } catch (err) {
    console.error('[personalizedService] 获取复习推荐失败:', err);
    return {
      success: false,
      data: [],
      error: err.message
    };
  }
}

// 获取学习推荐数据（独立接口）
async function getLearnRecommendations(userId) {
  try {
    const [learningRecords, unlearnedPoems, favoritePoems, challengeRecords] = await Promise.all([
      getLearningRecords(userId).catch(err => {
        console.error('[personalizedService] 获取学习记录失败:', err.message);
        return [];
      }),
      getUnlearnedPoems(userId, null, 30).catch(err => {
        console.error('[personalizedService] 获取未学诗词失败:', err.message);
        return [];
      }),
      getFavoritePoems(userId).catch(err => {
        console.error('[personalizedService] 获取收藏诗词失败:', err.message);
        return [];
      }),
      getChallengeRecords(userId).catch(err => {
        console.error('[personalizedService] 获取闯关记录失败:', err.message);
        return [];
      })
    ]);

    const recommendations = buildLearnRecommendations(learningRecords, unlearnedPoems, favoritePoems, challengeRecords);
    return {
      success: true,
      data: recommendations,
      _meta: {
        learned_count: learningRecords.length,
        unlearned_count: unlearnedPoems.length,
        favorite_count: favoritePoems.length
      }
    };
  } catch (err) {
    console.error('[personalizedService] 获取学习推荐失败:', err);
    return {
      success: false,
      data: [],
      error: err.message
    };
  }
}

/**
 * 获取完整的个性化推荐数据
 */
async function getPersonalizedData(userId) {
  console.log('[personalizedService] 开始获取个性化数据，用户ID:', userId);
  
  try {
    const [wrongQuestions, challengeRecords, feihuaRecords, learningRecords, unlearnedPoems, favoritePoems] =
      await Promise.all([
        getWrongQuestions(userId).catch(err => {
          console.error('[personalizedService] 获取错题失败:', err.message);
          return [];
        }),
        getChallengeRecords(userId).catch(err => {
          console.error('[personalizedService] 获取闯关记录失败:', err.message);
          return [];
        }),
        getFeihuaRecords(userId).catch(err => {
          console.error('[personalizedService] 获取飞花令记录失败:', err.message);
          return [];
        }),
        getLearningRecords(userId).catch(err => {
          console.error('[personalizedService] 获取学习记录失败:', err.message);
          return [];
        }),
        getUnlearnedPoems(userId, null, 20).catch(err => {
          console.error('[personalizedService] 获取未学诗词失败:', err.message);
          return [];
        }),
        getFavoritePoems(userId).catch(err => {
          console.error('[personalizedService] 获取收藏诗词失败:', err.message);
          return [];
        })
      ]);

    console.log('[personalizedService] 数据获取完成:', {
      wrongQuestions: wrongQuestions.length,
      challengeRecords: challengeRecords.length,
      feihuaRecords: feihuaRecords.length,
      learningRecords: learningRecords.length,
      unlearnedPoems: unlearnedPoems.length,
      favoritePoems: favoritePoems.length
    });

    const reviewRecommendations = buildReviewRecommendations(wrongQuestions, challengeRecords, feihuaRecords);
    const learnRecommendations = buildLearnRecommendations(learningRecords, unlearnedPoems, favoritePoems, challengeRecords);
    
    console.log('[personalizedService] 开始生成AI分析报告...');
    const aiAnalysis = await generateAIAnalysisReport(userId, wrongQuestions, challengeRecords, feihuaRecords, learningRecords);

    const result = {
      review: reviewRecommendations,
      learn: learnRecommendations,
      analysis: aiAnalysis,
      _meta: {
        total_learned: learningRecords.length,
        wrong_count: wrongQuestions.length,
        has_data: learningRecords.length > 0 || wrongQuestions.length > 0
      }
    };

    console.log('[personalizedService] 个性化数据生成完成');
    return result;
  } catch (err) {
    console.error('[personalizedService] 获取个性化数据失败:', err);
    return {
      review: [],
      learn: [],
      analysis: getMockAnalysisReport({
        user_id: userId,
        total_learned: 0,
        average_score: 0,
        mastery_rate: 0,
        wrong_count: 0,
        total_recite_attempts: 0,
        top_dynasty: '未知',
        dynasty_distribution: {},
        typical_wrong_questions: [],
        challenge_correct_count: 0,
        challenge_total_count: 0
      }),
      _meta: {
        total_learned: 0,
        wrong_count: 0,
        has_data: false,
        error: err.message
      }
    };
  }
}

module.exports = {
  getWrongQuestions,
  getChallengeRecords,
  getFeihuaRecords,
  getLearningRecords,
  getRecentLearnedPoems,
  getUnlearnedPoems,
  getFavoritePoems,
  buildReviewRecommendations,
  buildLearnRecommendations,
  generateAIAnalysisReport,
  getReviewRecommendations,
  getLearnRecommendations,
  getPersonalizedData
};
