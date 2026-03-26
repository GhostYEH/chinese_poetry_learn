// AI学习路径服务
const { db } = require('../utils/db');
const aiService = require('./aiService');

/**
 * 评估用户学习水平
 */
function assessUserLevel(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        COUNT(DISTINCT lr.poem_id) as poems_learned,
        COALESCE(AVG(CASE WHEN lr.best_score > 0 THEN lr.best_score ELSE NULL END), 0) as avg_score,
        COALESCE(MAX(lr.best_score), 0) as max_score,
        (SELECT COUNT(*) FROM wrong_questions wq WHERE wq.user_id = ? AND wq.mastered = 0) as wrong_count,
        (SELECT COUNT(*) FROM wrong_questions wq WHERE wq.user_id = ? AND wq.mastered = 1) as mastered_count,
        (SELECT current_challenge_level FROM user_challenge_progress WHERE user_id = ?) as challenge_level,
        (SELECT COUNT(*) FROM learning_records WHERE user_id = ? AND recite_attempts > 0) as poems_recited
      FROM learning_records lr
      WHERE lr.user_id = ?
    `, [userId, userId, userId, userId, userId], (err, row) => {
      if (err) { reject(err); return; }
      
      const poemsLearned = row?.poems_learned || 0;
      const avgScore = row?.avg_score || 0;
      const maxScore = row?.max_score || 0;
      const wrongCount = row?.wrong_count || 0;
      const masteredCount = row?.mastered_count || 0;
      const challengeLevel = row?.challenge_level || 1;
      const poemsRecited = row?.poems_recited || 0;
      
      // 计算综合水平分数
      let levelScore = 0;
      levelScore += Math.min(poemsLearned * 2, 30);  // 已学诗词 (最多30分)
      levelScore += Math.min(avgScore * 0.3, 30);    // 平均得分 (最多30分)
      levelScore += Math.min(challengeLevel * 0.5, 20); // 闯关等级 (最多20分)
      levelScore += Math.max(0, 20 - wrongCount * 2);  // 错题扣分 (最多20分)
      
      let level = '初级';
      if (levelScore >= 70) level = '精通';
      else if (levelScore >= 50) level = '进阶';
      else if (levelScore >= 25) level = '基础';
      
      resolve({
        level,
        levelScore: Math.round(levelScore),
        poemsLearned,
        avgScore: Math.round(avgScore),
        maxScore,
        wrongCount,
        masteredCount,
        challengeLevel,
        poemsRecited
      });
    });
  });
}

/**
 * 生成个性化学习路径
 */
async function generateLearningPath(userId) {
  try {
    const assessment = await assessUserLevel(userId);
    const recommendations = [];
    
    // 获取已学习诗词的标签
    const learnedTags = await getLearnedTags(userId);
    
    // 获取用户错题类型分析
    const weakAreas = await getWeakAreas(userId);
    
    // 根据水平推荐学习内容
    if (assessment.level === '初级') {
      recommendations.push({ type: '基础', content: '李白诗词精选（5首）', priority: 'high' });
      recommendations.push({ type: '主题', content: '思乡主题诗词', priority: 'high' });
      recommendations.push({ type: '训练', content: '基础名句背诵训练', priority: 'medium' });
      recommendations.push({ type: '诗人', content: '杜甫代表作品', priority: 'medium' });
    } else if (assessment.level === '基础') {
      recommendations.push({ type: '进阶', content: '唐诗三百首精选', priority: 'high' });
      recommendations.push({ type: '主题', content: '送别主题诗词', priority: 'high' });
      recommendations.push({ type: '诗人', content: '白居易代表作品', priority: 'medium' });
      if (weakAreas.length > 0) {
        recommendations.push({ type: '薄弱', content: `加强${weakAreas[0]}类型训练`, priority: 'high' });
      }
    } else if (assessment.level === '进阶') {
      recommendations.push({ type: '提升', content: '宋词经典赏析', priority: 'high' });
      recommendations.push({ type: '诗人', content: '苏轼诗词专题', priority: 'high' });
      recommendations.push({ type: '主题', content: '爱国诗词精选', priority: 'medium' });
      recommendations.push({ type: '竞技', content: '飞花令实战训练', priority: 'medium' });
    } else {
      recommendations.push({ type: '精通', content: '诗经楚辞鉴赏', priority: 'high' });
      recommendations.push({ type: '创作', content: '诗词创作挑战', priority: 'high' });
      recommendations.push({ type: '竞技', content: '飞花令高级排位赛', priority: 'medium' });
      recommendations.push({ type: '综合', content: '跨时代诗词对比', priority: 'low' });
    }
    
    // 尝试使用AI生成更精准的推荐
    const aiRecommendations = await generateAIRecommendations(userId, assessment);
    if (aiRecommendations && aiRecommendations.length > 0) {
      // 合并AI推荐（优先级更高的放在前面）
      const merged = [...aiRecommendations, ...recommendations.filter(r => 
        !aiRecommendations.some(ai => ai.content === r.content)
      )].slice(0, 5);
      return {
        level: assessment.level,
        levelScore: assessment.levelScore,
        recommendations: merged,
        assessment,
        generatedBy: 'ai'
      };
    }
    
    return {
      level: assessment.level,
      levelScore: assessment.levelScore,
      recommendations,
      assessment,
      generatedBy: 'rule'
    };
  } catch (error) {
    console.error('生成学习路径失败:', error);
    return getFallbackPath();
  }
}

async function generateAIRecommendations(userId, assessment) {
  try {
    const poems = await getUserRecentPoems(userId);
    const poemsText = poems.map(p => `${p.title} - ${p.author}: ${p.content}`).join('\n');
    
    const prompt = `基于以下用户学习数据，生成5条个性化学习推荐：
    
用户当前水平：${assessment.level}（${assessment.levelScore}分）
已学习诗词：${assessment.poemsLearned}首
平均得分：${assessment.avgScore}%
错题数量：${assessment.wrongCount}题
已掌握：${assessment.masteredCount}题

用户已学诗词：
${poemsText || '暂无'}

请按JSON数组格式返回，每条推荐包含：
- type: 类型（诗人/主题/训练/竞技/创作）
- content: 具体推荐内容
- priority: 优先级（high/medium/low）

要求：
1. 推荐要具体、有针对性
2. 优先弥补薄弱环节
3. 符合用户当前水平
4. 内容要吸引学习兴趣`;

    const result = await aiService.callAIGenerateJSON(
      prompt,
      '你是一位古诗词教育专家，擅长根据学生的学习情况提供个性化的学习建议。',
      { temperature: 0.7, max_tokens: 800 }
    );
    
    if (result && Array.isArray(result)) {
      return result;
    }
    if (result && result.recommendations) {
      return result.recommendations;
    }
    return null;
  } catch (error) {
    console.error('AI生成推荐失败:', error);
    return null;
  }
}

function getLearnedTags(userId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT DISTINCT p.tags
      FROM learning_records lr
      JOIN poems p ON lr.poem_id = p.id
      WHERE lr.user_id = ? AND lr.view_count > 0
    `, [userId], (err, rows) => {
      if (err) { reject(err); return; }
      const tags = [];
      rows.forEach(row => {
        if (row.tags) {
          row.tags.split(',').forEach(tag => tags.push(tag.trim()));
        }
      });
      resolve([...new Set(tags)]);
    });
  });
}

