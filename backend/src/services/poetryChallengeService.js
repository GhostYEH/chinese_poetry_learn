// 诗词创作挑战服务 - 增强版
const { db } = require('../utils/db');
const aiService = require('./aiService');

/**
 * 主题关键词映射 - 用于验证诗词是否符合主题
 */
const themeKeywords = {
  '春天': ['春', '花', '柳', '绿', '风', '鸟', '燕', '蝶', '芳', '草', '碧', '嫩', '暖', '阳', '芽', '雨', '清明', '东风', '春光', '春色'],
  '夏天': ['夏', '炎', '热', '荷', '蝉', '蛙', '雨', '雷', '电', '凉', '风', '暑', '日', '骄阳', '热浪', '盛夏'],
  '秋天': ['秋', '叶', '落', '金', '黄', '月', '桂', '菊', '枫', '雁', '霜', '风', '凉', '丰收', '金秋', '落叶', '秋风'],
  '冬天': ['冬', '雪', '寒', '梅', '冰', '霜', '风', '冷', '白', '红', '炉', '暖', '凛', '严冬', '寒风', '瑞雪'],
  '思乡': ['乡', '家', '故', '归', '月', '思', '亲', '土', '村', '山', '水', '雁', '路', '远', '故里', '乡愁', '思念'],
  '友情': ['友', '知', '别', '离', '念', '酒', '杯', '逢', '聚', '情', '心', '故人', '知己', '送别', '相知'],
  '山水': ['山', '水', '云', '峰', '林', '泉', '石', '松', '瀑', '江', '河', '湖', '溪', '峰', '烟', '峦', '幽'],
  '爱国': ['国', '家', '山', '河', '志', '壮', '忠', '报', '疆', '马', '青史', '热血', '壮志', '报国', '山河']
};

/**
 * 生成诗词创作挑战
 */
async function generateChallenge(userId, theme, keyword) {
  try {
    // 生成AI诗词
    const poem = await generateAIPoem(theme, keyword);
    
    if (!poem) {
      return { success: false, message: 'AI生成失败，请重试' };
    }
    
    // 保存挑战记录
    const challengeId = await saveChallenge(userId, theme, keyword, poem);
    
    return {
      success: true,
      challengeId,
      poem,
      theme,
      userCanScore: true
    };
  } catch (error) {
    console.error('生成创作挑战失败:', error);
    return { success: false, message: '生成失败' };
  }
}

/**
 * AI生成诗词 - 增强版prompt
 */
async function generateAIPoem(theme, keyword) {
  const themeWords = themeKeywords[theme] || ['情'];
  const keywordList = keyword ? [keyword] : themeWords.slice(0, 2);
  
  // 构建严格的prompt
  const prompt = `你是位唐诗大师，请创作一首七言绝句。

主题：「${theme}」
关键词：必须包含「${keywordList[0]}」字

【创作要求】
1. 严格七言绝句格式：4句，每句7字，共28字
2. 押韵：第2、4句押韵（如：花/家/沙/霞）
3. 主题契合度：必须体现「${theme}」的意境
4. 必须包含「${keywordList[0]}」字
5. 意境优美，情感真挚
6. 避免常见陈词滥调

请返回JSON格式：
{
  "title": "标题",
  "content": "第一句，第二句，第三句，第四句。",
  "rhymeScheme": "押韵说明"
}`;

  try {
    const result = await aiService.callAIGenerateJSON(
      prompt,
      '你是一位精通唐诗创作的诗词大师，对格律、意境、用词有极高要求。',
      { temperature: 0.85, max_tokens: 400 }
    );
    
    if (result && result.title && result.content) {
      // 验证生成质量
      const validation = validateGeneratedPoem(result, theme, keywordList[0]);
      
      // 解析诗句
      let lines = result.content.split(/[，,]/).map(l => l.trim()).filter(l => l);
      
      // 如果只有一句完整的话（用句号分隔），按句子分割
      if (lines.length < 4 && result.content.includes('。')) {
        lines = result.content.split(/[。]/).filter(l => l.trim()).map(l => l.trim() + '。');
      }
      
      // 验证字数
      const validLines = lines.filter(l => l.length === 7);
      
      if (validLines.length >= 4) {
        const poemContent = validLines.slice(0, 4).join('，') + '。';
        
        // 生成详细评价
        const evaluation = await generateDetailedEvaluation(poemContent, theme, keywordList[0]);
        
        return {
          title: result.title,
          content: poemContent,
          author: 'AI创作',
          rhymeScheme: result.rhymeScheme || '',
          validation,
          evaluation
        };
      }
    }
    
    // 返回预设模板
    return getPresetPoem(theme, keywordList[0]);
  } catch (error) {
    console.error('AI创作失败，使用预设诗词:', error);
    return getPresetPoem(theme, keywordList[0]);
  }
}

