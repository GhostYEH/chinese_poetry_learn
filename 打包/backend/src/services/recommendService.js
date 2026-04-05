// 推荐学习服务

// 推荐算法实现
function generateRecommendations(poems, learningRecords, mistakes) {
  const recommendations = [];
  const usedPoemIds = new Set();
  
  // 1. 优先推荐错题
  if (mistakes && mistakes.length > 0) {
    mistakes.forEach(mistake => {
      const poem = poems.find(p => p.id === mistake.poem_id);
      if (poem && !usedPoemIds.has(poem.id)) {
        recommendations.push({
          ...poem,
          recommend_reason: '错题',
          priority: 1
        });
        usedPoemIds.add(poem.id);
      }
    });
  }
  
  // 2. 推荐低分诗（背诵得分低的诗）
  if (learningRecords) {
    const lowScorePoems = Object.values(learningRecords)
      .filter(record => record.recite_attempts > 0 && record.best_score < 80)
      .sort((a, b) => a.best_score - b.best_score);
    
    lowScorePoems.forEach(record => {
      const poem = poems.find(p => p.id === record.poem_id);
      if (poem && !usedPoemIds.has(poem.id)) {
        recommendations.push({
          ...poem,
          recommend_reason: `低分诗（${record.best_score}分）`,
          priority: 2
        });
        usedPoemIds.add(poem.id);
      }
    });
  }
  
  // 3. 推荐同作者的诗
  if (learningRecords) {
    // 获取最近学习的诗的作者
    const recentLearned = Object.values(learningRecords)
      .filter(record => record.view_count > 0 || record.recite_attempts > 0)
      .sort((a, b) => {
        if (!a.last_view_time) return 1;
        if (!b.last_view_time) return -1;
        return new Date(b.last_view_time) - new Date(a.last_view_time);
      })
      .slice(0, 5); // 只取最近学习的5首诗
    
    recentLearned.forEach(record => {
      if (record.poem_author) {
        const sameAuthorPoems = poems.filter(p => 
          p.author === record.poem_author && !usedPoemIds.has(p.id)
        );
        
        sameAuthorPoems.forEach(poem => {
          if (!usedPoemIds.has(poem.id)) {
            recommendations.push({
              ...poem,
              recommend_reason: `同作者（${record.poem_author}）`,
              priority: 3
            });
            usedPoemIds.add(poem.id);
          }
        });
      }
    });
  }
  
  // 4. 推荐未学习的诗（作为补充）
  const unlearnedPoems = poems.filter(poem => {
    if (usedPoemIds.has(poem.id)) return false;
    if (!learningRecords) return true;
    const record = learningRecords[poem.id];
    return !record || (record.view_count === 0 && record.recite_attempts === 0);
  });
  
  // 随机选择一些未学习的诗
  const shuffledUnlearned = unlearnedPoems.sort(() => 0.5 - Math.random());
  shuffledUnlearned.slice(0, 10).forEach(poem => {
    if (!usedPoemIds.has(poem.id)) {
      recommendations.push({
        ...poem,
        recommend_reason: '新诗词',
        priority: 4
      });
      usedPoemIds.add(poem.id);
    }
  });
  
  // 按优先级排序
  return recommendations.sort((a, b) => a.priority - b.priority);
}

// 获取推荐列表
function getRecommendations(poems) {
  // 导入其他服务
  const learningService = require('./learningService');
  const mistakesService = require('./mistakesService');
  
  // 获取学习记录和错题
  const learningRecords = learningService.getLearningStats().reduce((acc, record) => {
    acc[record.poem_id] = record;
    return acc;
  }, {});
  
  const mistakes = mistakesService.getMistakes();
  
  // 生成推荐
  const recommendations = generateRecommendations(poems, learningRecords, mistakes);
  
  // 限制推荐数量
  return recommendations.slice(0, 20);
}

module.exports = {
  getRecommendations
};