function getWeakAreas(userId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        CASE 
          WHEN wq.level <= 50 THEN '记忆'
          WHEN wq.level <= 150 THEN '理解'
          ELSE '应用'
        END as weak_area,
        COUNT(*) as count
      FROM wrong_questions wq
      WHERE wq.user_id = ? AND wq.mastered = 0
      GROUP BY weak_area
      ORDER BY count DESC
      LIMIT 3
    `, [userId], (err, rows) => {
      if (err) { reject(err); return; }
      resolve(rows.map(r => r.weak_area));
    });
  });
}

function getUserRecentPoems(userId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT p.title, p.author, p.content, lr.last_view_time
      FROM learning_records lr
      JOIN poems p ON lr.poem_id = p.id
      WHERE lr.user_id = ?
      ORDER BY lr.last_view_time DESC
      LIMIT 10
    `, [userId], (err, rows) => {
      if (err) { reject(err); return; }
      resolve(rows || []);
    });
  });
}

function getFallbackPath() {
  return {
    level: '初级',
    levelScore: 20,
    recommendations: [
      { type: '基础', content: '经典唐诗入门（10首）', priority: 'high' },
      { type: '主题', content: '自然风光诗词', priority: 'high' },
      { type: '训练', content: '简单背诵练习', priority: 'medium' }
    ],
    assessment: null,
    generatedBy: 'fallback'
  };
}

/**
 * 更新学习路径
 */
function updateLearningPath(userId, updates) {
  return new Promise((resolve, reject) => {
    const { level, recommendations, current_focus } = updates;
    const recommendationsJson = JSON.stringify(recommendations);
    
    db.run(`
      INSERT INTO learning_paths (user_id, level, recommendations, current_focus, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        level = excluded.level,
        recommendations = excluded.recommendations,
        current_focus = excluded.current_focus,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, level, recommendationsJson, current_focus || null], (err) => {
      if (err) { reject(err); return; }
      resolve({ success: true });
    });
  });
}

/**
 * 获取用户学习路径
 */
function getLearningPath(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM learning_paths WHERE user_id = ?', [userId], (err, row) => {
      if (err) { reject(err); return; }
      if (row && row.recommendations) {
        try {
          row.recommendations = JSON.parse(row.recommendations);
        } catch (e) {}
      }
      resolve(row);
    });
  });
}

module.exports = {
  assessUserLevel,
  generateLearningPath,
  updateLearningPath,
  getLearningPath,
  getLearnedTags,
  getWeakAreas
};