/**
 * 验证生成的诗词是否符合要求
 */
function validateGeneratedPoem(poem, theme, keyword) {
  const content = poem.content || '';
  const lines = content.split(/[，。]/).filter(l => l.trim());
  
  // 检查是否包含关键词
  const hasKeyword = content.includes(keyword);
  
  // 检查字数
  const correctLength = lines.every(l => l.length === 7);
  
  // 检查主题相关性
  const themeWords = themeKeywords[theme] || [];
  const themeMatches = themeWords.filter(w => content.includes(w)).length;
  const themeRelevance = Math.min(100, themeMatches * 20);
  
  return {
    hasKeyword,
    correctLength,
    themeRelevance,
    isValid: hasKeyword && correctLength && themeRelevance >= 40
  };
}

/**
 * 生成详细评价 - 多维度分析
 */
async function generateDetailedEvaluation(poem, theme, keyword) {
  const lines = poem.replace(/[，。]/g, '').match(/.{1,7}/g) || [];
  const fullContent = poem.replace(/[，。]/g, '');
  
  const prompt = `请对以下诗词进行专业点评，从多个维度分析：

【诗词原文】
${poem}

【创作主题】${theme}
【指定关键词】${keyword}

【点评要求】
请从以下8个维度进行详细点评：

1. **意境营造** (0-100分)
   - 画面感、氛围营造
   - 情感表达是否到位

2. **用词精妙** (0-100分)
   - 动词、形容词使用是否精准
   - 是否有炼字亮点

3. **典故运用** (0-100分)
   - 是否巧妙运用古典意象
   - 典故是否贴切

4. **格律音韵** (0-100分)
   - 平仄是否协调
   - 押韵是否工整

5. **主题契合** (0-100分)
   - 是否紧扣"${theme}"主题
   - 情感是否真挚

6. **创新程度** (0-100分)
   - 是否有独特视角
   - 是否有新意

7. **整体美感** (0-100分)
   - 结构布局
   - 艺术感染力

8. **综合评分** (0-100分)
   - 总体质量评价

请返回JSON格式：
{
  "dimensionScores": {
    "yijing": {"score": 85, "comment": "详细点评..."},
    "yongci": {"score": 78, "comment": "详细点评..."},
    "diangu": {"score": 65, "comment": "详细点评..."},
    "gelv": {"score": 92, "comment": "详细点评..."},
    "zhuti": {"score": 88, "comment": "详细点评..."},
    "chuangxin": {"score": 72, "comment": "详细点评..."},
    "meigan": {"score": 80, "comment": "详细点评..."},
    "zonghe": {"score": 82, "comment": "综合评价..."}
  },
  "highlights": ["亮点1", "亮点2"],
  "suggestions": ["改进建议1", "改进建议2"],
  "poemAnalysis": {
    "firstLine": {"text": "第一句", "analysis": "分析"},
    "secondLine": {"text": "第二句", "analysis": "分析"},
    "thirdLine": {"text": "第三句", "analysis": "分析"},
    "fourthLine": {"text": "第四句", "analysis": "分析"}
  }
}`;

  try {
    const result = await aiService.callAIGenerateJSON(
      prompt,
      '你是一位资深的诗词评论家，对古典诗词有深厚造诣，点评精准独到。',
      { temperature: 0.7, max_tokens: 1000 }
    );
    
    if (result && result.dimensionScores) {
      return {
        dimensions: result.dimensionScores,
        highlights: result.highlights || [],
        suggestions: result.suggestions || [],
        poemAnalysis: result.poemAnalysis || {}
      };
    }
    
    // 返回默认评价
    return generateDefaultEvaluation(poem, theme);
  } catch (error) {
    console.error('生成详细评价失败:', error);
    return generateDefaultEvaluation(poem, theme);
  }
}

