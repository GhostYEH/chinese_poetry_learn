// 个性化推荐服务
// 整合错题本、闯关记录、游戏记录，调用AI生成个性化推荐与分析报告
require('dotenv').config();
const axios = require('axios');
const { db } = require('../utils/db');
const { callAIGenerateJSON } = require('./aiService');

/**
 * 获取用户错题本数据
 */
function getWrongQuestions(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT wq.*, p.title as poem_title, p.author as poem_author, p.content as poem_content
       FROM wrong_questions wq
       LEFT JOIN poems p ON wq.poem_id = p.id
       WHERE wq.user_id = ?
       ORDER BY wq.created_at DESC`,
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
      `SELECT cr.*, p.title as poem_title, p.author as poem_author, p.content as poem_content
       FROM challenge_records cr
       LEFT JOIN poems p ON cr.poem_id = p.id
       WHERE cr.user_id = ?
       ORDER BY cr.created_at DESC`,
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
      `SELECT * FROM feihua_high_records WHERE user_id = ? ORDER BY score DESC LIMIT 20`,
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

  // 从错题本构建复习推荐
  wrongQuestions.slice(0, 5).forEach(wq => {
    reviewItems.push({
      type: 'wrong_question',
      poem_id: wq.poem_id,
      title: wq.poem_title,
      author: wq.poem_author,
      content: wq.poem_content,
      reason: `错题回顾：上次答题出错，建议复习`,
      difficulty: wq.difficulty || '中等',
      times: 1,
      tag: '错题本'
    });
  });

  // 从闯关失败记录构建复习推荐
  (challengeRecords || []).filter(r => r.is_correct === 0 || r.score < 60).slice(0, 3).forEach(cr => {
    reviewItems.push({
      type: 'challenge_fail',
      poem_id: cr.poem_id,
      title: cr.poem_title,
      author: cr.poem_author,
      content: cr.poem_content,
      reason: `闯关未通过，正确率仅${cr.score || 0}%，需要巩固`,
      difficulty: cr.difficulty || '中等',
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

  // 已学诗词：下一关推荐（找下一首难度相近但未深入学习的）
  const learned = learningRecords || [];
  if (learned.length > 0) {
    const avgScore = learned.reduce((s, r) => s + (r.best_score || 0), 0) / learned.length;
    const nextLevel = learned.filter(r => r.best_score < 80);
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

  // 未学诗词：专题学习推荐
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

  // 对战建议（从闯关高分记录推荐进阶）
  const highScores = (challengeRecords || []).filter(r => r.score >= 80);
  if (highScores.length >= 3) {
    const avgScore = highScores.reduce((s, r) => s + r.score, 0) / highScores.length;
    const nextChallenge = Math.floor(avgScore / 20) + 1;
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

  // 随机推荐未学诗词补位
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
  const apiKey = process.env.SILICONFLOW_API_KEY;

  const recited = (learningRecords || []).filter(r => r.recite_attempts > 0);
  const totalAttempts = recited.reduce((s, r) => s + r.recite_attempts, 0);
  const totalScoreSum = recited.reduce((s, r) => s + (r.total_score || 0), 0);
  const avgScore = totalAttempts > 0 ? Math.round(totalScoreSum / totalAttempts) : 0;
  const wrongCount = (wrongQuestions || []).length;
  const masteredCount = recited.filter(r => r.best_score >= 90).length;
  const masteryRate = recited.length > 0 ? Math.round((masteredCount / recited.length) * 100) : 0;
  const totalLearned = (learningRecords || []).length;

  // 统计各朝代分布
  const dynastyCount = {};
  (learningRecords || []).forEach(r => {
    const d = r.dynasty || '未知';
    dynastyCount[d] = (dynastyCount[d] || 0) + 1;
  });
  const topDynasty = Object.entries(dynastyCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '未知';

  // 典型错题示例
  const typicalWrong = (wrongQuestions || []).slice(0, 3).map(wq => ({
    title: wq.poem_title,
    author: wq.poem_author,
    question: wq.question,
    user_answer: wq.user_answer,
    correct_answer: wq.correct_answer
  }));

  const summary = {
    user_id: userId,
    total_learned: totalLearned,
    average_score: avgScore,
    mastery_rate: masteryRate,
    wrong_count: wrongCount,
    total_recite_attempts: totalAttempts,
    top_dynasty: topDynasty,
    dynasty_distribution: dynastyCount,
    typical_wrong_questions: typicalWrong,
    challenge_high_score: Math.max(0, ...(challengeRecords || []).map(r => r.score || 0))
  };

  const payload = JSON.stringify(summary, null, 2);

  if (!apiKey) {
    // 无 API Key 时返回模拟分析
    return getMockAnalysisReport(summary);
  }

  try {
    const result = await callAIGenerateJSON(
      `请根据以下用户学习数据，生成一份个性化的诗词学习分析报告。

数据摘要：
- 已学习诗词：${totalLearned}首
- 平均背诵得分：${avgScore}分
- 诗词掌握率：${masteryRate}%
- 错题数量：${wrongCount}道
- 总背诵次数：${totalAttempts}次
- 最擅长朝代：${topDynasty}
- 闯关最高分：${summary.challenge_high_score}分

典型错题：${JSON.stringify(typicalWrong)}

请严格按照以下JSON格式返回分析报告（不要添加任何额外文字）：

{
  "strength": ["优势1", "优势2", "优势3"],
  "weakness": ["不足1", "不足2", "不足3"],
  "suggestion": ["建议1", "建议2", "建议3"],
  "summary": "一段综合评价（50字以内）"
}`,
      `你是一位资深古诗词学习分析师，擅长从学习数据中提炼用户的学习特点，给出专业、有洞察力的分析报告。分析要具体、务实、有建设性。`,
      { temperature: 0.5, maxTokens: 1200 }
    );

    if (result && result.strength && result.weakness && result.suggestion) {
      return {
        ...result,
        summary: result.summary || `您已学习${totalLearned}首诗词，平均得分${avgScore}分，继续加油！`,
        stats: summary
      };
    }
  } catch (err) {
    console.error('[personalizedService] AI分析失败:', err.message);
  }

  return getMockAnalysisReport(summary);
}

function getMockAnalysisReport(summary) {
  const { totalLearned, avgScore, masteryRate, wrongCount, topDynasty } = summary;
  return {
    strength: [
      `已学习${totalLearned}首诗词，积累扎实`,
      `在${topDynasty}类诗词上表现突出`,
      avgScore >= 70 ? '整体背诵正确率良好' : '学习态度认真，坚持练习'
    ],
    weakness: [
      wrongCount > 0 ? `错题库有${wrongCount}道需要巩固` : '部分诗词掌握不够扎实',
      avgScore < 80 ? '背诵准确率有提升空间' : '进阶难度诗词还需加强',
      totalLearned < 10 ? '学习数量偏少，建议增加每日学习量' : '诗词广度可以进一步拓展'
    ],
    suggestion: [
      '建议每天复习2-3首错题，加深记忆',
      '可以尝试飞花令游戏，在对战中巩固知识',
      '推荐学习同类型诗词，构建系统知识体系'
    ],
    summary: `学习${totalLearned}首诗词，平均得分${avgScore}分，继续保持学习热情！`,
    stats: summary
  };
}

/**
 * 获取完整的个性化推荐数据
 */
async function getPersonalizedData(userId) {
  try {
    const [wrongQuestions, challengeRecords, feihuaRecords, learningRecords, unlearnedPoems, favoritePoems] =
      await Promise.all([
        getWrongQuestions(userId),
        getChallengeRecords(userId),
        getFeihuaRecords(userId),
        getLearningRecords(userId),
        getUnlearnedPoems(userId, null, 20),
        getFavoritePoems(userId)
      ]);

    const reviewRecommendations = buildReviewRecommendations(wrongQuestions, challengeRecords, feihuaRecords);
    const learnRecommendations = buildLearnRecommendations(learningRecords, unlearnedPoems, favoritePoems, challengeRecords);
    const aiAnalysis = await generateAIAnalysisReport(userId, wrongQuestions, challengeRecords, feihuaRecords, learningRecords);

    return {
      review: reviewRecommendations,
      learn: learnRecommendations,
      analysis: aiAnalysis,
      _meta: {
        total_learned: learningRecords.length,
        wrong_count: wrongQuestions.length,
        has_data: learningRecords.length > 0 || wrongQuestions.length > 0
      }
    };
  } catch (err) {
    console.error('[personalizedService] 获取个性化数据失败:', err);
    throw err;
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
  getPersonalizedData
};