/**
 * 生成默认评价（当AI评价失败时）
 */
function generateDefaultEvaluation(poem, theme) {
  const lines = poem.replace(/[，。]/g, '').match(/.{1,7}/g) || [];
  
  return {
    dimensions: {
      yijing: { score: 75, comment: '意境营造尚可，画面感有待提升' },
      yongci: { score: 70, comment: '用词基本准确，有一定炼字空间' },
      diangu: { score: 60, comment: '典故运用较少，可加强文化底蕴' },
      gelv: { score: 85, comment: '格律工整，押韵协调' },
      zhuti: { score: 80, comment: `紧扣"${theme}"主题` },
      chuangxin: { score: 65, comment: '创新程度一般，可尝试新视角' },
      meigan: { score: 75, comment: '整体美感较好' },
      zonghe: { score: 73, comment: '综合质量中等偏上' }
    },
    highlights: [
      '格律规范',
      '主题明确'
    ],
    suggestions: [
      '加强意象描写',
      '增加情感深度'
    ],
    poemAnalysis: {
      firstLine: { text: lines[0] || '', analysis: '开篇点题' },
      secondLine: { text: lines[1] || '', analysis: '承上启下' },
      thirdLine: { text: lines[2] || '', analysis: '转折深化' },
      fourthLine: { text: lines[3] || '', analysis: '收束有力' }
    }
  };
}

/**
 * 预设诗词模板（当AI失败时使用）
 */
function getPresetPoem(theme, keyword) {
  const poems = {
    '春天': { 
      title: '春望', 
      content: '春风拂面百花开，绿柳垂丝映池台。' + keyword + '何处寻芳迹，燕子归来报春来。', 
      author: 'AI创作',
      rhymeScheme: '台/来 押韵'
    },
    '夏天': { 
      title: '夏夜', 
      content: '炎炎夏日荷香浓，蝉噪林间声不穷。' + keyword + '送爽凉如水，星光点点照苍穹。', 
      author: 'AI创作',
      rhymeScheme: '穷/穹 押韵'
    },
    '秋天': { 
      title: '秋思', 
      content: '秋风萧瑟叶飘零，' + keyword + '高悬照古城。独坐窗前思故里，霜华满地月如银。', 
      author: 'AI创作',
      rhymeScheme: '城/银 押韵'
    },
    '冬天': { 
      title: '冬雪', 
      content: '漫天飞雪覆尘埃，' + keyword + '寒梅傲雪独自开。炉火温暖驱冷意，围炉夜话乐悠哉。', 
      author: 'AI创作',
      rhymeScheme: '开/哉 押韵'
    },
    '思乡': { 
      title: '月夜思', 
      content: '明月高悬照故园，' + keyword + '千里相思共婵娟。遥望家乡山与水，不知何日是归年。', 
      author: 'AI创作',
      rhymeScheme: '园/娟/年 押韵'
    },
    '友情': { 
      title: '送别', 
      content: '杨柳依依送君行，' + keyword + '相知何必问归程。此去经年难再见，桃花潭水最深清。', 
      author: 'AI创作',
      rhymeScheme: '行/程/清 押韵'
    },
    '山水': { 
      title: '山行', 
      content: '青山隐隐水迢迢，' + keyword + '白云深处有人家。松风阵阵送清凉，疑是仙境落尘沙。', 
      author: 'AI创作',
      rhymeScheme: '迢/家/沙 押韵'
    },
    '爱国': { 
      title: '壮志', 
      content: '男儿当立报国志，' + keyword + '热血洒疆场。马革裹尸何足惧，青史留名万年长。', 
      author: 'AI创作',
      rhymeScheme: '志/场/长 押韵'
    }
  };
  
  const poem = poems[theme] || { 
    title: '即兴', 
    content: keyword + '随风入梦来，诗词歌赋尽开怀。春花秋月皆成韵，一首新诗表素怀。', 
    author: 'AI创作',
    rhymeScheme: '来/怀 押韵'
  };
  
  // 为预设诗词添加默认评价
  poem.evaluation = generateDefaultEvaluation(poem.content, theme);
  
  return poem;
}

/**
 * 保存挑战记录
 */
function saveChallenge(userId, theme, keyword, poem) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO poetry_challenges (user_id, theme, keyword, generated_poem, status)
      VALUES (?, ?, ?, ?, 'generated')
    `, [userId, theme, keyword || null, JSON.stringify(poem)], function(err) {
      if (err) { reject(err); return; }
      resolve(this.lastID);
    });
  });
}

/**
 * 用户对AI诗词评分 + 获取AI评价
 */
async function ratePoem(userId, challengeId, userScore, feedback) {
  return new Promise(async (resolve, reject) => {
    db.get('SELECT * FROM poetry_challenges WHERE id = ? AND user_id = ?', [challengeId, userId], async (err, row) => {
      if (err) { reject(err); return; }
      if (!row) { 
        resolve({ success: false, message: '挑战不存在' }); 
        return; 
      }
      
      // 解析保存的诗词和评价
      let poem = null;
      let evaluation = null;
      if (row.generated_poem) {
        try {
          poem = JSON.parse(row.generated_poem);
          evaluation = poem.evaluation || null;
        } catch (e) {}
      }
      
      // 更新评分
      db.run(`
        UPDATE poetry_challenges
        SET user_score = ?, feedback = ?, status = 'scored'
        WHERE id = ?
      `, [userScore, feedback || null, challengeId], (err) => {
        if (err) { reject(err); return; }
        
        // 返回评分结果和AI评价
        resolve({
          success: true,
          score: userScore,
          evaluation: evaluation,
          poem: poem
        });
      });
    });
  });
}

/**
 * 获取用户挑战历史
 */
function getChallengeHistory(userId, limit = 20) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM poetry_challenges
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [userId, limit], (err, rows) => {
      if (err) { reject(err); return; }
      
      rows = rows.map(row => {
        if (row.generated_poem) {
          try {
            const poem = JSON.parse(row.generated_poem);
            row.poem = poem;
            row.evaluation = poem.evaluation || null;
          } catch (e) {}
        }
        return row;
      });
      
      resolve(rows);
    });
  });
}

/**
 * 获取创作挑战统计
 */
function getChallengeStats(userId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        COUNT(*) as total_challenges,
        SUM(CASE WHEN user_score > 0 THEN 1 ELSE 0 END) as scored_count,
        AVG(user_score) as avg_score,
        MAX(user_score) as max_score,
        SUM(CASE WHEN user_score >= 8 THEN 1 ELSE 0 END) as excellent_count,
        SUM(CASE WHEN user_score >= 6 AND user_score < 8 THEN 1 ELSE 0 END) as good_count,
        SUM(CASE WHEN user_score < 6 THEN 1 ELSE 0 END) as poor_count
      FROM poetry_challenges
      WHERE user_id = ?
    `, [userId], (err, row) => {
      if (err) { reject(err); return; }
      resolve(row || {});
    });
  });
}

/**
 * 获取主题列表
 */
function getThemes() {
  return [
    { name: '春天', icon: '🌸', description: '万物复苏，百花争艳', keywords: '春/花/柳/风' },
    { name: '夏天', icon: '☀️', description: '烈日炎炎，蝉鸣阵阵', keywords: '夏/荷/蝉/雨' },
    { name: '秋天', icon: '🍂', description: '金风送爽，硕果累累', keywords: '秋/叶/月/雁' },
    { name: '冬天', icon: '❄️', description: '白雪皑皑，寒梅傲雪', keywords: '冬/雪/梅/寒' },
    { name: '思乡', icon: '🏠', description: '月圆之夜，倍加思亲', keywords: '乡/月/归/雁' },
    { name: '友情', icon: '🤝', description: '知己难逢，珍惜友情', keywords: '友/知/别/酒' },
    { name: '山水', icon: '🏔️', description: '山水相依，诗意盎然', keywords: '山/水/云/松' },
    { name: '爱国', icon: '🇨🇳', description: '家国情怀，壮志凌云', keywords: '国/志/壮/忠' },
    { name: '离别', icon: '🚢', description: '长亭古道，折柳相送', keywords: '柳/酒/帆/舟' },
    { name: '爱情', icon: '💕', description: '相思相守，情深意长', keywords: '思/念/心/情' },
    { name: '田园', icon: '🌾', description: '归园田居，闲适自在', keywords: '田/耕/桑/炊' },
    { name: '边塞', icon: '⚔️', description: '大漠孤烟，铁马冰河', keywords: '沙/尘/月/关' }
  ];
}

/**
 * 获取特定主题的详细创作建议
 */
function getThemeGuide(theme) {
  const guides = {
    '春天': {
      typicalImages: ['春风、春雨、春花、春草、春柳、燕子、蝴蝶、莺啼'],
      emotions: ['喜悦、希望、新生、活力'],
      classicExamples: ['春眠不觉晓，处处闻啼鸟', '春江潮水连海平，海上明月共潮生'],
      tips: '描写春天时可注重色彩的变化和生命的萌动，用动词如"拂"、"润"、"绽"等增加动感。'
    },
    '思乡': {
      typicalImages: ['明月、归雁、秋月、故乡、山水'],
      emotions: ['思念、惆怅、期盼、忧愁'],
      classicExamples: ['举头望明月，低头思故乡', '春风又绿江南岸，明月何时照我还'],
      tips: '思乡主题常用月、雁等意象烘托情感，注意虚实结合，以景衬情。'
    },
    '友情': {
      typicalImages: ['酒、柳、亭、帆、琴'],
      emotions: ['珍重、离别、不舍、祝愿'],
      classicExamples: ['桃花潭水深千尺，不及汪伦送我情', '海内存知己，天涯若比邻'],
      tips: '送别诗多用具体意象寄托情感，如"柳"谐音"留"，"酒"表达情谊。'
    },
    '爱国': {
      typicalImages: ['山河、边疆、战马、旌旗'],
      emotions: ['壮志、悲壮、忠诚、热血'],
      classicExamples: ['王师北定中原日，家祭无忘告乃翁', '人生自古谁无死，留取丹心照汗青'],
      tips: '爱国诗词需有宏大视角，融入个人理想与家国情怀。'
    }
  };
  
  return guides[theme] || {
    typicalImages: ['自然景物、人物活动'],
    emotions: ['根据主题而定'],
    classicExamples: ['注意格律对仗'],
    tips: '创作时注意主题明确、意象贴切、情感真挚。'
  };
}

module.exports = {
  generateChallenge,
  ratePoem,
  getChallengeHistory,
  getChallengeStats,
  getThemes,
  getThemeGuide
};
